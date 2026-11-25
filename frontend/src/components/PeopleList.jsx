// PeopleList — everyone enrolled, exactly as GET /api/people returns them.
// `people` = array | null (loading); `error` = text; `onRefresh` reloads.
import { CloudOff, RotateCw, Users } from 'lucide-react'

export default function PeopleList({ people, error, onRefresh }) {
  const loading = people === null && !error
  return (
    <section className="space-y-3 border-t border-line pt-5">
      <div className="flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Users aria-hidden="true" className="h-5 w-5 text-accent" />Enrolled people</h2>
        <button onClick={onRefresh} disabled={loading} className="btn-ghost px-3 py-1.5 text-base">
          <RotateCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-warn/50 bg-warn/10 p-3 text-base">
          <CloudOff aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warn-fg" />
          <span className="min-w-0 break-words"><b className="text-warn-fg">Could not load the list.</b> {error}</span>
        </p>
      )}
      {people?.length === 0 && <p className="text-base text-muted">Nobody enrolled yet — record a voice sample above to add the first person.</p>}

      {people?.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-base">
            <thead className="bg-inset text-muted">
              <tr><th className="px-3 py-2 font-medium">Name</th><th className="px-3 font-medium">speaker_id</th><th className="px-3 font-medium">Role</th><th className="px-3 font-medium">Phone / employee</th><th className="px-3 font-medium">Samples</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {people.map((p) => (
                <tr key={p.person_id}>
                  <td className="px-3 py-2 font-semibold">{p.display_name}</td>
                  <td className="px-3 font-mono">{p.speaker_id}</td>
                  <td className="px-3 capitalize">{p.role}</td>
                  <td className="px-3 font-mono">{p.role === 'agent' ? `${p.employee_id ?? '—'} · ${p.department ?? '—'}` : p.phone ?? '—'}</td>
                  <td className="px-3 font-mono">{p.samples ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
