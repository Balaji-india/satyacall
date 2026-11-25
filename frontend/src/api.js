// api.js — one small function per backend endpoint (docs/PLAN.md §5).
// The browser only ever talks to OUR backend; the DetectifAI key stays there.
// No mock or fallback data: if the backend fails, the caller gets an Error.

const BASE = import.meta.env.VITE_API_URL

// Shared fetch helper. On non-2xx it throws an Error with:
//   err.status — HTTP status (422 = "too little speech", free, show as "skipped")
//   err.body   — parsed JSON body (or raw text) from the backend
async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  const text = await res.text()
  let body = text
  try { body = text ? JSON.parse(text) : null } catch { /* not JSON, keep text */ }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} on ${path}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

// POST a JSON body.
const postJson = (path, data) =>
  request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })

// POST multipart form: audio goes in field "file" as clip.webm, plus extra text fields.
function postAudio(path, blob, fields = {}) {
  const form = new FormData()
  form.append('file', blob, 'clip.webm')
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) form.append(key, String(value))
  }
  return request(path, { method: 'POST', body: form })
}

// True when the backend said "not enough speech in this clip" (free, not an error).
export const isInsufficientSpeech = (err) => err?.status === 422

// GET /api/health → { ok, detectif_reachable, credits_balance }
export const getHealth = () => request('/api/health')

// POST /api/people/enroll — formFields: { person_id, display_name, role, phone? | employee_id?, department? }
// → { person_id, speaker_id, samples, speech_seconds }
export const enrollPerson = (formFields, fileBlob) => postAudio('/api/people/enroll', fileBlob, formFields)

// GET /api/people → [ { person_id, speaker_id, display_name, role, ... samples } ]
export const listPeople = () => request('/api/people')

// POST /api/calls — direction "inbound" | "outbound" (outbound writes the bank call log)
// → { call_id, started_at }
export const startCall = ({ direction, claimed_customer_id, agent_id }) =>
  postJson('/api/calls', { direction, claimed_customer_id, agent_id })

// POST /api/calls/{id}/end → { ended_at }
export const endCall = (callId) => request(`/api/calls/${callId}/end`, { method: 'POST' })

// POST /api/calls/{id}/clip — one complete 10 s webm clip + its position in the call (seconds)
// → ClipResult { status, call_state, identity, authenticity, speaker, credits_balance, ... }
export const sendClip = (callId, blob, t_start, t_end) =>
  postAudio(`/api/calls/${callId}/clip`, blob, { t_start, t_end })

// POST /api/calls/{id}/action — { action_type, params: { payee_name?, amount?, ... } }
// → { risk: "low"|"high", decision: "allow"|"say_it_back"|"fallback", sentence? }
export const requestAction = (callId, { action_type, params = {} }) =>
  postJson(`/api/calls/${callId}/action`, { action_type, params })

// POST /api/calls/{id}/say-it-back — customer repeats the sentence; attempt 1 or 2
// → { pass, transcript, expected, text_match, authenticity, speaker, next_step }
export const sayItBack = (callId, blob, attempt) =>
  postAudio(`/api/calls/${callId}/say-it-back`, blob, { attempt })

// GET /api/calls/{id} → { call, clips, actions, say_it_back, state }
export const getCall = (callId) => request(`/api/calls/${callId}`)

// GET /api/calls/{id}/evidence is a file download, so we just build the URL for an <a href>.
export const evidenceUrl = (callId) => `${BASE}/api/calls/${callId}/evidence`

// POST /api/verify-caller — customer records the "bank" caller on speakerphone
// → { verified, checks: { call_log, speaker, authenticity }, employee, next_step }
export const verifyCaller = (blob, employee_id, customer_id) =>
  postAudio('/api/verify-caller', blob, { employee_id, customer_id })

// POST /api/feedback — "Was this right?" → forwarded to DetectifAI feedback (free)
export const sendFeedback = ({ operation_id, correct, label, note }) =>
  postJson('/api/feedback', { operation_id, correct, label, note })
