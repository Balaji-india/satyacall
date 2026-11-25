// Sign-up page frame (/enroll?signup=customer|agent): SatyaBank wordmark + "Back to sign in".
// No agent links and no backend status — a new customer should not see the agent desk.
import { Link } from 'react-router-dom'
import { ShieldIcon } from '../components/Icons'
import { LOGIN_PATH } from '../session'

export default function SignupLayout({ role, children }) {
  return (
    <div className="min-h-screen text-ink">
      <header className="border-b border-white/10 bg-paper/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-stamp/20 text-stamp glow-stamp"><ShieldIcon /></span>
          <span className="text-xl font-bold tracking-tight font-stretch-expanded">SatyaBank</span>
          {role === 'agent' && <span className="text-xl text-white/75 font-stretch-condensed">Staff</span>}
          <Link to={LOGIN_PATH[role]} className="ml-auto text-sm text-white/70 underline hover:text-white">Back to sign in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4">{children}</main>
    </div>
  )
}
