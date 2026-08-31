-- Optional gender on staff records, for the Staff page's gender-distribution
-- KPI card. Defaults to 'unspecified' so existing rows and any employee
-- saved without picking one are simply "not recorded".
alter table payroll_employees
  add column if not exists gender text
    check (gender in ('male', 'female', 'other', 'unspecified'))
    default 'unspecified';
