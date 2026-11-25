// / — pick what this laptop plays in the demo. The page is one sentence split in two:
// "This device is… the customer's phone | the bank's agent desk". Each half is the button.
import { Link } from 'react-router-dom'

const HALF = 'group flex flex-col justify-end gap-3 p-8 sm:p-12 focus-visible:outline focus-visible:outline-4 focus-visible:-outline-offset-8'

export default function DeviceChooser() {
  return (
    <main className="relative grid min-h-screen md:grid-cols-2">
      <h1 className="absolute left-8 top-8 text-2xl text-ink sm:left-12 sm:top-12">This device is…</h1>

      <Link to="/customer" className={`${HALF} bg-paper pt-28 text-ink focus-visible:outline-stamp`}>
        <span className="text-5xl font-bold leading-none font-stretch-expanded group-hover:underline sm:text-6xl">
          the customer’s phone
        </span>
        <span className="max-w-sm text-lg text-ink/70">Call the bank, or check that someone calling you really is from the bank.</span>
      </Link>

      <Link to="/agent" className={`${HALF} bg-ink text-white focus-visible:outline-white`}>
        <span className="text-5xl font-bold leading-none font-stretch-expanded group-hover:underline sm:text-6xl">
          the bank’s agent desk
        </span>
        <span className="max-w-sm text-lg text-white/70">Take customer calls and see, clip by clip, whether the voice can be trusted.</span>
      </Link>
    </main>
  )
}
