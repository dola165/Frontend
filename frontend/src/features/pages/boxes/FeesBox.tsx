import { useId, useState } from 'react';
import { Button } from '../../../design/primitives';
import { SideBlock } from '../../../design/profile/ProfileLayout';
import type { FeeBand } from '../api';
import { usePagesCopy } from '../copy';
import { EditPencil } from '../edit/EditPencil';
import { usePageEdit } from '../edit/context';
import type { BoxProps } from '../edit/boxRegistry';
import { feeBandText } from '../model/fees';
import '../edit/edit.css';

const STEP = 10, TOP = 500;

/** What training costs, lowest to highest group, as one line; edited in place with one range and "Free". */
export function FeesBox({ page, editing, open, onEdit, onClose }: BoxProps) {
  const t = usePagesCopy();
  const { saveBox } = usePageEdit();
  const band = page.boxes.fees.band;
  const text = feeBandText(band, { free: t('Free training'), month: t('month'), someFree: t('Some groups train free') });
  const save = async (next: FeeBand | null) => { await saveBox('fees', { band: next }, { label: t('Fees saved') }); onClose(); };
  return (
    <SideBlock title={t(page.kind === 'FAN_CLUB' ? 'Membership' : 'Training fees')} hint={t(page.kind === 'FAN_CLUB' ? 'What members pay' : 'Lowest to highest group')} action={editing && !open ? <EditPencil onClick={onEdit} /> : undefined}>
      {open ? <FeeEditor initial={band} onSave={save} onCancel={onClose} />
        : text ? <p className="gk-club-fees"><strong className="gk-num">{text.range}</strong>{text.note && <span className="gk-muted">{text.note}</span>}</p> : <p className="gk-muted">{t('Ask the club about fees.')}</p>}
    </SideBlock>
  );
}

function FeeEditor({ initial, onSave, onCancel }: { initial: FeeBand | null; onSave: (next: FeeBand | null) => Promise<void>; onCancel: () => void }) {
  const t = usePagesCopy();
  const id = useId();
  const [free, setFree] = useState<FeeBand['free']>(initial?.free ?? 'NONE');
  const [min, setMin] = useState(initial?.min ?? 40);
  const [max, setMax] = useState(initial?.max ?? 80);
  const currency = initial?.currency ?? 'GEL';
  const band: FeeBand = { min: free === 'ALL' ? 0 : min, max: free === 'ALL' ? 0 : max, currency, period: 'MONTH', free };
  const text = feeBandText(band, { free: t('Free training'), month: t('month'), someFree: t('Some groups train free') });
  return (
    <div className="gk-boxedit">
      <div className="gk-fee" aria-live="polite">
        <div className="gk-fee__values"><span>{text?.range}</span></div>
        {free !== 'ALL' && <>
          <label className="gk-field__label" htmlFor={`${id}-min`}>{t('From, a month')}</label>
          <input id={`${id}-min`} type="range" min={0} max={TOP} step={STEP} value={min} onChange={event => { const value = Number(event.target.value); setMin(value); if (value > max) setMax(value); }} />
          <label className="gk-field__label" htmlFor={`${id}-max`}>{t('To, a month')}</label>
          <input id={`${id}-max`} type="range" min={0} max={TOP} step={STEP} value={max} onChange={event => { const value = Number(event.target.value); setMax(value); if (value < min) setMin(value); }} />
        </>}
      </div>
      <div className="gk-ctowns" role="group" aria-label={t('Free training')}>
        {([['NONE', 'Everyone pays'], ['SOME', 'Some groups train free'], ['ALL', 'All free']] as const).map(([value, label]) => (
          <button key={value} type="button" className="gk-chip" aria-pressed={free === value} onClick={() => setFree(value)}>{t(label)}</button>
        ))}
      </div>
      <div className="gk-boxedit__foot">
        <Button size="sm" variant="primary" onClick={() => void onSave(band)}>{t('Done')}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </div>
  );
}
