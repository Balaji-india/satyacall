// PeopleList — everyone enrolled, exactly as GET /api/people returns them.
// `people` = array | null (loading); `error` = text; `onRefresh` reloads.

export default function PeopleList({ people, error, onRefresh }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Enrolled people</h2>
        <button onClick={onRefresh} disabled={people === null && !error}
          className="rounded border px-3 py-1 text-sm disabled:opacity-40">
          {people === null && !error ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">Could not load the list: {error}</p>}
      {people?.length === 0 && <p className="text-sm text-slate-500">Nobody enrolled yet — record a voice sample above to add the first person.</p>}

      {people?.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="border-b text-slate-500">
            <tr><th className="py-1">Name</th><th>speaker_id</th><th>Role</th><th>Phone / employee</th><th>Samples</th></tr>
          </thead>
          <tbody className="divide-y">
            {people.map((p) => (
              <tr key={p.person_id}>
                <td className="py-1">{p.display_name}</td>
                <td className="font-mono">{p.speaker_id}</td>
                <td>{p.role}</td>
                <td>{p.role === 'agent' ? `${p.employee_id ?? '—'} · ${p.department ?? '—'}` : p.phone ?? '—'}</td>
                <td>{p.samples ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
