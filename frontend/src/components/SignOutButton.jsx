// "Sign out" for both headers: clear the demo session, go to that role's sign-in page.
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { clearSession, LOGIN_PATH } from '../session'

export default function SignOutButton({ role, className = '' }) {
  const navigate = useNavigate()
  const signOut = () => {
    clearSession()
    navigate(LOGIN_PATH[role], { replace: true })
  }
  return (
    <button type="button" onClick={signOut}
      className={`btn-ghost px-3 py-2 text-base ${className}`}>
      <LogOut aria-hidden="true" className="h-4 w-4" />
      Sign out
    </button>
  )
}
