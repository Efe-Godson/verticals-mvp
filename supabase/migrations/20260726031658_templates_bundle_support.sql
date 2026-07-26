-- Some templates need more than one linked form (e.g. Staff Payment Tracker
-- = an Employees form + a Salary Events form whose "Employee" field points
-- back at Employees). `bundle` holds an array of form specs:
--   [{ "key": "employees", "name": "Employees", "fields": [...] },
--    { "key": "events", "name": "Salary Events", "fields": [...] }]
-- A linked_record field's linkedFormId may contain a placeholder like
-- "$employees" referencing another bundle entry's key — resolved to the
-- real created form id client-side when the template is started, since the
-- ids don't exist until then. `fields` stays as the single-form path.
alter table templates
  add column if not exists bundle jsonb;
