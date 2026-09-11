-- The "Forms" template shipped tagged category 'Other', so it fell back to
-- the same generic grey 4-square icon as any uncategorized template (see
-- templateVisuals.jsx's CategoryIcon default case). Give it a real category
-- of its own with a distinct colour/icon (a clipboard/checklist glyph).
update templates set category = 'Forms' where slug = 'forms';
