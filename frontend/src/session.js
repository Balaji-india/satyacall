// session.js — DEMO sign-in only (B10). A real bank keeps its existing login; this just lets the
// demo say "who is using this device". Session = { role, person_id, display_name, employee_id? }
// in sessionStorage (per browser tab, gone when the tab closes). People come from GET /api/people.

const KEY = 'satyacall.session'

// SHA-256 (hex) of the shared demo password. The plain password is never written in code.
export const DEMO_PASSWORD_SHA256 = 'd74ff0ee8da3b9806b18c877dbf29bbde50b5bd8e4dad7a3a725000feb82e8f1'

// Where each role signs in, and where it lands afterwards.
export const LOGIN_PATH = { customer: '/customer/login', agent: '/agent/login' }
export const HOME_PATH = { customer: '/customer', agent: '/agent' }

// Read the session; null if none, unreadable, or storage is blocked (e.g. private mode).
export function getSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    return s && typeof s.role === 'string' && typeof s.person_id === 'string' ? s : null
  } catch {
    return null
  }
}

// True if saved. False → storage blocked; the caller shows a message.
export function saveSession(session) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
    return true
  } catch {
    return false
  }
}

export function clearSession() {
  try { sessionStorage.removeItem(KEY) } catch { /* nothing stored */ }
}

// Hash the typed password with the browser's crypto.subtle and compare with the stored hash.
// crypto.subtle only exists on https or localhost (same rule as the microphone).
export async function checkDemoPassword(password) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Sign-in needs https or localhost — this browser blocks crypto on plain http.')
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return hex === DEMO_PASSWORD_SHA256
}
