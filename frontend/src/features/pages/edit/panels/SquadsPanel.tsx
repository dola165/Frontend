import { useId, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '../../../../design/primitives';
import { appLanguage } from '../../../../utils/formatting';
import type { Gender, SquadItem } from '../../api';
import { usePagesCopy } from '../../copy';
import { birthYearOf } from '../../model/about';
import { TEAM_AGES, teamName } from '../../model/teams';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

const GENDERS: [Gender, string][] = [['MALE', 'Boys'], ['FEMALE', 'Girls'], ['MIXED', 'Both']];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** The usual training times, one tap each; any other half hour is in the list beside them. */
const TIMES = ['16:00', '17:00', '18:00', '19:00', '20:00'];
const HALF_HOURS = Array.from({ length: 31 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
type Draft = Omit<SquadItem, 'id' | 'format' | 'players' | 'coach'> & { id: number | null; players: number };
const order = (age: string) => (age === 'SENIOR' ? 99 : Number(age.slice(1)));

/**
 * Which teams: boys, girls or both first, then one row of birth years (how grassroots groups are named and run;
 * parents know the year, not "U11"). Each team appears on the right, named for you in your language, with its days,
 * a time to tap and a ground; the next team can take the same days in one tap.
 */
export function SquadsPanel() {
  const t = usePagesCopy();
  const { page, saveBox, closePanel } = usePageEdit();
  const language = appLanguage() === 'ka' ? 'ka' : 'en';
  const [squads, setSquads] = useState<Draft[]>(() => (page?.boxes.squads.items ?? []).map(squad => ({ id: squad.id, name: squad.name, ageGroup: squad.ageGroup, gender: squad.gender, days: squad.days, time: squad.time, groundId: squad.groundId, players: squad.players })));
  // The likely answer pre-chosen: the gender of the teams the club already has.
  const [gender, setGender] = useState<Gender | null>(() => page?.boxes.squads.items.at(-1)?.gender ?? null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  if (!page) return null;
  const year = new Date().getFullYear();
  const grounds = page.boxes.grounds.items;
  const has = (age: string) => gender != null && squads.some(squad => squad.ageGroup === age && squad.gender === gender);
  const toggle = (age: string) => {
    if (!gender) return;
    setSquads(current => (has(age)
      ? current.filter(squad => !(squad.ageGroup === age && squad.gender === gender && squad.players === 0))
      : [...current, { id: null, name: teamName(age, gender, language, year), ageGroup: age, gender, days: [], time: null, groundId: grounds[0]?.id ?? null, players: 0 }]));
  };
  const update = (index: number, patch: Partial<Draft>) => setSquads(current => current.map((squad, i) => (i === index ? { ...squad, ...patch } : squad)));
  const save = async () => {
    setBusy(true);
    try { await saveBox('squads', { items: squads.map(squad => ({ id: squad.id ?? undefined, name: squad.name, ageGroup: squad.ageGroup, gender: squad.gender, days: squad.days, time: squad.time, groundId: squad.groundId })) }, { label: t('Teams saved') }); closePanel(); } finally { setBusy(false); }
  };
  const sorted = [...squads].sort((a, b) => order(a.ageGroup) - order(b.ageGroup));
  // The team whose days and time the next one can copy in one tap.
  const planned = sorted.find(squad => squad.days.length && squad.time);
  const daysLine = (squad: Draft) => `${squad.days.map(day => t(DAYS[day - 1])).join(' · ')} ${squad.time}`;
  return (
    <SplitPanel title={t('Which teams?')} description={t('Boys, girls or both, then the years they were born. The teams are named for you.')} onClose={closePanel}
      footer={<><Button variant="ghost" onClick={closePanel}>{t('Cancel')}</Button><Button variant="primary" disabled={busy} onClick={() => void save()}>{t('Done')}</Button></>}
      preview={<div className="gk-boxedit" aria-live="polite">
        <p className="gk-field__label">{t('Your teams')}</p>
        {squads.length === 0 && <p className="gk-muted">{t('No teams yet.')}</p>}
        {sorted.map(squad => {
          const index = squads.indexOf(squad);
          return (
            <div key={`${squad.ageGroup}-${squad.gender}-${squad.id ?? 'new'}`} className="gk-boxedit gk-squadcard">
              <div className="gk-boxedit__row">
                <input className="gk-input" value={squad.name} maxLength={60} aria-label={t('Team name')} onChange={event => update(index, { name: event.target.value })} />
                {squad.players === 0 && <Button size="sm" variant="ghost" iconOnly aria-label={t('Remove')} onClick={() => setSquads(current => current.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" /></Button>}
              </div>
              {!squad.days.length && planned && planned !== squad && (
                <button type="button" className="gk-tap" onClick={() => update(index, { days: planned.days, time: planned.time, groundId: planned.groundId })}><Copy aria-hidden="true" />{t('Same as {team}: {days}', { team: planned.name, days: daysLine(planned) })}</button>
              )}
              <div className="gk-ctowns" role="group" aria-label={t('Training days')}>
                {DAYS.map((day, dayIndex) => <button key={day} type="button" className="gk-chip" aria-pressed={squad.days.includes(dayIndex + 1)} onClick={() => update(index, { days: squad.days.includes(dayIndex + 1) ? squad.days.filter(value => value !== dayIndex + 1) : [...squad.days, dayIndex + 1].sort() })}>{t(day)}</button>)}
              </div>
              <div className="gk-ctowns" role="group" aria-label={t('Time')}>
                {TIMES.map(time => <button key={time} type="button" className="gk-chip gk-num" aria-pressed={squad.time === time} onClick={() => update(index, { time: squad.time === time ? null : time })}>{time}</button>)}
                <select className="gk-input gk-squadcard__other" aria-label={t('Another time')} value={squad.time && !TIMES.includes(squad.time) ? squad.time : ''} onChange={event => update(index, { time: event.target.value || null })}>
                  <option value="">{t('Other')}</option>{HALF_HOURS.map(time => <option key={time} value={time}>{time}</option>)}
                </select>
              </div>
              {grounds.length > 1 && <select className="gk-input" aria-label={t('Ground')} value={squad.groundId ?? ''} onChange={event => update(index, { groundId: event.target.value ? Number(event.target.value) : null })}>
                <option value="">{t('Ground to choose')}</option>{grounds.map(ground => <option key={ground.id} value={ground.id}>{ground.name}</option>)}
              </select>}
              {squad.players > 0 && <span className="gk-faint">{t('{n} players', { n: squad.players })}</span>}
            </div>
          );
        })}
      </div>}>
      <div className="gk-boxedit">
        <div>
          <p className="gk-field__label" id={`${id}-who`}>{t('Who plays?')}</p>
          <div className="gk-ctowns" role="group" aria-labelledby={`${id}-who`}>
            {GENDERS.map(([value, word]) => <button key={value} type="button" className="gk-chip" aria-pressed={gender === value} onClick={() => setGender(value)}>{t(word)}</button>)}
          </div>
        </div>
        {gender && <div>
          <p className="gk-field__label" id={`${id}-born`}>{t('Born in')}</p>
          <div className="gk-ctowns gk-years" role="group" aria-labelledby={`${id}-born`}>
            {TEAM_AGES.map(age => {
              const born = birthYearOf(age, year);
              return <button key={age} type="button" className="gk-chip gk-year" aria-pressed={has(age)} aria-label={born ? t('Born {year} ({age})', { year: born, age }) : t('Adults')} onClick={() => toggle(age)}>
                <span className="gk-num">{born ?? t('Adults')}</span>{born && <small aria-hidden="true">{age}</small>}
              </button>;
            })}
          </div>
        </div>}
      </div>
    </SplitPanel>
  );
}
