// Sign-up page frame (/enroll?signup=customer|agent): SatyaBank wordmark + "Back to sign in".
// Customer sign-up uses the light SatyaBank app look; staff sign-up the dark desk look.
// No agent links and no backend status — a new customer should not see the agent desk.
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { LogoMark } from '../components/Icons'
import { LOGIN_PATH } from '../session'

export default function SignupLayout({ role, children }) {
  const agent = role === 'agent'
  return (
    <div className={`${agent ? 'theme-dark desk-bg' : 'theme-light bg-mist'} min-h-screen`}>
      <header className={`border-b ${agent ? 'border-white/10 bg-navy/90' : 'border-line bg-white'}`}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <LogoMark className="h-9 w-9" />
          <span className={`font-display text-xl font-extrabold tracking-tight ${agent ? 'text-white' : 'text-navy'}`}>SatyaBank</span>
          {agent && <span className="rounded-md border border-tide/50 bg-tide/10 px-2 py-0.5 text-[15px] font-semibold text-tide">Staff</span>}
          <Link to={LOGIN_PATH[role]} className="ml-auto inline-flex items-center gap-2 text-base font-medium text-muted hover:underline">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4">{children}</main>
    </div>
  )
}
