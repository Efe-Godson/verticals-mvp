// Clicking a native date/time input only opens the picker when the click
// lands on the tiny calendar/clock glyph - everywhere else in the box just
// places a text cursor. That's surprising when the input sits inside a
// bordered tile/card that reads as one clickable control. showPicker() (or
// its closest ancestor label, which forwards its click to the control - see
// payroll/ui.jsx's Field) fires a real click on the underlying input either
// way, so one delegated listener covers every date/time field in the app
// without touching each form.
//
// Registered on the CAPTURE phase, not bubble: Modal.jsx's content wrapper
// calls stopPropagation() on click (so clicking inside a modal doesn't also
// trigger the overlay's close-on-click), which would otherwise stop a
// bubble-phase document listener from ever seeing clicks on date inputs
// rendered inside any modal - exactly where most of these fields live
// (payroll, invoices, records).
export function initDateInputClickToOpen() {
  document.addEventListener('click', (e) => {
    const input = e.target.closest('input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"], input[type="week"]')
    if (!input || input.disabled || input.readOnly || typeof input.showPicker !== 'function') return
    try { input.showPicker() } catch { /* not focusable / not user-activated - fall back to default click behaviour */ }
  }, true)
}
