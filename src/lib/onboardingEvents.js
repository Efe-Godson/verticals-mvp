// Place at: src/lib/onboardingEvents.js
// Fire-and-forget funnel tracking for the pre-signup entry flow (Welcome ->
// Setup Selection -> Demo/Preview -> Signup). Writes straight to
// onboarding_events (see the migration of the same name) - that table's
// insert policy is open to `public` on purpose, since most of this funnel
// happens before an account exists at all. Never throws and never awaited
// by a caller that cares about the result - a dropped analytics event is
// nowhere near as bad as a broken signup flow because of one.
import { supabase } from '../supabaseClient'

const SESSION_ID_KEY = 'verticals_onboarding_session_id'

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_ID_KEY, id)
    }
    return id
  } catch {
    // Private browsing / storage disabled - a random id that just won't
    // persist across screens is still better than crashing the flow.
    return crypto.randomUUID()
  }
}

// event: 'started_onboarding' | 'selected_intent' | 'opened_demo' |
//        'started_signup' | 'completed_signup'
export function track(event, { entryIntent, customIntentText } = {}) {
  try {
    supabase.from('onboarding_events').insert([{
      session_id: getSessionId(),
      event_type: event,
      entry_intent: entryIntent || null,
      custom_intent_text: customIntentText || null,
    }]).then(() => {}, () => {})
  } catch {
    // Swallow - see module note above.
  }
}
