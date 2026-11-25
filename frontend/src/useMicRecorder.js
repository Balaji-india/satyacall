// useMicRecorder — record ONE long sample from the local mic (enrollment, B5).
// One MediaRecorder for the whole recording → one complete .webm file. Stops by itself after
// maxSeconds, or earlier with stop(). onDone(blob, seconds) gets the finished recording.
// audio = getUserMedia audio constraints (default true; /app turns off echo cancellation etc.).
import { useEffect, useRef, useState } from 'react'
import { micErrorText } from './peer'

const MIME = 'audio/webm;codecs=opus'

export function useMicRecorder(maxSeconds, onDone, audio = true) {
  const [starting, setStarting] = useState(false) // waiting for mic permission → disable the button
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)  // whole seconds recorded so far (for the countdown)
  const [error, setError] = useState('')
  const recorderRef = useRef(null)
  const discardRef = useRef(false)            // true on unmount: don't hand over a recording

  // Leaving the page mid-recording: stop and release the mic, keep nothing.
  // (Set false on mount too: StrictMode runs mount → cleanup → mount in dev.)
  useEffect(() => {
    discardRef.current = false
    return () => {
      discardRef.current = true
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    }
  }, [])

  const start = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) return setError('Microphone needs https or http://localhost.')
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(MIME)) {
      return setError(`This browser can't record ${MIME}. Use Chrome or Edge.`)
    }
    setStarting(true)
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio })
    } catch (err) {
      setStarting(false)
      return setError(micErrorText(err))
    }
    setStarting(false)
    const releaseMic = () => stream.getTracks().forEach((t) => t.stop()) // mic light off
    if (discardRef.current) return releaseMic() // page left while the permission prompt was open

    let recorder
    try {
      recorder = new MediaRecorder(stream, { mimeType: MIME })
    } catch (err) {
      releaseMic()
      return setError(`Could not start recording: ${err.message ?? err}`)
    }
    const parts = []
    let t0 = 0
    let ticker = null
    let timer = null

    recorder.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data) }
    recorder.onstop = () => {
      clearInterval(ticker)
      clearTimeout(timer)
      releaseMic()
      recorderRef.current = null
      setRecording(false)
      if (discardRef.current) return
      // Real recorded length (webm from MediaRecorder has no duration header to read later).
      const seconds = Math.round((performance.now() - t0) / 100) / 10
      onDone(new Blob(parts, { type: MIME }), seconds)
    }
    recorder.onerror = (e) => setError(`Recorder error: ${e.error?.message ?? e.error ?? 'unknown'}`)

    try {
      recorder.start() // no timeslice → one complete file
    } catch (err) {
      releaseMic()
      return setError(`Could not start recording: ${err.message ?? err}`)
    }
    t0 = performance.now()
    ticker = setInterval(() => setElapsed(Math.floor((performance.now() - t0) / 1000)), 250)
    timer = setTimeout(() => recorder.state === 'recording' && recorder.stop(), maxSeconds * 1000)
    recorderRef.current = recorder
    setElapsed(0)
    setRecording(true)
  }

  // "Stop" — ends early; the recording so far is kept (the page warns if it's too short).
  const stop = () => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() }

  return { starting, recording, elapsed, error, start, stop }
}
