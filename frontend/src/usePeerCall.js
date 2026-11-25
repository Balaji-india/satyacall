// usePeerCall — one PeerJS voice call (used by /call and /agent).
// Status: offline → connecting → online → ringing → in-call → ended (still online, can call again).
import { useEffect, useRef, useState } from 'react'
import { createPeer, isValidPeerId, micErrorText, peerErrorText } from './peer'

export function usePeerCall() {
  const peerRef = useRef(null) // our Peer (connection to the signalling server)
  const micRef = useRef(null)  // our mic MediaStream (sent to the other side)
  const callRef = useRef(null) // current MediaConnection: incoming (ringing), outgoing or active

  const [status, setStatus] = useState('offline')
  const [myId, setMyId] = useState('')
  const [otherId, setOtherId] = useState('')        // who we're calling / talking to
  const [incoming, setIncoming] = useState(false)   // true = incoming call waiting for "Answer"
  const [direction, setDirection] = useState('')    // 'inbound' (they called us) | 'outbound' (we called)
  const [remoteStream, setRemoteStream] = useState(null) // OTHER side's audio (B3 records this)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')

  // We keep StrictMode. The Peer is created on a button click (not in an effect), and this
  // cleanup destroys it on unmount / route change / hot reload, so the server frees the id
  // and the next Peer("satyacall-agent-desk") doesn't fail with "unavailable-id".
  useEffect(() => () => {
    peerRef.current?.destroy()
    micRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  // Forget a call (only if it's still the current one) and show the given status.
  const dropCall = (call, nextStatus = 'ended') => {
    if (!call || callRef.current !== call) return
    callRef.current = null
    setIncoming(false)
    setRemoteStream(null)
    setStatus(nextStatus)
  }

  // Listen to a call's events (both directions).
  const watchCall = (call) => {
    callRef.current = call
    setOtherId(call.peer)
    call.on('stream', (stream) => {
      if (callRef.current !== call) return
      setRemoteStream(stream)
      setStatus('in-call')
      setError('') // connected → an old error ("other side is offline") is no longer true
    })
    call.on('close', () => dropCall(call))
    call.on('error', (err) => { setError(peerErrorText(err, peerRef.current?.id, call.peer)); dropCall(call) })
  }

  // "Go online": open the mic, then register `id` on the peer server.
  const goOnline = async (id) => {
    setError('')
    if (!isValidPeerId(id)) return setError(`"${id}" is not a valid id (letters, digits, - or _ only).`)
    if (!navigator.mediaDevices?.getUserMedia) {
      return setError('Microphone needs https or http://localhost — this page was opened over plain http.')
    }
    setStatus('connecting')
    try {
      micRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      setStatus('offline')
      return setError(micErrorText(err))
    }
    micRef.current.getAudioTracks().forEach((t) => { t.enabled = !muted })

    const peer = createPeer(id)
    peerRef.current = peer
    peer.on('open', (openId) => { setMyId(openId); setStatus('online'); setError('') })

    // Incoming call: ring and wait for "Answer". Busy → refuse it.
    peer.on('call', (call) => {
      if (callRef.current) return call.close()
      watchCall(call)
      setDirection('inbound')
      setIncoming(true)
      setStatus('ringing')
    })

    peer.on('error', (err) => {
      setError(peerErrorText(err, id, callRef.current?.peer))
      // Calling someone who isn't online: forget that call, we're still online.
      if (err.type === 'peer-unavailable') dropCall(callRef.current, 'online')
    })

    // Lost the signalling server (an active call keeps going, it's peer-to-peer). Retry in 3 s.
    peer.on('disconnected', () => {
      setTimeout(() => { if (!peer.destroyed && peer.disconnected) peer.reconnect() }, 3000)
    })

    // Peer destroyed (fatal error like "id taken", or unmount): back to offline, release the mic.
    peer.on('close', () => {
      if (peerRef.current !== peer) return
      peerRef.current = null
      micRef.current?.getTracks().forEach((t) => t.stop())
      micRef.current = null
      callRef.current = null
      setIncoming(false)
      setRemoteStream(null)
      setMyId('')
      setStatus('offline')
    })
  }

  // Call another peer id with our mic.
  const callPeer = (remoteId) => {
    setError('')
    const peer = peerRef.current
    if (!peer?.open) return setError('Go online first.')
    if (callRef.current) return setError('Already in a call — hang up first.')
    if (!isValidPeerId(remoteId)) return setError(`"${remoteId}" is not a valid id.`)
    const call = peer.call(remoteId, micRef.current)
    if (!call) return setError('Could not start the call (lost the peer server?). Try again.')
    watchCall(call)
    setDirection('outbound')
    setStatus('ringing')
  }

  // Answer the ringing incoming call with our mic.
  const answer = () => {
    if (!incoming || !callRef.current) return
    callRef.current.answer(micRef.current)
    setIncoming(false)
  }

  // Hang up (or decline): close the call only; mic and peer stay on for the next call.
  const hangUp = () => {
    const call = callRef.current
    dropCall(call)
    call?.close()
  }

  // Mute = disable our mic track (the call stays up).
  const toggleMute = () => {
    const next = !muted
    micRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next })
    setMuted(next)
  }

  return { status, myId, otherId, incoming, direction, remoteStream, muted, error, goOnline, callPeer, answer, hangUp, toggleMute }
}
