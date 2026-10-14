import { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../../../design/primitives';
import type { Gender, SquadItem } from '../../api';
import { usePagesCopy } from '../../copy';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

export const AGE_GROUPS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'SENIOR'] as const;
const GENDERS: [Gender, string][] = [['MALE', 'Boys'], ['FEMALE', 'Girls'], ['MIXED', 'Mixed']];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const name = (age: string, gender: Gender) => `${age === 'SENIOR' ? 'Senior' : age} ${gender === 'MALE' ? (age === 'SENIOR' ? 'Men' : 'Boys') : gender === 'FEMALE' ? (age === 'SENIOR' ? 'Women' : 'Girls') : 'Mixed'}`;
type Draft = Omit<SquadItem, 'id' | 'format' | 'players' | 'coach'> & { id: number | null; players: number };

/**
 * Which ages: tiles U6 … U19 and Senior on the left, each with Boys / Girls / Mixed; the squads appear as cards on
 * the right, named for you ("U10 Boys"), with training days, a time and a ground to pick.
 */
export function SquadsPanel() {
  const t = usePagesCopy();
  const { page, saveBox, closePanel } = usePageEdit();
  const [squads, setSquads] = useState<Draft[]>(() => (page?.boxes.squads.items ?? []).map(squad => ({ id: squad.id, name: squad.name, ageGroup: squad.ageGroup, gender: squad.gender, days: squad.days, time: squad.time, groundId: squad.groundId, players: squad.players })));
  const [busy, setBusy] = useState(false);
  const id = useId();
  if (!page) return null;
  const grounds = page.boxes.grounds.items;
  const has = (age: string, gender: Gender) => squads.some(squad => squad.ageGroup === age && squad.gender === gender);
  const toggle = (age: string, gender: Gender) => setSquads(current => (has(age, gender)
    ? current.filter(squad => !(squad.ageGroup === age && squad.gender === gender && squad.players === 0))
    : [...current, { id: null, name: name(age, gender), ageGroup: age, gender, days: [], time: null, groundId: grounds[0]?.id ?? null, players: 0 }]));
  const update = (index: number, patch: Partial<Draft>) => setSquads(current => current.map((squad, i) => (i === index ? { ...squad, ...patch } : squad)));
  const save = async () => {
    setBusy(true);
    try { await saveBox('squads', { items: squads.map(squad => ({ id: squad.id ?? undefined, name: squad.name, ageGroup: squad.ageGroup, gender: squad.gender, days: squad.days, time: squad.time, groundId: squad.groundId })) }, { label: t('Teams saved') }); closePanel(); } finally { setBusy(false); }
  };
  const order = (age: string) => (age === 'SENIOR' ? 99 : Number(age.slice(1)));
  return (
    <SplitPanel title={t('Which ages?')} description={t('Tap an age, then boys, girls or mixed. The squads are named for you.')} onClose={closePanel}
      footer={<><Button variant="ghost" onClick={closePanel}>{t('Cancel')}</Button><Button variant="primary" disabled={busy} onClick={() => void save()}>{t('Done')}</Button></>}
      preview={<div className="gk-boxedit" aria-live="polite">
        <p className="gk-field__label">{t('Your teams')}</p>
        {squads.length === 0 && <p className="gk-muted">{t('No teams yet.')}</p>}
        {[...squads].sort((a, b) => order(a.ageGroup) - order(b.ageGroup)).map(squad => {
          const index = squads.indexOf(squad);
          return (
            <div key={`${squad.ageGroup}-${squad.gender}-${squad.id ?? 'new'}`} className="gk-boxedit gk-squadcard">
              <div className="gk-boxedit__row">
                <input className="gk-input" value={squad.name} maxLength={60} aria-label={t('Team name')} onChange={event => update(index, { name: event.target.value })} />
                {squad.players === 0 && <Button size="sm" variant="ghost" iconOnly aria-label={t('Remove')} onClick={() => setSquads(current => current.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" /></Button>}
              </div>
              <div className="gk-ctowns" role="group" aria-label={t('Training days')}>
                {DAYS.map((day, dayIndex) => <button key={day} type="button" className="gk-chip" aria-pressed={squad.days.includes(dayIndex + 1)} onClick={() => update(index, { days: squad.days.includes(dayIndex + 1) ? squad.days.filter(value => value !== dayIndex + 1) : [...squad.days, dayIndex + 1].sort() })}>{t(day)}</button>)}
              </div>
              <div className="gk-boxedit__row">
                <input className="gk-input" type="time" value={squad.time ?? ''} aria-label={t('Time')} style={{ maxWidth: 120 }} onChange={event => update(index, { time: event.target.value || null })} />
                {grounds.length > 0 && <select className="gk-input" aria-label={t('Ground')} value={squad.groundId ?? ''} onChange={event => update(index, { groundId: event.target.value ? Number(event.target.value) : null })}>
                  <option value="">{t('Ground to choose')}</option>{grounds.map(ground => <option key={ground.id} value={ground.id}>{ground.name}</option>)}
                </select>}
              </div>
              {squad.players > 0 && <span className="gk-faint">{t('{n} players', { n: squad.players })}</span>}
            </div>
          );
        })}
      </div>}>
      <div className="gk-boxedit">
        <div className="gk-ages" role="group" aria-labelledby={`${id}-ages`}>
          <p className="gk-field__label" id={`${id}-ages`}>{t('Age groups')}</p>
          {AGE_GROUPS.map(age => (
            <div key={age} className="gk-ages__row">
              <span className="gk-ages__age">{age === 'SENIOR' ? t('Senior') : age}</span>
              {GENDERS.map(([gender, word]) => <button key={gender} type="button" className="gk-chip" aria-pressed={has(age, gender)} onClick={() => toggle(age, gender)}>{t(word)}</button>)}
            </div>
          ))}
        </div>
      </div>
    </SplitPanel>
  );
}
