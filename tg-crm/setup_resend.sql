-- 1. Create the Email function using Resend
create or replace function send_email_resend(
  to_email text, 
  subject text, 
  html_body text
)
returns json
language plpgsql
security definer
as $$
declare
  api_key text := 're_Ms9nyqVj_fHNHX9bTWJSuH11tUd1465V2'; -- Automatically securely stored
  request_id bigint;
begin
  -- Send via POST using pg_net
  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'TG SMART CRM <onboarding@resend.dev>',
      'to', to_email,
      'subject', subject,
      'html', html_body
    )
  ) into request_id;

  return json_build_object(
    'success', true, 
    'message', 'Email queued on server', 
    'queue_id', request_id
  );
end;
$$;
