-- 007_public_rpc_submit_and_track.sql
-- =====================================================================
-- Makes the PUBLIC (anonymous) complaint + track flows work securely.
--
-- Problem: the complaint form and track page run as the anonymous user and
-- need to read/write customers, tickets, pincode_routes and employees. RLS
-- (correctly) blocks anonymous table access -> "new row violates row-level
-- security policy". Granting anon direct table access would expose all
-- customer PII and staff data to the public internet.
--
-- Fix: route both public flows through SECURITY DEFINER functions that run
-- with the owner's privileges (bypassing RLS) and expose ONLY what the public
-- needs. Anonymous users get EXECUTE on these two functions and nothing else;
-- every table stays locked down.
--
-- Idempotent + transactional. RUN IN PRODUCTION PROJECT: ygvvlbbwmckuwvayyynb
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- submit_complaint: create/upsert the customer, generate the ticket
-- number, auto-route by pincode, and insert the ticket -- all atomically.
-- Returns the new ticket's identifiers for the confirmation + notifications.
-- ---------------------------------------------------------------------
create or replace function public.submit_complaint(
  p_name              text,
  p_phone             text,
  p_email             text,
  p_address           text,
  p_pincode           text,
  p_product_type      text,
  p_product_model     text,
  p_serial_number     text,
  p_issue_description text,
  p_complainant_type  text,
  p_dealer_name       text,
  p_invoice_url       text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_prefix      text;
  v_full_prefix text;
  v_last        text;
  v_next        int;
  v_ticket_no   text;
  v_assigned_to uuid;
  v_tech_name   text;
  v_status      text;
  v_ticket_id   uuid;
begin
  -- Validate the required inputs (mirrors the form's required fields).
  if coalesce(btrim(p_name), '') = ''
     or coalesce(btrim(p_phone), '') = ''
     or coalesce(btrim(p_address), '') = ''
     or coalesce(btrim(p_issue_description), '') = ''
     or coalesce(btrim(p_product_type), '') = '' then
    raise exception 'Missing required fields for complaint submission';
  end if;

  if p_complainant_type = 'dealer' and coalesce(btrim(p_dealer_name), '') = '' then
    raise exception 'Dealer name is required when complaint type is Dealer';
  end if;

  -- 1) Upsert the customer by phone.
  insert into public.customers (name, phone, email, address, pincode)
  values (btrim(p_name), btrim(p_phone), nullif(btrim(p_email), ''),
          btrim(p_address), nullif(btrim(p_pincode), ''))
  on conflict (phone) do update
    set name    = excluded.name,
        email   = excluded.email,
        address = excluded.address,
        pincode = excluded.pincode
  returning id into v_customer_id;

  -- 2) Generate the ticket number (prefix by product + date + running seq).
  --    Serialize per-prefix so concurrent submissions can't collide.
  v_prefix := case p_product_type
                when 'Washing Machine' then 'TGWM'
                when 'Air Cooler'      then 'TGAC'
                when 'Washer'          then 'TGW'
                when 'Television'      then 'TGTV'
                else 'TG'
              end;
  v_full_prefix := v_prefix || to_char(now(), 'YYYYMMDD');

  perform pg_advisory_xact_lock(hashtext(v_full_prefix));

  select ticket_number into v_last
  from public.tickets
  where ticket_number like v_full_prefix || '%'
  order by ticket_number desc
  limit 1;

  if v_last is null then
    v_next := 1;
  else
    v_next := coalesce(
      nullif(regexp_replace(substr(v_last, length(v_full_prefix) + 1), '\D', '', 'g'), '')::int,
      0
    ) + 1;
  end if;
  v_ticket_no := v_full_prefix || lpad(v_next::text, 3, '0');

  -- 3) Auto-route by pincode.
  select pr.employee_id, e.name
    into v_assigned_to, v_tech_name
  from public.pincode_routes pr
  left join public.employees e on e.id = pr.employee_id
  where pr.pincode = nullif(btrim(p_pincode), '')
  limit 1;

  v_status := case when v_assigned_to is not null then 'assigned' else 'new' end;

  -- 4) Create the ticket.
  insert into public.tickets (
    ticket_number, customer_id, assigned_to, product_type, product_brand,
    product_model, serial_number, issue_description, complainant_type,
    dealer_name, status, photos, invoice_url
  ) values (
    v_ticket_no, v_customer_id, v_assigned_to, p_product_type, 'TG SMART',
    nullif(btrim(p_product_model), ''), nullif(btrim(p_serial_number), ''),
    btrim(p_issue_description),
    coalesce(nullif(btrim(p_complainant_type), ''), 'customer'),
    case when p_complainant_type = 'dealer' then nullif(btrim(p_dealer_name), '') end,
    v_status::ticket_status, '{}', nullif(btrim(p_invoice_url), '')
  )
  returning id into v_ticket_id;

  return json_build_object(
    'ticket_id',       v_ticket_id,
    'ticket_number',   v_ticket_no,
    'assigned_to',     v_assigned_to,
    'technician_name', v_tech_name,
    'status',          v_status
  );
end;
$$;

-- ---------------------------------------------------------------------
-- track_ticket: public status lookup by ticket number OR phone.
-- Returns the ticket plus the customer's name/phone only (no address, etc.).
-- ---------------------------------------------------------------------
create or replace function public.track_ticket(p_query text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q      text := upper(btrim(coalesce(p_query, '')));
  v_ticket public.tickets;
  v_cust   public.customers;
begin
  if v_q = '' then
    return null;
  end if;

  -- Match by ticket number first.
  select * into v_ticket
  from public.tickets
  where upper(ticket_number) = v_q
  order by created_at desc
  limit 1;

  -- Fall back to matching by customer phone.
  if v_ticket.id is null then
    select t.* into v_ticket
    from public.tickets t
    join public.customers c on c.id = t.customer_id
    where c.phone = btrim(p_query)
    order by t.created_at desc
    limit 1;
  end if;

  if v_ticket.id is null then
    return null;
  end if;

  select * into v_cust from public.customers where id = v_ticket.customer_id;

  return to_jsonb(v_ticket) || jsonb_build_object(
    'customers', jsonb_build_object('name', v_cust.name, 'phone', v_cust.phone)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Grants: anonymous + logged-in users may call ONLY these two functions.
-- ---------------------------------------------------------------------
grant execute on function public.submit_complaint(
  text, text, text, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

grant execute on function public.track_ticket(text) to anon, authenticated;

commit;

-- ---------------------------------------------------------------------
-- Storage: allow anonymous invoice uploads to the ticket-attachments bucket
-- (write-only). Uploads are best-effort on the client and never block a
-- submission. Wrapped in a guard so it is safe if storage RLS differs.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'storage' and c.relname = 'objects') then
    begin
      drop policy if exists "anon_upload_ticket_attachments" on storage.objects;
      create policy "anon_upload_ticket_attachments"
        on storage.objects for insert to anon, authenticated
        with check (bucket_id = 'ticket-attachments');
    exception when insufficient_privilege then
      raise notice 'Skipped storage policy (insufficient privilege); create it in Dashboard > Storage > Policies.';
    end;
  end if;
end $$;
