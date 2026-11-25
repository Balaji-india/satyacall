// useMonitoring — B3: trust monitoring of one call on /agent.
// Start → POST /api/calls + WebSocket. While live, the customer's voice (remoteStream) is cut
// into 10 s clips and uploaded one at a time. End → drop the partial clip, finish the queue,
// POST /end, close the WebSocket. Every value shown comes from a backend response.
import { useEffect, useRef, useState } from 'react'
import { endCall, errorText, isInsufficientSpeech, sendClip, startCall } from './api'
import { startClipRecorder } from './clipRecorder'
import { connectCallWS } from './ws'

export function useMonitoring(remoteStream) {
  const [phase, setPhase] = useState('idle')     // idle → starting → live → ending → ended
  const [callId, setCallId] = useState(null)
  const [paused, setPaused] = useState(false)
  const [results, setResults] = useState({})     // clip_id → ClipResult (HTTP + WS merged, no duplicates)
  const [uploads, setUploads] = useState([])     // our clips with no ClipResult yet: queued / uploading / failed
  const [latest, setLatest] = useState(null)     // most recent ClipResult (for credits_balance)
  const [callState, setCallState] = useState(null)
  const [stateReason, setStateReason] = useState('')
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
    setLatest(r)
    if (r.call_state) setCallState(r.call_state)
  }

  const onWsMessage = ({ type, data }) => {
    if (type === 'clip_result') addResult(data)
    if (type === 'state_change') { setCallState(data.to); setStateReason(data.reason ?? '') }
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
  // Note: onClip / uploadClip / addResult / end only use refs and state setters, so the copy
  // from any render behaves the same — safe to hand to the recorder and to effects.

  // "Start monitoring": create the call on the backend, then open the WebSocket.
  const start = async ({ claimed_customer_id, agent_id }) => {
    setError('')
    setPhase('starting')
    try {
      const { call_id } = await startCall({ direction: 'inbound', claimed_customer_id, agent_id })
      // Fresh session (a previous call's results are cleared).
      setResults({}); setUploads([]); setLatest(null); setCallState(null); setStateReason('')
      setLastClip(null); setPaused(false)
      pausedRef.current = false
      endingRef.current = false
      queueRef.current = Promise.resolve()
      callIdRef.current = call_id
      t0Ref.current = performance.now()
      closeWsRef.current = connectCallWS(call_id, onWsMessage, setWsStatus)
      setCallId(call_id)
      setPhase('live')
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

  // "End call" (button, or the PeerJS call ended).
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

  // One list for the UI, in call order: backend results + our own pending / failed uploads.
  const rows = [
    ...Object.values(results).map((result) => ({ key: result.clip_id, t_start: result.t_start, t_end: result.t_end, result })),
    ...uploads,
  ].sort((a, b) => a.t_start - b.t_start)

  return {
    phase, callId, paused, rows, latest, callState, stateReason, lastClip, wsStatus, error,
    start, end, togglePause,
  }
}
