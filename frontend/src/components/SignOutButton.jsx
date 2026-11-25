// "Sign out" for both headers: clear the demo session, go to that role's sign-in page.
import { useNavigate } from 'react-router-dom'
import { clearSession, LOGIN_PATH } from '../session'

export default function SignOutButton({ role, className = '' }) {
  const navigate = useNavigate()
  const signOut = () => {
    clearSession()
    navigate(LOGIN_PATH[role], { replace: true })
  }
  return (
    <button type="button" onClick={signOut}
      className={`rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white ${className}`}>
      Sign out
    </button>
  )
}
