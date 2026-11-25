// Placeholder page used until each screen is built (B2–B6). Shows no data on purpose.
export default function Placeholder({ title, task, description }) {
  return (
    <section className="rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-600">{description}</p>
      <p className="mt-4 text-sm text-slate-400">Coming in {task}.</p>
    </section>
  )
}
