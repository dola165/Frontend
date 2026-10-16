import { useState, type FormEvent } from 'react';
import type { PageView } from '../api';
import { usePagesCopy } from '../copy';
import { usePageEdit } from '../edit/context';
import type { QuickStep } from './quick';

/**
 * The answer box under Dola's line, ready to type into: the likely answer is already in it (the account's phone, the
 * fees clubs nearby charge). Enter saves; the step gets done and she walks on.
 */
export function QuickAnswer({ step, page, onDone }: { step: QuickStep; page: PageView; onDone: () => void }) {
  const t = usePagesCopy();
  const { saveIdentity, saveBox } = usePageEdit();
  const suggested = page.suggestions?.fees;
  const [text, setText] = useState(() => (step === 'name' ? page.identity.name : step === 'about' ? page.identity.about ?? '' : step === 'contact' ? page.identity.contact.phone || page.suggestions?.phone || '' : ''));
  const [min, setMin] = useState(String(page.boxes.fees.band?.min ?? suggested?.min ?? ''));
  const [max, setMax] = useState(String(page.boxes.fees.band?.max ?? suggested?.max ?? ''));
  const [saving, setSaving] = useState(false);

  const save = async (free = false) => {
    if (saving) return;
    const value = text.trim();
    setSaving(true);
    try {
      if (step === 'name' && value.length >= 2) await saveIdentity({ name: value }, { label: t('Name saved') });
      if (step === 'about' && value) await saveIdentity({ about: value }, { label: t('About saved') });
      if (step === 'contact' && value) await saveIdentity({ contact: { phone: value, email: page.identity.contact.email } }, { label: t('Contact saved') });
      if (step === 'fees') {
        const low = Math.max(0, Number(min) || 0), high = Math.max(low, Number(max) || low);
        await saveBox('fees', { band: free ? { min: 0, max: 0, currency: 'GEL', period: 'MONTH', free: 'ALL' } : { min: low, max: high, currency: 'GEL', period: 'MONTH', free: 'NONE' } }, { label: t('Fees saved') });
      }
      onDone();
    } finally { setSaving(false); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void save(); };

  return (
    <form className="gk-pet__quick" onSubmit={submit}>
      {step === 'fees'
        ? <span className="gk-pet__fees">
            <input className="gk-pet__input" inputMode="numeric" value={min} onChange={event => setMin(event.target.value.replace(/\D/g, ''))} aria-label={t('From')} placeholder={t('From')} autoFocus />
            <span aria-hidden="true">–</span>
            <input className="gk-pet__input" inputMode="numeric" value={max} onChange={event => setMax(event.target.value.replace(/\D/g, ''))} aria-label={t('To')} placeholder={t('To')} />
            <span className="gk-pet__unit">₾</span>
          </span>
        : <input className="gk-pet__input" value={text} onChange={event => setText(event.target.value)} autoFocus
            type={step === 'contact' ? 'tel' : 'text'} autoComplete={step === 'contact' ? 'tel' : 'off'} maxLength={step === 'about' ? 160 : 120}
            aria-label={t(step === 'contact' ? 'Phone' : step === 'about' ? 'About' : 'Name')} placeholder={t(step === 'contact' ? '+995 5XX XX XX XX' : step === 'about' ? 'Say what you are, in one sentence' : 'Name your page')} />}
      <span className="gk-pet__actions">
        <button type="submit" className="gk-pet__action gk-pet__action--main" disabled={saving}>{t('Save')}</button>
        {step === 'fees' && <button type="button" className="gk-pet__action" disabled={saving} onClick={() => void save(true)}>{t('Free')}</button>}
      </span>
    </form>
  );
}
