import { useId, useState } from 'react';
import { Button } from '../../../design/primitives';
import { SideBlock } from '../../../design/profile/ProfileLayout';
import type { FeeBand } from '../api';
import { usePagesCopy } from '../copy';
import { EditPencil } from '../edit/EditPencil';
import { usePageEdit } from '../edit/context';
import type { BoxProps } from '../edit/boxRegistry';
import { useKeepOnLeave } from '../edit/useKeepOnLeave';
import { feeBandText } from '../model/fees';
import '../edit/edit.css';

const STEP = 10, TOP = 500;

/** What training costs, lowest to highest group, as one line; edited in place with one range and "Free". */
export function FeesBox({ page, editing, open, onEdit, onClose }: BoxProps) {
  const t = usePagesCopy();
  const { saveBox } = usePageEdit();
  const band = page.boxes.fees.band;
  const text = feeBandText(band, { free: t('Free training'), month: t('month'), someFree: t('Some groups train free') });
  const persist = (next: FeeBand | null) => saveBox('fees', { band: next }, { label: t('Fees saved') });
  const save = async (next: FeeBand | null) => { if (await persist(next)) onClose(); };
  return (
    <SideBlock title={t(page.kind === 'FAN_CLUB' ? 'Membership' : 'Training fees')} hint={t(page.kind === 'FAN_CLUB' ? 'What members pay' : 'Lowest to highest group')} action={editing && !open ? <EditPencil onClick={onEdit} /> : undefined}>
      {open ? <FeeEditor initial={band} suggestion={page.suggestions?.fees ?? null} onSave={save} onKeep={next => void persist(next)} onCancel={onClose} />
        : text ? <p className="gk-club-fees"><strong className="gk-num">{text.range}</strong>{text.note && <span className="gk-muted">{text.note}</span>}</p> : <p className="gk-muted">{t('Ask the club about fees.')}</p>}
    </SideBlock>
  );
}

type Suggestion = NonNullable<NonNullable<BoxProps['page']['suggestions']>['fees']>;

/**
 * Nothing is priced until the owner says so: Free, the fee most clubs in the town ask (one tap), or a price of their
 * own on two sliders. Done stays off until one is chosen, so no amount is ever published by default.
 */
function FeeEditor({ initial, suggestion, onSave: done, onKeep, onCancel: cancel }: { initial: FeeBand | null; suggestion: Suggestion | null; onSave: (next: FeeBand | null) => Promise<void>; onKeep: (next: FeeBand | null) => void; onCancel: () => void }) {
  const t = usePagesCopy();
  const id = useId();
  const [mode, setMode] = useState<'free' | 'paid' | null>(!initial ? null : initial.free === 'ALL' ? 'free' : 'paid');
  const [someFree, setSomeFree] = useState(initial?.free === 'SOME');
  // Only a price the owner touched (Free, the usual fee, a slider moved) is kept when another box opens.
  const [chosen, setChosen] = useState(false);
  const [min, setMin] = useState(initial?.min ?? suggestion?.min ?? 30);
  const [max, setMax] = useState(initial?.max ?? suggestion?.max ?? 60);
  const currency = initial?.currency ?? suggestion?.currency ?? 'GEL';
  const band: FeeBand | null = mode === 'free' ? { min: 0, max: 0, currency, period: 'MONTH', free: 'ALL' } : mode === 'paid' ? { min, max, currency, period: 'MONTH', free: someFree ? 'SOME' : 'NONE' } : null;
  const text = feeBandText(band, { free: t('Free training'), month: t('month'), someFree: t('Some groups train free') });
  // Opening another box saves a price chosen here; only Cancel drops it.
  const settle = useKeepOnLeave(chosen ? band : null, next => next !== null && JSON.stringify(next) !== JSON.stringify(initial), onKeep);
  const onSave = (next: FeeBand | null) => { settle(); return done(next); };
  const onCancel = () => { settle(); cancel(); };
  const usual = !suggestion ? null : suggestion.town ? t('Most clubs in {town}: {min}–{max} {currency}', { town: suggestion.town, min: suggestion.min, max: suggestion.max, currency: suggestion.currency })
    : t('Most clubs in Georgia: {min}–{max} {currency}', { min: suggestion.min, max: suggestion.max, currency: suggestion.currency });
  return (
    <div className="gk-boxedit">
      <div className="gk-ctowns" role="group" aria-label={t('What does it cost?')}>
        <button type="button" className="gk-chip" aria-pressed={mode === 'free'} onClick={() => { setMode('free'); setChosen(true); }}>{t('Free')}</button>
        {suggestion && usual && <button type="button" className="gk-chip" aria-pressed={mode === 'paid' && min === suggestion.min && max === suggestion.max} onClick={() => { setMode('paid'); setMin(suggestion.min); setMax(suggestion.max); setChosen(true); }}>{usual}</button>}
        <button type="button" className="gk-chip" aria-pressed={mode === 'paid' && !(suggestion && min === suggestion.min && max === suggestion.max)} onClick={() => setMode('paid')}>{t('Set a price')}</button>
      </div>
      {mode === 'paid' && <div className="gk-fee" aria-live="polite">
        <div className="gk-fee__values"><span>{text?.range}</span></div>
        <label className="gk-field__label" htmlFor={`${id}-min`}>{t('From, a month')}</label>
        <input id={`${id}-min`} type="range" min={0} max={TOP} step={STEP} value={min} onChange={event => { const value = Number(event.target.value); setMin(value); setChosen(true); if (value > max) setMax(value); }} />
        <label className="gk-field__label" htmlFor={`${id}-max`}>{t('To, a month')}</label>
        <input id={`${id}-max`} type="range" min={0} max={TOP} step={STEP} value={max} onChange={event => { const value = Number(event.target.value); setMax(value); setChosen(true); if (value < min) setMin(value); }} />
        <label className="gk-row gk-fee__some"><input type="checkbox" checked={someFree} onChange={event => { setSomeFree(event.target.checked); setChosen(true); }} />{t('Some groups train free')}</label>
      </div>}
      <div className="gk-boxedit__foot">
        <Button size="sm" variant="primary" disabled={!band} onClick={() => void onSave(band)}>{t('Done')}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </div>
  );
}
