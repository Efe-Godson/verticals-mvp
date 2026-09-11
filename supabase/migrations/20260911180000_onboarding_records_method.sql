-- "How do you currently keep records?" - a new question in the onboarding
-- flow (src/onboarding/RecordsMethodPrompt.jsx), right before the demo.
-- Genuinely valuable data ("what Verticals is replacing" for this
-- visitor), tracked the same way entry_intent/custom_intent_text already
-- are - same table, same insert-any/read-admin-only policies (a new
-- column needs no new RLS or grants, both already cover every column on
-- this table).
alter table onboarding_events add column current_records_method text;
