-- Powers the "Active / Offline" status shown per staff login on the Admin
-- page (see AdminStaff.jsx) - a simple heartbeat timestamp rather than a
-- true session table, updated by AuthContext.jsx while a staff session is
-- open (see the manage-staff edge function's 'heartbeat' action).
alter table form_staff add column last_seen_at timestamptz;
