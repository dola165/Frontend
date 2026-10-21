import { useState } from 'react';
import { usePagesCopy } from '../copy';
import type { SetupKey } from '../model/kinds';
import { askPet, type PetAnswer } from './api';

/** Optional existing sandbox help. Never invoked by the task runner or during automated verification. */
export function AskGuide({ onStep }: { onStep: (key: SetupKey) => void }) {
  const t = usePagesCopy();
  const [question, setQuestion] = useState(''), [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<PetAnswer | null>(null);
  const ask = async () => {
    if (busy || question.trim().length < 2) return;
    setBusy(true);
    try { setAnswer(await askPet(question.trim())); } finally { setBusy(false); }
  };
  return <details className="gk-guide__help"><summary>{t('Ask Dola')}</summary>
    <label>{t('Ask about setting up your page')}<input value={question} onChange={event => setQuestion(event.target.value)} maxLength={200} disabled={busy} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void ask(); } }} /></label>
    <button type="button" disabled={busy || question.trim().length < 2} onClick={() => void ask()}>{t(busy ? 'Thinking…' : 'Ask Dola')}</button>
    {answer?.answer && <p aria-live="polite">{answer.answer}</p>}
    {answer?.step && <button type="button" onClick={() => onStep(answer.step as SetupKey)}>{t('Open')}</button>}
  </details>;
}
