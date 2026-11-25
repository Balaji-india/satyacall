// ws.js — live updates for one call from the backend (docs/PLAN.md §5, WebSocket).
// Server sends JSON { type, data } where type is:
//   "clip_result" | "state_change" | "say_it_back_result"

const WS_BASE = import.meta.env.VITE_WS_URL

// Opens ws://<backend>/ws/calls/{callId}; calls onMessage({ type, data }) for every message.
// Returns close() — call it when the call ends or the page unmounts.
export function connectCallWS(callId, onMessage) {
  const socket = new WebSocket(`${WS_BASE}/ws/calls/${callId}`)

  socket.onmessage = (event) => {
    try {
      const { type, data } = JSON.parse(event.data)
      onMessage({ type, data })
    } catch (err) {
      console.error('[ws] bad message', event.data, err)
    }
  }
  socket.onerror = (event) => console.error('[ws] error on call', callId, event)
  socket.onclose = (event) => console.info('[ws] closed', callId, event.code)

  return () => socket.close()
}
