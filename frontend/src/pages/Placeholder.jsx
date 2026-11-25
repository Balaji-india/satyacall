// Simple message page (used for unknown URLs). Shows no data on purpose.
export default function Placeholder({ title, description }) {
  return (
    <section className="glass p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-600">{description}</p>
    </section>
  )
}
