// checkText.js — the backend's Check fields → one plain sentence each (PLAN §5 Check object).
// Used by the timeline tooltip, the clip list and the Say-It-Back card, so the wording is the
// same everywhere. Only values from the response are printed; nothing is rounded into a verdict.
import { checkErrorText } from './api'

// authenticity = { verdict: real|fake|error, score, threshold, segments, error }  (Aletheia)
export function authenticityText(a) {
  if (!a) return 'no result'
  if (a.verdict === 'error') return `check unavailable — ${checkErrorText(a.error)}`
  const fakeParts = (a.segments ?? []).filter((s) => s.verdict === 'fake').length
  return `${a.verdict} — score ${a.score} vs threshold ${a.threshold ?? '?'} (higher = more likely AI)` +
    (fakeParts ? ` · ${fakeParts} of ${a.segments.length} segments fake` : '')
}

// speaker = { decision: match|no_match|not_checked|error, similarity, threshold, error }  (Eidos)
export function speakerText(s, notCheckedText = 'not checked') {
  if (!s || s.decision === 'not_checked') return notCheckedText
  if (s.decision === 'error') return `check unavailable — ${checkErrorText(s.error)}`
  return `${s.decision} — similarity ${s.similarity} vs threshold ${s.threshold ?? '?'} (−1..1, not a %)`
}
