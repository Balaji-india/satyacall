// toWav.js — turn a recorded audio blob (our webm/opus clip) into a 16 kHz, mono, 16-bit PCM WAV.
// Used only for Say-It-Back: the backend's speech-to-text step wants plain WAV. Timeline clips,
// enroll and /app keep sending webm. Everything runs in the browser with the Web Audio API.

const TARGET_RATE = 16000 // samples per second

// blob (webm, ogg, mp4…) → Blob of type audio/wav, 16 kHz mono 16-bit.
export async function toWav16kMono(blob) {
  const bytes = await blob.arrayBuffer()

  // 1. Decode the compressed audio into raw samples. decodeAudioData needs a context; an
  //    OfflineAudioContext never opens the speakers, so we use a tiny throwaway one.
  let decoded
  try {
    decoded = await new OfflineAudioContext(1, 1, TARGET_RATE).decodeAudioData(bytes)
  } catch (err) {
    throw new Error(`could not decode the recording to convert it to WAV (${err?.message ?? err})`)
  }
  if (!decoded.length) throw new Error('the recording is empty — nothing to convert to WAV')

  // 2. Resample to 16 kHz and mix down to 1 channel: render the decoded buffer through an
  //    OfflineAudioContext that has exactly 1 output channel at 16000 Hz. The browser does the
  //    resampling, and its standard down-mix averages the channels (stereo → (L + R) / 2).
  const length = Math.ceil(decoded.duration * TARGET_RATE)
  const offline = new OfflineAudioContext(1, length, TARGET_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()

  // 3. Wrap the float samples (−1..1) in a WAV file as 16-bit integers.
  return new Blob([encodeWav(rendered.getChannelData(0), TARGET_RATE)], { type: 'audio/wav' })
}

// Float32 samples → ArrayBuffer holding a complete WAV file (44-byte header + PCM data).
function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2 // 16-bit
  const dataSize = samples.length * bytesPerSample
  const view = new DataView(new ArrayBuffer(44 + dataSize))
  const writeText = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)) }

  // RIFF/WAVE header — all numbers little-endian (the `true` argument).
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)            // file size minus the first 8 bytes
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)                      // size of this fmt block
  view.setUint16(20, 1, true)                       // format 1 = PCM (uncompressed)
  view.setUint16(22, 1, true)                       // channels: 1 (mono)
  view.setUint32(24, sampleRate, true)              // samples per second
  view.setUint32(28, sampleRate * bytesPerSample, true) // bytes per second (mono)
  view.setUint16(32, bytesPerSample, true)          // bytes per sample frame (mono)
  view.setUint16(34, 16, true)                      // bits per sample
  writeText(36, 'data')
  view.setUint32(40, dataSize, true)

  // Samples: clamp to −1..1, then scale to the signed 16-bit range.
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * bytesPerSample, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return view.buffer
}
