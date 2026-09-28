-- 006_add_customers_pincode.sql
-- =====================================================================
-- Fixes: "Could not find the 'pincode' column of 'customers' in the schema
-- cache" (Postgres 42703) on the complaint form.
--
-- Cause: the app + database.types.ts expect customers.pincode (written by
-- ComplaintFormPage upsert, read by Admin/Manager pages), but the column was
-- never added to the database -- 001_initial_schema.sql created customers
-- without it and no later migration adds it.
--
-- Nullable so existing customer rows stay valid; the form supplies it going
-- forward. Idempotent.
--
-- RUN IN THE SQL EDITOR OF PRODUCTION PROJECT: ygvvlbbwmckuwvayyynb
-- =====================================================================

alter table public.customers
  add column if not exists pincode text;

-- Refresh PostgREST's schema cache so the API sees the new column immediately.
notify pgrst, 'reload schema';
