-- Lets a form owner/staff backdate what date prints on a Retail invoice
-- without touching created_at (the real, untouched audit timestamp).
-- Null means "no override" - InvoiceModal falls back to created_at.

alter table submissions
  add column if not exists invoice_date date;
