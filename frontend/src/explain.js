// explain.js — turns REAL response fields into rows and one plain-English sentence for the UI
// ("3 signals", "Checks in order", "How it decided"). Nothing here decides anything new: the
// backend's pass / verified / next_step / verdict / decision stay the answer; this only words them.
// Numbers are printed exactly as the backend sent them.
import { checkErrorText } from './api'

// Say-It-Back's text-match rule (docs/PLAN.md §3: token_set_ratio/100 ≥ 0.85). The response has
// text_match but no threshold, so the rule's number is shown next to it. It only labels the
// Words row when the backend's own fields can't tell which check failed (see wordsTone).
export const TEXT_MATCH_MIN = 0.85

const show = (v) => (v == null ? '—' : String(v))

// Aletheia authenticity → { tone, word, metric }
export function realHuman(a) {
  if (!a || a.verdict === 'not_checked') return { tone: 'skip', word: 'Not checked', metric: '' }
  if (a.verdict === 'error') return { tone: 'warn', word: 'Unavailable', metric: checkErrorText(a.error) }
  const fakeParts = (a.segments ?? []).filter((s) => s.verdict === 'fake').length
  return {
    tone: a.verdict === 'real' ? 'pass' : a.verdict === 'fake' ? 'stop' : 'skip',
    word: a.verdict === 'real' ? 'Real human' : a.verdict === 'fake' ? 'AI voice' : show(a.verdict),
    metric: `AI score ${show(a.score)} vs ${show(a.threshold)}` + (fakeParts ? ` · ${fakeParts}/${a.segments.length} parts fake` : ''),
  }
}

// Eidos speaker → { tone, word, metric }
export function samePerson(s, notCheckedWord = 'Not checked') {
  if (!s || s.decision === 'not_checked') return { tone: 'skip', word: notCheckedWord, metric: '' }
  if (s.decision === 'error') return { tone: 'warn', word: 'Unavailable', metric: checkErrorText(s.error) }
  return {
    tone: s.decision === 'match' ? 'pass' : 'stop',
    word: s.decision === 'match' ? 'Match' : 'No match',
    metric: `similarity ${show(s.similarity)} vs ${show(s.threshold)}`,
  }
}

// Words row: overall pass ⇒ words passed. Not passed while voice AND realness both passed ⇒ the
// words are what failed. Otherwise fall back to the documented rule number.
function wordsTone(r) {
  if (r.text_match == null) return 'skip'
  if (r.pass === true) return 'pass'
  if (r.speaker?.decision === 'match' && r.authenticity?.verdict === 'real') return 'stop'
  return r.text_match >= TEXT_MATCH_MIN ? 'pass' : 'stop'
}

// Say-It-Back result → the 3 signals, in the order the agent reads them.
export function sayItBackSignals(r) {
  const wt = wordsTone(r)
  return [
    { key: 'words', name: 'Words', hint: 'said the sentence', tone: wt,
      word: wt === 'pass' ? 'Matched' : wt === 'stop' ? 'Different' : 'No result',
      metric: r.text_match == null ? '' : `text match ${r.text_match} vs ${TEXT_MATCH_MIN}` },
    { key: 'person', name: 'Same person', hint: 'Eidos voice match', ...samePerson(r.speaker) },
    { key: 'human', name: 'Real human', hint: 'Aletheia', ...realHuman(r.authenticity) },
  ]
}

const listText = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

export function sayItBackWhy(r) {
  const signals = sayItBackSignals(r)
  if (r.pass) {
    return 'Passed — the customer said the sentence, the voice matched the enrolled customer, and Aletheia heard a real human.'
  }
  const failed = signals.filter((s) => s.tone !== 'pass').map((s) => ({
    words: 'the words did not match the sentence',
    person: s.tone === 'warn' ? 'the voice match was unavailable' : s.tone === 'skip' ? 'the voice match did not run' : 'the voice did not match the enrolled customer',
    human: s.tone === 'warn' ? 'the real-voice check was unavailable' : s.tone === 'skip' ? 'the real-voice check did not run' : 'Aletheia flagged an AI voice',
  })[s.key])
  const next = r.next_step === 'retry' ? ' One more attempt is allowed.'
    : r.next_step === 'fallback' ? ' No attempts left, so the request falls back.' : ''
  return `Not passed — ${listText(failed) || 'the backend marked it not passed'}.${next}`
}

// Verify-caller → the 3 checks in the order the backend runs them.
export function verifySteps(result) {
  const { checks = {} } = result
  const log = checks.call_log
  const noRecord = log?.pass === false
  const skippedWord = noRecord ? 'Skipped' : 'Not checked'
  const speaker = samePerson(checks.speaker, skippedWord)
  const human = realHuman(checks.authenticity)
  if (human.tone === 'skip') human.word = skippedWord
  const skippedDetail = noRecord ? 'skipped — no call record' : 'not run'
  return [
    { key: 'log', name: 'Bank call log', hint: 'Is this employee calling you right now?',
      tone: !log ? 'skip' : log.pass === true ? 'pass' : log.pass === false ? 'stop' : 'skip',
      word: !log ? 'No result' : log.pass === true ? 'Call found' : log.pass === false ? 'No record' : 'No result',
      metric: log?.detail ?? '' },
    { key: 'voice', name: 'Voice match', hint: "Is it the employee's enrolled voice?",
      ...speaker, metric: speaker.tone === 'skip' ? skippedDetail : speaker.metric },
    { key: 'human', name: 'Real human', hint: 'Is it a person, not an AI voice?',
      ...human, metric: human.tone === 'skip' ? skippedDetail : human.metric },
  ]
}

export function verifyWhy(result, employeeId) {
  const who = result.employee?.name ?? `employee ${employeeId}`
  const [log, voice, human] = verifySteps(result)
  if (result.verified) {
    return `Verified — the bank's call log shows ${who} calling you, the voice matches their enrolled voice, and it is a real human voice.`
  }
  if (log.tone !== 'pass') {
    return `Not verified — the bank has no record of ${who} calling you right now${voice.tone === 'skip' ? ', so the voice was not checked' : ''}. Without a call record, a voice alone is never enough.`
  }
  const reasons = []
  if (voice.tone !== 'pass') reasons.push(voice.tone === 'stop' ? `the voice does not match ${who}'s enrolled voice` : 'the voice match could not be completed')
  if (human.tone !== 'pass') reasons.push(human.tone === 'stop' ? 'the voice sounds AI-generated' : 'the real-voice check could not be completed')
  return `Not verified — the call log has the call, but ${listText(reasons) || 'the backend did not confirm it'}.`
}
