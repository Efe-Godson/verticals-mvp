// Place at: src/lib/completeOnboardingEntry.js
// Runs once, right after a session first appears (see the effect in
// BusinessesHome.jsx) - the part of the new entry flow that can only happen
// post-signup, because forms' insert policy requires auth.uid() and an
// anonymous visitor doesn't have one yet:
//   1. backfills user_metadata.entry_intent/custom_intent_text - already
//      set for an email/password signup (SignUp.jsx passes it straight
//      into supabase.auth.signUp's own `data` option), but Google's OAuth
//      path has no equivalent, so this is the only place that path's
//      account ever gets it.
//   2. fires the completed_signup funnel event.
//   3. for a real-template/workflow intent, actually creates the workspace
//      RealTemplatePreview.jsx could only preview before now, and returns
//      where to send them (their new form's builder, or a bundle's
//      dashboard) instead of the normal Businesses home.
//
// Reads the pending intent from sessionStorage first, but falls back to
// user_metadata.entry_intent (set directly at signUp() time) if that's
// empty - an email/password confirmation link commonly opens in a new tab,
// which has its own blank sessionStorage even though it's the same account,
// so sessionStorage alone would silently drop the workspace-creation step
// for most email/password signups. user_metadata.entry_workspace_done then
// guards against ever repeating this (workspace created, or nothing to
// create) on a later login, regardless of which tab/device that is on.
import { supabase } from '../supabaseClient'
import { getEntryIntent } from '../onboarding/entryIntents'
import { createLocationForm, createBundleTemplateForms, locationDestination, bundleDestination } from '../locations'
import { track } from './onboardingEvents'
import { ONBOARDING_STORAGE_KEY } from '../onboarding/OnboardingPage'

function readPendingFromSessionStorage() {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function completeOnboardingEntry(session) {
  if (session.user.user_metadata?.entry_workspace_done) return null

  const payload = readPendingFromSessionStorage() ||
    (session.user.user_metadata?.entry_intent
      ? { entry_intent: session.user.user_metadata.entry_intent, custom_intent_text: session.user.user_metadata.custom_intent_text }
      : null)

  try { sessionStorage.removeItem(ONBOARDING_STORAGE_KEY) } catch { /* private mode */ }

  if (!payload?.entry_intent) return null

  if (session.user.user_metadata?.entry_intent !== payload.entry_intent) {
    await supabase.auth.updateUser({
      data: { entry_intent: payload.entry_intent, custom_intent_text: payload.custom_intent_text || null },
    })
  }

  track('completed_signup', { entryIntent: payload.entry_intent, customIntentText: payload.custom_intent_text })

  let destination = null
  const intent = getEntryIntent(payload.entry_intent)
  if (intent && intent.kind !== 'demo' && intent.templateSlug) {
    const { data: template } = await supabase.from('templates').select('*').eq('slug', intent.templateSlug).single()
    if (template) {
      try {
        if (template.bundle?.length > 0) {
          const createdByKey = await createBundleTemplateForms({ session, template })
          destination = bundleDestination(template, createdByKey[template.bundle[0].key])
        } else {
          const locationName = payload.custom_intent_text || template.name
          const form = await createLocationForm({ session, template, locationName })
          destination = locationDestination(template, form.id)
        }
      } catch {
        // Not fatal - they land on the normal Businesses home instead of a
        // pre-made workspace, same as if they'd never picked an intent.
      }
    }
  }

  // Set regardless of whether a workspace actually got created - 'demo'
  // intents have nothing to create, and a failed template lookup shouldn't
  // turn into an indefinite retry-on-every-login loop either.
  await supabase.auth.updateUser({ data: { entry_workspace_done: true } })

  return destination
}
