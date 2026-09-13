import posthog from 'posthog-js'

const projectToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN
const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST

export const posthogEnabled = Boolean(projectToken && apiHost)

function requireDevelopmentConfig(value, variableName) {
  if (!value && import.meta.env.DEV) {
    throw new Error(`${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`)
  }
}

export function initPostHog() {
  requireDevelopmentConfig(projectToken, 'VITE_PUBLIC_POSTHOG_PROJECT_TOKEN')
  requireDevelopmentConfig(apiHost, 'VITE_PUBLIC_POSTHOG_HOST')

  if (!posthogEnabled) return

  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: '2026-01-30',
    capture_pageview: 'history_change',
  })
}

export function captureEvent(eventName, properties) {
  if (posthogEnabled) posthog.capture(eventName, properties)
}

export function captureException(error, properties) {
  if (posthogEnabled) posthog.captureException(error, properties)
}

export function identifyUser(user) {
  if (!posthogEnabled || !user?.id) return
  posthog.identify(user.id, {
    email: user.email,
    role: user.app_metadata?.role,
  })
}

export function resetPostHog() {
  if (posthogEnabled) posthog.reset()
}

export function getPostHogContext() {
  if (!posthogEnabled) return {}
  return {
    distinctId: posthog.get_distinct_id(),
    sessionId: posthog.get_session_id(),
  }
}

export { posthog }
