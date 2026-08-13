// Place at: src/CreateQuizRoom.jsx
// Room setup -> AI question generation -> review/edit -> open the lobby.
// Two-step UI backed by two separate edge functions: create-quiz-room makes
// the room itself (state='setup'), generate-quiz-questions/manage-quiz-
// questions handle everything about the question set from then on, both
// gated to setup-phase server-side regardless of what this page shows.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from './Toast'
import { invokeQuiz } from './quizApi'

const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed']
const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'mixed', label: 'Mixed' },
]
const DURATIONS = [10, 20, 30, 60]

function emptyQuestionDraft(q) {
  return { prompt: q.prompt, options: [...q.options], correct_option_index: q.correct_option_index, explanation: q.explanation || '' }
}

function CreateQuizRoom() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [step, setStep] = useState('setup')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '', topic: '', question_count: 10, difficulty: 'medium', question_type: 'mcq', time_per_question_seconds: 20,
  })
  const [roomId, setRoomId] = useState(null)
  const [code, setCode] = useState(null)

  const [aiPrompt, setAiPrompt] = useState('')
  const [questions, setQuestions] = useState([])
  const [generating, setGenerating] = useState(false)
  const [regeneratingIndex, setRegeneratingIndex] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)

  async function handleCreateRoom(e) {
    e.preventDefault()
    if (!form.name.trim()) return showToast('Room name is required', 'error')
    setSaving(true)
    try {
      const { room_id, code } = await invokeQuiz('create-quiz-room', form)
      setRoomId(room_id)
      setCode(code)
      setStep('generate')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate() {
    if (!aiPrompt.trim()) return showToast('Describe what the quiz should cover', 'error')
    setGenerating(true)
    try {
      const { questions: generated } = await invokeQuiz('generate-quiz-questions', {
        room_id: roomId, action: 'generate_batch', prompt: aiPrompt.trim(),
      })
      setQuestions(generated)
      setStep('review')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerateAll() {
    setGenerating(true)
    try {
      const { questions: generated } = await invokeQuiz('generate-quiz-questions', {
        room_id: roomId, action: 'generate_batch', prompt: aiPrompt.trim(),
      })
      setQuestions(generated)
      showToast('Questions regenerated', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerateOne(index) {
    setRegeneratingIndex(index)
    try {
      const { question } = await invokeQuiz('generate-quiz-questions', {
        room_id: roomId, action: 'regenerate_one', index, prompt: aiPrompt.trim(),
      })
      setQuestions(qs => qs.map(q => q.idx === index ? question : q).sort((a, b) => a.idx - b.idx))
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setRegeneratingIndex(null)
    }
  }

  async function handleDelete(questionId) {
    try {
      await invokeQuiz('manage-quiz-questions', { room_id: roomId, action: 'delete', question_id: questionId })
      setQuestions(qs => qs.filter(q => q.id !== questionId).map((q, i) => ({ ...q, idx: i })))
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  function startEdit(q) {
    setEditingId(q.id)
    setDraft(emptyQuestionDraft(q))
  }

  async function saveEdit(questionId) {
    try {
      const { question } = await invokeQuiz('manage-quiz-questions', {
        room_id: roomId, action: 'update', question_id: questionId, ...draft,
      })
      setQuestions(qs => qs.map(q => q.id === questionId ? question : q))
      setEditingId(null)
      setDraft(null)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleOpenLobby() {
    if (!questions.length) return showToast('Generate at least one question first', 'error')
    setSaving(true)
    try {
      await invokeQuiz('advance-quiz-room', { room_id: roomId, action: 'open_lobby' })
      navigate(`/lab/quiz/room/${roomId}/admin`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (step === 'setup') {
    return (
      <div className="page">
        <h1>Create Quiz Room</h1>
        <form onSubmit={handleCreateRoom} className="card" style={{ padding: '1.3rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <label>
            Quiz Room Name
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Friday Data Challenge" style={{ width: '100%', marginTop: '0.3rem' }} />
          </label>
          <label>
            Quiz Topic
            <input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="Data Analytics" style={{ width: '100%', marginTop: '0.3rem' }} />
          </label>
          <label>
            Number of Questions (1–20)
            <input type="number" min={1} max={20} value={form.question_count} onChange={e => setForm({ ...form, question_count: Number(e.target.value) })} style={{ width: '100%', marginTop: '0.3rem' }} />
          </label>
          <label>
            Difficulty
            <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} style={{ width: '100%', marginTop: '0.3rem' }}>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
            </select>
          </label>
          <label>
            Question Type
            <select value={form.question_type} onChange={e => setForm({ ...form, question_type: e.target.value })} style={{ width: '100%', marginTop: '0.3rem' }}>
              {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label>
            Time per Question
            <select value={form.time_per_question_seconds} onChange={e => setForm({ ...form, time_per_question_seconds: Number(e.target.value) })} style={{ width: '100%', marginTop: '0.3rem' }}>
              {DURATIONS.map(d => <option key={d} value={d}>{d} seconds</option>)}
            </select>
          </label>
          <button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Next: Generate Questions'}</button>
        </form>
      </div>
    )
  }

  if (step === 'generate') {
    return (
      <div className="page">
        <h1>{form.name}</h1>
        <p style={{ color: 'var(--color-muted)' }}>Room code <strong style={{ fontFamily: 'monospace' }}>{code}</strong></p>
        <div className="card" style={{ padding: '1.3rem' }}>
          <label>
            🤖 Generate with AI
            <textarea
              value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              placeholder={`Create a ${form.question_count}-question quiz about ${form.topic || 'this topic'} for beginners`}
              rows={4} style={{ width: '100%', marginTop: '0.3rem', resize: 'vertical' }}
            />
          </label>
          <button onClick={handleGenerate} disabled={generating} style={{ marginTop: '0.8rem' }}>
            {generating ? 'Generating...' : '🤖 Generate with AI'}
          </button>
        </div>
      </div>
    )
  }

  // step === 'review'
  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>{form.name}</h1>
        <span style={{ color: 'var(--color-muted)', fontFamily: 'monospace' }}>{code}</span>
      </div>

      <div className="toolbar-row" style={{ margin: '0.5rem 0 1.2rem' }}>
        <button className="secondary" onClick={handleRegenerateAll} disabled={generating}>
          {generating ? 'Regenerating...' : '🔄 Regenerate All'}
        </button>
        <button onClick={handleOpenLobby} disabled={saving}>{saving ? 'Opening...' : 'Open Lobby →'}</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {questions.map(q => (
          <div key={q.id} className="card" style={{ padding: '1rem' }}>
            {editingId === q.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <textarea value={draft.prompt} onChange={e => setDraft({ ...draft, prompt: e.target.value })} rows={2} style={{ width: '100%' }} />
                {draft.options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="radio" checked={draft.correct_option_index === i}
                      onChange={() => setDraft({ ...draft, correct_option_index: i })}
                    />
                    <input
                      value={opt} style={{ flex: 1 }}
                      onChange={e => setDraft({ ...draft, options: draft.options.map((o, oi) => oi === i ? e.target.value : o) })}
                    />
                  </div>
                ))}
                <input value={draft.explanation} onChange={e => setDraft({ ...draft, explanation: e.target.value })} placeholder="Explanation" style={{ width: '100%' }} />
                <div className="toolbar-row">
                  <button onClick={() => saveEdit(q.id)}>Save</button>
                  <button className="secondary" onClick={() => { setEditingId(null); setDraft(null) }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <strong>Q{q.idx + 1}. {q.prompt}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{q.difficulty}</span>
                </div>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
                  {q.options.map((opt, i) => (
                    <li key={i} style={{ color: i === q.correct_option_index ? 'var(--status-good)' : 'inherit', fontWeight: i === q.correct_option_index ? 600 : 400 }}>
                      {opt}{i === q.correct_option_index ? ' ✓' : ''}
                    </li>
                  ))}
                </ul>
                <div className="toolbar-row" style={{ marginTop: '0.7rem' }}>
                  <button className="secondary" onClick={() => startEdit(q)}>Edit</button>
                  <button className="secondary" onClick={() => handleRegenerateOne(q.idx)} disabled={regeneratingIndex === q.idx}>
                    {regeneratingIndex === q.idx ? 'Regenerating...' : 'Regenerate'}
                  </button>
                  <button className="secondary" onClick={() => handleDelete(q.id)} style={{ color: '#c0392b' }}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default CreateQuizRoom
