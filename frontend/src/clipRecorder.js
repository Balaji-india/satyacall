// clipRecorder.js — cuts a live MediaStream into complete 10 s audio clips.
//
// Why a NEW MediaRecorder per clip: with start(timeslice) only the first chunk has the WebM
// header, so every later chunk is an invalid file and the API rejects it. A fresh recorder per
// clip means every Blob is a complete, playable .webm file.

export const CLIP_SECONDS = 10
const MIME = 'audio/webm;codecs=opus'

// Seconds since `t0` (a performance.now() timestamp), 1 decimal.
const secondsSince = (t0) => Math.round((performance.now() - t0) / 100) / 10

// Start recording `stream` in back-to-back clips.
//   t0      — performance.now() when monitoring started (t_start / t_end are relative to it)
//   onClip  — called with (blob, t_start, t_end) for every COMPLETE clip
//   onError — called with a message if recording can't run
// Returns { stop() }: stops recording and DISCARDS the unfinished clip.
export function startClipRecorder(stream, t0, onClip, onError) {
  let stopped = false
  let timer = null
  let current = null // the MediaRecorder recording right now

  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(MIME)) {
    onError(`This browser can't record ${MIME}. Use Chrome or Edge.`)
    return { stop() {} }
  }

  const recordOneClip = () => {
    if (stopped) return
    const recorder = new MediaRecorder(stream, { mimeType: MIME })
    const parts = []
    const t_start = secondsSince(t0)
    let t_end = null // set only when OUR timer ends the clip → marks it as complete

    recorder.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data) }

    // onstop also fires if the stream dies mid-clip (call hung up). Only clips that our
    // 10 s timer finished are sent; anything else is a partial clip and is dropped.
    recorder.onstop = () => {
      if (t_end === null) return
      onClip(new Blob(parts, { type: MIME }), t_start, t_end)
    }
    recorder.onerror = (e) => onError(`Recorder error: ${e.error?.message ?? e.error ?? 'unknown'}`)

    recorder.start() // no timeslice: the whole clip arrives as one complete file in onstop
    current = recorder

    timer = setTimeout(() => {
      t_end = secondsSince(t0)
      if (recorder.state !== 'inactive') recorder.stop() // → onstop builds and hands over the Blob
      startNext()                                         // next clip starts right away (no gap)
    }, CLIP_SECONDS * 1000)
  }

  // e.g. the stream already ended → new MediaRecorder / start() throws.
  const startNext = () => {
    try {
      recordOneClip()
    } catch (err) {
      onError(`Could not start recording: ${err.message ?? err}`)
    }
  }

  startNext()

  return {
    stop() {
      stopped = true
      clearTimeout(timer)
      // Unfinished clip: t_end is still null, so its onstop drops it.
      if (current && current.state !== 'inactive') current.stop()
    },
  }
}

// Record ONE complete clip of `stream` (Say-It-Back confirmation) with its own new MediaRecorder.
//   onTick(secondsLeft) — called every second for the countdown
// Resolves with the Blob after `seconds`; rejects if the recording stops early (call dropped),
// because a partial clip must never be sent.
export function recordClip(stream, seconds, onTick = () => {}) {
  return new Promise((resolve, reject) => {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(MIME)) {
      return reject(new Error(`This browser can't record ${MIME}. Use Chrome or Edge.`))
    }
    const recorder = new MediaRecorder(stream, { mimeType: MIME })
    const parts = []
    let left = seconds
    let complete = false // true only when OUR timer ended the recording

    const ticker = setInterval(() => onTick(--left), 1000)
    const timer = setTimeout(() => {
      complete = true
      if (recorder.state !== 'inactive') recorder.stop()
    }, seconds * 1000)

    recorder.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data) }
    recorder.onstop = () => {
      clearInterval(ticker)
      clearTimeout(timer)
      if (complete) resolve(new Blob(parts, { type: MIME }))
      else reject(new Error('Recording stopped early (did the call drop?) — nothing was sent.'))
    }
    recorder.onerror = (e) => reject(new Error(`Recorder error: ${e.error?.message ?? e.error ?? 'unknown'}`))

    onTick(left)
    try {
      recorder.start() // no timeslice → one complete .webm file
    } catch (err) {
      clearInterval(ticker)
      clearTimeout(timer)
      reject(new Error(`Could not start recording: ${err.message ?? err}`))
    }
  })
}
