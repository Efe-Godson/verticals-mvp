// The 4-screen onboarding flow itself - shared by the Lab page and the
// full-screen "Simulate" popup. Runs on the shared Conditional Flow Engine
// (src/flow); nothing here writes to Supabase or touches signup.
//
// Each step is its own screen (paged, not one long form). Conditional
// questions fade in as their condition becomes true. Changing an earlier
// answer re-resolves everything downstream, including Page 4's recommendations.
import { useEffect, useMemo, useState } from 'react'
import { useFlow } from '../../flow/useFlow'
import { onboardingFlow } from './onboardingFlow'
import { buildFocusSummary, buildRecommendations } from './recommendations'
import { RecIcon } from './recIcons'

const STYLES = `
.ob-card {
  display: flex; align-items: flex-start; gap: 0.6rem; width: 100%;
  padding: 0.95rem 1.05rem; border-radius: 14px; text-align: left; cursor: pointer;
  border: 1px solid var(--color-border); background: var(--color-surface);
  color: var(--color-text); box-shadow: var(--shadow);
  transition: transform 150ms ease, border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}
.ob-card:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--color-primary); box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
.ob-card:disabled { opacity: 0.45; cursor: not-allowed; }
/* Selected: a bold ring + a light, theme-safe tint (10% of the theme colour
   over the surface) so the muted supporting text stays readable whatever
   the business's theme colour is. */
.ob-card[aria-pressed="true"] {
  border-color: var(--color-primary);
  box-shadow: inset 0 0 0 1px var(--color-primary);
  background: var(--color-surface);
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
}
.ob-grid { display: grid; gap: 0.7rem; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
.ob-field { animation: ob-reveal 260ms ease both; }
@keyframes ob-reveal { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .ob-field { animation: none; } }
`

function Tick({ on, round }) {
  return (
    <span aria-hidden="true" style={{
      width: 18, height: 18, flexShrink: 0, borderRadius: round ? '50%' : 5, marginTop: 1,
      border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
      background: on ? 'var(--color-primary)' : 'transparent',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontSize: 11, lineHeight: 1,
    }}>{on ? '✓' : ''}</span>
  )
}

function Field({ field, value, onSet, onToggle, hideLabel = false }) {
  const isMulti = field.type === 'multiselect'
  const arr = Array.isArray(value) ? value : []
  const atMax = field.maxSelect && arr.length >= field.maxSelect

  return (
    <div className="ob-field" style={{ marginBottom: '1.6rem' }}>
      {!hideLabel && field.label && (
        <label style={{ display: 'block', fontWeight: 600, fontSize: '1.02rem', marginBottom: field.help ? 2 : '0.6rem' }}>
          {field.label}
          {field.required && <span style={{ color: 'var(--status-critical)', marginLeft: 4 }}>*</span>}
        </label>
      )}
      {!hideLabel && field.help && <p style={{ margin: '0 0 0.7rem', fontSize: '0.86rem', color: 'var(--color-muted)' }}>{field.help}</p>}

      {field.type === 'text' ? (
        <input
          type="text" value={value || ''} onChange={(e) => onSet(e.target.value)}
          placeholder={field.placeholder}
          style={{ width: '100%', maxWidth: 440, boxSizing: 'border-box' }}
        />
      ) : field.options.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: 0 }}>Pick an answer above first.</p>
      ) : (
        <>
          <div className="ob-grid">
            {field.options.map((opt) => {
              const selected = isMulti ? arr.includes(opt.value) : value === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  className="ob-card"
                  aria-pressed={selected}
                  disabled={isMulti && !selected && atMax}
                  onClick={() => (isMulti ? onToggle(opt.value) : onSet(selected ? '' : opt.value))}
                >
                  <Tick on={selected} round={!isMulti} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.94rem' }}>{opt.label}</span>
                    {opt.help && <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{opt.help}</span>}
                  </span>
                </button>
              )
            })}
          </div>
          {field.maxSelect && (
            <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0.5rem 0 0' }}>
              {arr.length} of {field.maxSelect} selected
            </p>
          )}
        </>
      )}
    </div>
  )
}

// Step 5: no questions. The payoff - the moment Verticals shows it understood.
function ResultScreen({ answers }) {
  const focus = useMemo(() => buildFocusSummary(answers), [answers])
  const recs = useMemo(() => buildRecommendations(answers), [answers])

  return (
    <div className="ob-field" style={{ marginBottom: '1.8rem' }}>
      <div style={{
        border: '1px solid var(--color-border)', borderRadius: 14, padding: '1.1rem 1.2rem',
        background: 'var(--color-primary-soft)', marginBottom: '1.7rem',
      }}>
        <div style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700 }}>
          Your main focus
        </div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0' }}>{focus.mainFocusLabel}</div>
        {focus.otherLabels.length > 0 && (
          <div style={{ fontSize: '0.86rem', color: 'var(--color-muted)' }}>
            Also interested in {focus.otherLabels.join(' · ')}
          </div>
        )}
      </div>

      <div style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700, marginBottom: '0.8rem' }}>
        What you'll get
      </div>
      {recs.length === 0 ? (
        <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>
          Answer the earlier steps and you'll see what Verticals can show you here.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {recs.map((r) => (
            <div key={r.key} style={{
              display: 'flex', gap: '0.9rem', alignItems: 'flex-start',
              border: '1px solid var(--color-border)', borderRadius: 14,
              padding: '1rem 1.1rem', background: 'var(--color-surface)', boxShadow: 'var(--shadow)',
            }}>
              <RecIcon name={r.iconKey} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: '1.02rem' }}>{r.title}</span>
                <span style={{ display: 'block', fontSize: '0.87rem', color: 'var(--color-muted)', marginTop: 3, lineHeight: 1.5 }}>{r.blurb}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const isAnswered = (field, answers) => {
  const v = answers[field.id]
  return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== ''
}

