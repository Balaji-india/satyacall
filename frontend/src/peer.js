// peer.js — create a PeerJS peer + turn PeerJS / mic errors into plain sentences.
// Default: the free PeerJS cloud server (0.peerjs.com).
// If that's blocked, run `npx peer --port 9000` on one laptop and set
// VITE_PEER_HOST (that laptop's IP) + VITE_PEER_PORT=9000 in frontend/.env.
import Peer from 'peerjs'

const HOST = import.meta.env.VITE_PEER_HOST
const PORT = import.meta.env.VITE_PEER_PORT
// VITE_PEER_LAN_ONLY=true → no STUN/TURN servers: only direct host candidates (same hotspot /
// same laptop), so call audio can never go through PeerJS's internet relay. Signalling unchanged.
export const LAN_ONLY = import.meta.env.VITE_PEER_LAN_ONLY === 'true'
export const LAN_FAILED_TEXT = 'Direct connection failed — check both devices are on the same hotspot.'

// Peer ids live on the PUBLIC PeerJS cloud, so they carry a "satyacall-" prefix to avoid
// clashing with other people's apps. Agent desk = one fixed id; customers = prefix + their id.
export const AGENT_PEER_ID = 'satyacall-agent-desk'
export const customerPeerId = (customerId) => `satyacall-customer-${customerId}`

export function createPeer(id) {
  const options = LAN_ONLY ? { config: { iceServers: [] } } : {}
  if (HOST) Object.assign(options, { host: HOST, port: Number(PORT) || 9000, path: '/' })
  return new Peer(id, options)
}

// Which network path the call really uses, from RTCPeerConnection.getStats(): the selected
// candidate pair → local/remote candidateType + currentRoundTripTime. null = not known yet.
export async function readLink(pc) {
  if (!pc) return null
  const stats = await pc.getStats()
  let pair = null
  stats.forEach((s) => { if (s.type === 'transport' && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId) })
  if (!pair) stats.forEach((s) => { if (s.type === 'candidate-pair' && s.state === 'succeeded' && (s.selected || s.nominated)) pair = s })
  if (!pair) return null
  const local = stats.get(pair.localCandidateId)?.candidateType
  const remote = stats.get(pair.remoteCandidateId)?.candidateType
  const rttMs = pair.currentRoundTripTime == null ? null : Math.round(pair.currentRoundTripTime * 1000)
  return { local, remote, rttMs }
}

// Same rule PeerJS uses for ids: letters/digits, with single - _ or space between them.
export const isValidPeerId = (id) => /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.test(id)

// PeerJS error → message for the status line. myId = our id, otherId = who we tried to call.
export function peerErrorText(err, myId, otherId) {
  switch (err?.type) {
    case 'unavailable-id':
      return `Peer id "${myId}" is already taken — is this page open in another tab?` +
        (HOST ? '' : ' (On the public PeerJS cloud someone else may hold it: use a local peer server.)')
    case 'peer-unavailable':
      return `The other side is offline — nobody is online as "${otherId}".`
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return `Peer server unreachable (${HOST ? `${HOST}:${PORT}` : '0.peerjs.com'}). ` +
        'Check the network, or run `npx peer --port 9000` and set VITE_PEER_HOST / VITE_PEER_PORT.'
    case 'invalid-id':
      return `"${myId}" is not a valid peer id (letters, digits, - or _ only).`
    case 'negotiation-failed':
      return LAN_ONLY ? LAN_FAILED_TEXT : `Call connection failed (${err?.message ?? 'ICE failed'}).`
    case 'browser-incompatible':
      return 'This browser does not support WebRTC calls. Use Chrome or Edge.'
    default:
      return `Call error (${err?.type ?? 'unknown'}): ${err?.message ?? err}`
  }
}

// getUserMedia error → message.
export function micErrorText(err) {
  switch (err?.name) {
    case 'NotAllowedError':
      return 'Microphone permission denied — allow the mic (icon in the address bar) and try again.'
    case 'NotFoundError':
      return 'No microphone found on this device.'
    case 'NotReadableError':
      return 'The microphone is busy in another app.'
    default:
      return `Could not open the microphone: ${err?.message ?? err}`
  }
}
