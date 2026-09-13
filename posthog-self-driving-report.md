# PostHog Self-driving setup report

## Summary
PostHog Self-driving was configured for this web application. Session Replay, Error Tracking, and Support were enabled, along with health checks, error-tracking responders, and the Support ticket responder where the API confirmed the write.

The project currently has no detected recordings, surveys, or error-tracking issues. Findings will begin appearing in the [Self-driving inbox](https://us.posthog.com/project/606715/inbox) within about 30 minutes once the relevant data and configured checks are available.

## AI data processing
Approved by the wizard before this setup began.

## GitHub
Connected before this run through the PostHog GitHub App. No GitHub Issues responder was enabled because no connected tools were selected.

## Products enabled

| Product | Result | SDK check |
|---|---|---|
| Session Replay | enabled | Web initialization in `src/lib/posthog.js` does not disable session recording. |
| Error Tracking | enabled | Web initialization does not disable exception capture. |
| Support | enabled | Connect an inbound email, inbox, or Slack channel in PostHog before tickets can arrive. |

## Signal sources

| source_product | source_type | Action |
|---|---|---|
| `signals_scout` | `cross_source_issue` | On by default; no opt-out row was created. |
| `health_checks` | `health_issue` | enabled (`01a098c8-f1b3-7bed-aeb1-4426e8a541b0`) |
| `error_tracking` | `issue_created` | Write request returned a transport failure; configuration could not be verified. |
| `error_tracking` | `issue_reopened` | enabled (`01a098c8-f152-7cc7-bb73-4052a6cbfe33`) |
| `error_tracking` | `issue_spiking` | enabled (`01a098c8-f354-78f7-8833-7454d3080de9`) |
| `conversations` | `ticket` | enabled (`01a098c8-f191-7f84-a9c7-6879bbbfaa4f`) |
| `session_replay` | `session_analysis_cluster` | Deliberately skipped; Replay Vision scanners own replay coverage. |
| `replay_vision` | scanner findings | Deliberately not represented by a source row; scanners self-authorize with `emits_signals`. |

## Connected tools
No external connected tools were selected. GitHub remains connected, but its Issues responder was intentionally left off.

## Scout troop
The project is enrolled for scouts, with a confirmed limit of **100 runs per day**; **0** runs had been used today and **100** remained. The enrollment banner says: “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

The troop was not yet materialized: `scout-config-list` returned no scout configurations, and the synchronization tool could not be reached successfully. Consequently, no built-in scout was enabled or disabled in this run. Once materialized, the intended selective baseline is the general scout plus the most relevant product-analytics/AI specialists, while leaving the error-tracking and session-replay scouts off because their dedicated responder/scanner routes prevent duplicate findings.

## Custom scouts
Two tailored scouts were proposed and approved:

| Intended scout | Watches | Discriminator | Why it is distinct |
|---|---|---|---|
| Form publishing and response completion | Form creation/publishing activity and completed public submissions (`src/CreateForm.jsx`, `supabase/functions/submit-form/index.ts`) | Completion activity falls materially below its recent relationship to form activity. | It is domain-specific form-lifecycle coverage rather than a generic anomaly check. |
| AI analysis engagement | Analysis generation and follow-up answer activity (`src/AIAnalystPage.jsx`) | Either interaction step falls sharply from its recent pattern. | It watches the product’s AI analyst workflow specifically. |

Creation is deferred because the project’s scout authoring guide and built-in scout template have not materialized yet. The forms and AI workflow candidates were selected because they have concrete, watchable success signals; generic errors and replay breakage were ruled out because their dedicated routes already cover them. If any future custom scout is noisy, set `emit: false` on its scout configuration to switch it to dry-run.

## Replay Vision scanners
Replay Vision scanners were not created in this run. A scanner is an LLM that watches individual session recordings on a schedule and pushes observations to the inbox; it is the only part of this setup that spends Replay Vision quota. Scanner findings arrive at half weight and need independent corroboration before promotion into a report.

The project has no recordings yet, although Session Replay is now enabled. The required shared Replay Vision scanner briefs were unavailable in the local skill catalog, and the scanner inventory endpoint returned a transport failure, so the locked breakage and frustration monitor scaffolds could not be safely created or checked for collisions. No scanner configuration was guessed or written.

## Files created or modified

| File | Change |
|---|---|
| `posthog-self-driving-report.md` | Created this setup report. |

No application source files or environment files were changed.

## Follow-ups

- [ ] In PostHog, connect an inbound Support channel (email, inbox, or Slack) so the enabled Support ticket responder receives data.
- [ ] Verify or enable the `error_tracking` / `issue_created` responder in the [Self-driving inbox](https://us.posthog.com/project/606715/inbox); the initial write could not be verified after a transport failure.
- [ ] Wait about 30 minutes for the scout troop to materialize, then enable the selective baseline and create the two approved custom scouts.
- [ ] Set up the two Replay Vision monitors after the shared scanner briefs and scanner inventory endpoint are available; they should cover the form-completion flow and frustration/rage-click sessions without widening their scopes.

## What happens next
Fresh Self-driving checks are normally picked up by the coordinator within about 30 minutes. Scout runs draw from the confirmed daily budget, reports cluster in the inbox, and immediately actionable findings can begin coding tasks.