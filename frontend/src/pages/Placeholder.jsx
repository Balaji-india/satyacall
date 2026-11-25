// Simple message page (used for unknown URLs). Shows no data on purpose.
import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function Placeholder({ title, description }) {
  return (
    <section className="card mx-auto max-w-xl space-y-3 p-8 text-center">
      <Compass aria-hidden="true" className="mx-auto h-10 w-10 text-accent" />
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-base text-muted">{description}</p>
      <Link to="/" className="btn-primary px-4 py-2.5">Go to the start page</Link>
    </section>
  )
}
