import { useId, useState } from 'react';
import type { PageView } from '../api';
import { usePageEdit } from '../edit/context';
import { useGuideTask } from './taskBridge';
import { useGuideCopy } from './copy';
import type { QuickStep } from './quick';

/** Inputs are prefilled, but only Next confirms and saves them. */
export function QuickAnswer({ step, page }: { step: QuickStep; page: PageView }) {
  const t = useGuideCopy();
  const { saveIdentity, saveBox } = usePageEdit();
  const suggested = page.suggestions?.fees;
  const [text, setText] = useState(() => step === 'name' ? page.identity.name : step === 'about' ? page.identity.about ?? '' : step === 'contact' ? page.identity.contact.phone || page.suggestions?.phone || '' : '');
  const [min, setMin] = useState(String(page.boxes.fees.band?.min ?? suggested?.min ?? ''));
  const [max, setMax] = useState(String(page.boxes.fees.band?.max ?? suggested?.max ?? ''));
  const [free, setFree] = useState(page.boxes.fees.band?.free === 'ALL');
  const id = useId();
  useGuideTask(`quick:${step}`, { next: async () => {
    const value = text.trim();
    let saved: unknown;
    if (step === 'name') {
      if (value.length < 2) return { status: 'stay', message: t('Enter a name with at least two letters.') };
      saved = await saveIdentity({ name: value });
    } else if (step === 'about') {
      if (!value) return { status: 'stay', message: t('Write one sentence about your club.') };
      saved = await saveIdentity({ about: value });
    } else if (step === 'contact') {
      if (!value || value.replace(/\D/g, '').length < 6) return { status: 'stay', message: t('Enter a phone number.') };
      saved = await saveIdentity({ contact: { phone: value, email: page.identity.contact.email } });
    } else {
      const low = Number(min), high = Number(max || min);
      if (!free && (!min.trim() || !Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high < low)) return { status: 'stay', message: t('Enter a valid fee range, or choose Free.') };
      saved = await saveBox('fees', { band: { min: free ? 0 : low, max: free ? 0 : high, currency: page.boxes.fees.band?.currency ?? suggested?.currency ?? 'GEL', period: 'MONTH', free: free ? 'ALL' : 'NONE' } });
    }
    return saved === true ? { status: 'complete' } : { status: 'stay', message: t('Not saved. Your answer is still here. Try Next again.') };
  } });
  const label = t(step === 'contact' ? 'Phone' : step === 'about' ? 'About' : 'Name');
  return <div className="gk-guide__quick">
    {step === 'fees' ? <>
      <label className="gk-guide__check"><input type="checkbox" checked={free} onChange={event => setFree(event.target.checked)} />{t('Free')}</label>
      {!free && <div className="gk-guide__fees" role="group" aria-label={t('Monthly fee, GEL')}>
        <label>{t('From')}<input inputMode="decimal" value={min} onChange={event => setMin(event.target.value)} /></label>
        <label>{t('To')}<input inputMode="decimal" value={max} onChange={event => setMax(event.target.value)} /></label><span>₾</span>
      </div>}
    </> : <><label htmlFor={id}>{label}</label>{step === 'about'
      ? <textarea id={id} value={text} onChange={event => setText(event.target.value)} maxLength={160} rows={3} />
      : <input id={id} value={text} onChange={event => setText(event.target.value)} type={step === 'contact' ? 'tel' : 'text'} autoComplete={step === 'contact' ? 'tel' : 'off'} maxLength={120} />}</>}
  </div>;
}