export default function OnboardingScreens({ onComplete, onAnswersChange, footerNote, initialAnswers }) {
  const { answers, resolved, setAnswer, toggleAnswer } = useFlow(onboardingFlow, { initialAnswers })
  const [qIndex, setQIndex] = useState(0)

  useEffect(() => { onAnswersChange?.(answers) }, [answers, onAnswersChange])

  // Prefill the custom workflow name from what they typed on Step 1, but
  // leave it editable (only fills when still empty).
  const picksCustomWorkflow = Array.isArray(answers.workflow_template) && answers.workflow_template.includes('custom')
  useEffect(() => {
    if (picksCustomWorkflow && !answers.workflow_name && answers.custom_interest_name) {
      setAnswer('workflow_name', answers.custom_interest_name)
    }
  }, [picksCustomWorkflow]) // eslint-disable-line react-hooks/exhaustive-deps

  // One question per screen: flatten every visible field across the steps
  // into an ordered list, then the result step (no fields) as the final
  // screen. The list re-derives as answers change, so conditional questions
  // slot in / drop out in place.
  const screens = useMemo(() => {
    const list = []
    for (const step of resolved.steps) {
      if (step.fields.length === 0) list.push({ step, field: null })
      else for (const field of step.fields) list.push({ step, field })
    }
    return list
  }, [resolved])

  const idx = Math.min(qIndex, screens.length - 1)
  const { step, field } = screens[idx]
  const isLast = idx === screens.length - 1
  const isResult = !field

  // Question number within the whole flow (skip the result screen).
  const totalQuestions = screens.filter((s) => s.field).length
  const questionNo = screens.slice(0, idx + 1).filter((s) => s.field).length

  const canAdvance = isResult || !field.required || isAnswered(field, answers)

  // exclusiveValue + maxSelect handling for multi-select fields.
  function handleToggle(f, optValue) {
    const cur = Array.isArray(answers[f.id]) ? answers[f.id] : []
    const ex = f.exclusiveValue
    if (ex) {
      if (optValue === ex) { setAnswer(f.id, cur.includes(ex) ? [] : [ex]); return }
      const withoutEx = cur.filter((v) => v !== ex)
      setAnswer(f.id, cur.includes(optValue) ? withoutEx.filter((v) => v !== optValue) : [...withoutEx, optValue])
      return
    }
    if (f.maxSelect && !cur.includes(optValue) && cur.length >= f.maxSelect) return
    toggleAnswer(f.id, optValue)
  }

  const navBtn = { minHeight: 44, padding: '0 1.2rem' }
  const go = (n) => setQIndex(Math.max(0, Math.min(n, screens.length - 1)))

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <style>{STYLES}</style>

      {/* progress: one continuous bar across every question */}
      <div style={{ height: 6, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden', marginBottom: '1.6rem' }}>
        <div style={{
          height: '100%', borderRadius: 999, background: 'var(--color-primary)',
          width: `${((idx + 1) / screens.length) * 100}%`, transition: 'width 200ms ease',
        }} />
      </div>

      <div style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
        {isResult ? step.eyebrow : `Question ${questionNo} of ${totalQuestions}`}
      </div>

      {isResult ? (
        <>
          <h2 style={{ margin: '0.3rem 0 0.4rem', fontSize: 'clamp(1.35rem, 3vw, 1.8rem)', lineHeight: 1.2 }}>{step.title}</h2>
          {step.description && <p style={{ margin: '0 0 1.6rem', color: 'var(--color-muted)', fontSize: '0.95rem' }}>{step.description}</p>}
          <ResultScreen answers={answers} />
        </>
      ) : (
        <div key={field.id} className="ob-field">
          <h2 style={{ margin: '0.3rem 0 0.35rem', fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', lineHeight: 1.25 }}>
            {field.label}
            {field.required && <span style={{ color: 'var(--status-critical)', marginLeft: 4 }}>*</span>}
          </h2>
          {field.help && <p style={{ margin: '0 0 1.4rem', color: 'var(--color-muted)', fontSize: '0.92rem' }}>{field.help}</p>}
          {!field.help && <div style={{ height: '1.1rem' }} />}
          <Field
            field={field}
            value={answers[field.id]}
            onSet={(v) => setAnswer(field.id, v)}
            onToggle={(v) => handleToggle(field, v)}
            hideLabel
          />
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.7rem',
        marginTop: '1.5rem', paddingTop: '1.1rem', borderTop: '1px solid var(--color-border)',
      }}>
        {idx > 0 ? (
          <button type="button" className="secondary" style={navBtn} onClick={() => go(idx - 1)}>← Back</button>
        ) : (
          <span aria-hidden="true" />
        )}
        {isLast ? (
          <button type="button" style={{ ...navBtn, minHeight: 48 }} onClick={() => onComplete?.(answers)}>
            {step.ctaLabel || 'Create my Verticals account →'}
          </button>
        ) : (
          <button type="button" style={navBtn} disabled={!canAdvance} onClick={() => go(idx + 1)}>
            {idx === screens.length - 2 ? (step.ctaLabel || 'Continue →') : 'Continue →'}
          </button>
        )}
      </div>

      {isLast && (
        <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '0.7rem' }}>
          You can add more businesses, workflows and reports anytime.
        </p>
      )}
      {footerNote}
    </div>
  )
}
