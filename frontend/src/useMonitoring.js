// useMonitoring — trust monitoring of one call on /agent (B3 + B4).
// Start → POST /api/calls + WebSocket. While live, the customer's voice (remoteStream) is cut
// into 10 s clips and uploaded one at a time. End → drop the partial clip, finish the queue,
// POST /end, close the WebSocket. Every value shown comes from a backend response.
import { useEffect, useRef, useState } from 'react'
import { endCall, errorText, getHealth, isInsufficientSpeech, sendClip, startCall } from './api'
import { startClipRecorder } from './clipRecorder'
import { connectCallWS } from './ws'

// Say-It-Back results come twice (HTTP response + WebSocket) → one key to merge them.
// The contract has no result id, so use DetectifAI's operation ids, else the result's own text.
const sayItBackKey = (r) =>
  r.authenticity?.operation_id ?? r.speaker?.operation_id ?? JSON.stringify([r.expected, r.transcript, r.next_step])

export function useMonitoring(remoteStream) {
  const [phase, setPhase] = useState('idle')     // idle → starting → live → ending → ended
  const [callId, setCallId] = useState(null)
  const [direction, setDirection] = useState(null) // direction sent for the current call
  const [paused, setPaused] = useState(false)
  const [holding, setHolding] = useState(false)  // true while Say-It-Back owns the call (timeline paused)
  const [results, setResults] = useState({})     // clip_id → ClipResult (HTTP + WS merged, no duplicates)
  const [uploads, setUploads] = useState([])     // our clips with no ClipResult yet: queued / uploading / failed
  const [sayItBacks, setSayItBacks] = useState([]) // Say-It-Back results in arrival order (HTTP + WS merged)
  const [callState, setCallState] = useState(null)
  const [stateReason, setStateReason] = useState('')
  const [identity, setIdentity] = useState(null) // not_checked | match | no_match (latest clip or Say-It-Back)
  const [credits, setCredits] = useState(null)   // latest credits_balance any backend response reported
  const [lastClip, setLastClip] = useState(null) // { blob, t_start, t_end } for "Download last clip"
  const [wsStatus, setWsStatus] = useState('')
  const [error, setError] = useState('')

  // Refs: read by the recorder callback and the upload queue, which outlive a single render.
  const callIdRef = useRef(null)
  const t0Ref = useRef(0)                        // performance.now() when monitoring started
  const queueRef = useRef(Promise.resolve())     // upload queue: each upload waits for the previous one
  const recorderRef = useRef(null)
  const closeWsRef = useRef(null)
  const pausedRef = useRef(false)
  const endingRef = useRef(false)
  const nextKeyRef = useRef(0)

  // A ClipResult arrived (HTTP response or WebSocket) → store it by clip_id.
  const addResult = (r) => {
    setResults((prev) => ({ ...prev, [r.clip_id]: r }))
    if (r.call_state) setCallState(r.call_state)
    if (r.identity) setIdentity(r.identity)
    if (r.credits_balance != null) setCredits(r.credits_balance)
  }

  // A Say-It-Back result arrived (HTTP or WebSocket) → merge by key, update identity / credits.
  const addSayItBack = (r) => {
    const key = sayItBackKey(r)
    setSayItBacks((prev) => {
      const i = prev.findIndex((x) => x.key === key)
      if (i === -1) return [...prev, { ...r, key }]
      return prev.map((x, j) => (j === i ? { ...x, ...r, key } : x))
    })
    const decision = r.speaker?.decision
    if (decision === 'match' || decision === 'no_match') setIdentity(decision)
    if (r.credits_balance != null) setCredits(r.credits_balance)
  }

  const onWsMessage = ({ type, data }) => {
    if (type === 'clip_result') addResult(data)
    if (type === 'state_change') { setCallState(data.to); setStateReason(data.reason ?? '') }
    if (type === 'say_it_back_result') addSayItBack(data)
  }

  // Upload one clip. Never throws, so one failed upload doesn't stop the queue or the recording.
  const uploadClip = async (id, key, blob, t_start, t_end) => {
    const patch = (fields) => setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...fields } : u)))
    if (pausedRef.current) return patch({ state: 'not-sent' }) // paused while waiting: save the credits
    patch({ state: 'uploading' })
    try {
      addResult(await sendClip(id, blob, t_start, t_end))
      setUploads((prev) => prev.filter((u) => u.key !== key)) // now shown from `results`
    } catch (err) {
      patch({ state: isInsufficientSpeech(err) ? 'skipped' : 'error', error: errorText(err) })
    }
  }

  // The recorder finished a complete clip → keep it for download and put it in the queue.
  const onClip = (blob, t_start, t_end) => {
    if (endingRef.current) return // never upload after /end (backend answers 409)
    const key = ++nextKeyRef.current
    const id = callIdRef.current
    setLastClip({ blob, t_start, t_end })
    setUploads((prev) => [...prev, { key, t_start, t_end, state: 'queued' }])
    queueRef.current = queueRef.current.then(() => uploadClip(id, key, blob, t_start, t_end))
  }
  // Note: these functions only use refs and state setters, so the copy from any render behaves
  // the same — safe to hand to the recorder, the WebSocket and effects.

  // "Start monitoring": create the call on the backend, then open the WebSocket.
  // direction: 'outbound' only when the agent placed the call (backend then writes the bank call log).
  const start = async ({ direction = 'inbound', claimed_customer_id, agent_id }) => {
    setError('')
    setPhase('starting')
    try {
      const { call_id } = await startCall({ direction, claimed_customer_id, agent_id })
      setDirection(direction)
      // Fresh session (a previous call's results are cleared).
      setResults({}); setUploads([]); setSayItBacks([]); setCallState(null); setStateReason('')
      setIdentity(null); setCredits(null); setLastClip(null); setPaused(false); setHolding(false)
      pausedRef.current = false
      endingRef.current = false
      queueRef.current = Promise.resolve()
      callIdRef.current = call_id
      t0Ref.current = performance.now()
      closeWsRef.current = connectCallWS(call_id, onWsMessage, setWsStatus)
      setCallId(call_id)
      setPhase('live')
      // Starting credit balance = the backend's last real value (no clip result yet). Best effort.
      getHealth().then((h) => setCredits((c) => c ?? h.credits_balance ?? null)).catch(() => {})
    } catch (err) {
      setError(`Could not start monitoring: ${errorText(err)}`)
      setPhase('idle')
    }
  }

  // Record while live, not paused and the customer's audio exists. Pausing, ending or losing
  // the stream runs the cleanup → recorder stops and the partial clip is discarded.
  // Resume = this effect runs again = a fresh clip.
  useEffect(() => {
    if (phase !== 'live' || paused || !remoteStream) return
    recorderRef.current = startClipRecorder(remoteStream, t0Ref.current, onClip, setError)
    return () => { recorderRef.current?.stop(); recorderRef.current = null }
  }, [phase, paused, remoteStream])

  // "End call" (button, Hang up, or the PeerJS call ended).
  const end = async () => {
    if (endingRef.current || !callIdRef.current) return
    endingRef.current = true
    recorderRef.current?.stop() // stop now, discard the partial clip
    setPhase('ending')
    await queueRef.current      // let full clips already queued finish first
    try {
      await endCall(callIdRef.current)
    } catch (err) {
      setError(`End call failed: ${errorText(err)}`)
    }
    closeWsRef.current?.()
    closeWsRef.current = null
    setPhase('ended')
  }

  // PeerJS call ended (no more customer audio) while monitoring → end the backend call too.
  // (Syncing with an external event — the WebRTC call closing — so state updates here are intended.)
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (phase === 'live' && !remoteStream) end()
  }, [phase, remoteStream])

  // Leaving the page mid-call: stop everything and tell the backend (best effort).
  useEffect(() => () => {
    recorderRef.current?.stop()
    closeWsRef.current?.()
    if (callIdRef.current && !endingRef.current) {
      endingRef.current = true
      endCall(callIdRef.current).catch(() => {})
    }
  }, [])

  const togglePause = () => {
    pausedRef.current = !paused
    setPaused(!paused)
  }

  // Say-It-Back: run fn() with the timeline paused, so only ONE request is in flight per call.
  // Pause (the current partial clip is discarded) → wait for an upload in flight → fn() →
  // restore the pause setting the agent had before.
  const withTimelinePaused = async (fn) => {
    const wasPaused = pausedRef.current
    pausedRef.current = true
    setPaused(true)
    setHolding(true)
    try {
      await queueRef.current
      return await fn()
    } finally {
      pausedRef.current = wasPaused
      setPaused(wasPaused)
      setHolding(false)
    }
  }

  // One list for the UI, in call order: backend results + our own pending / failed uploads.
  const rows = [
    ...Object.values(results).map((result) => ({ key: result.clip_id, t_start: result.t_start, t_end: result.t_end, result })),
    ...uploads,
  ].sort((a, b) => a.t_start - b.t_start)

  return {
    phase, callId, direction, paused, holding, rows, sayItBacks, callState, stateReason, identity, credits,
    lastClip, wsStatus, error,
    start, end, togglePause, withTimelinePaused, addSayItBack,
  }
}
