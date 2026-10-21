import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../../../design/primitives';
import { appLanguage } from '../../../../utils/formatting';
import type { Gender, SquadItem } from '../../api';
import { usePagesCopy } from '../../copy';
import { ageGroupOf, birthYearOf } from '../../model/about';
import { TEAM_AGES, teamName } from '../../model/teams';
import { useGuideTask, usePetAnswer } from '../../guide/bridge';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

const GENDERS: [Gender, string][] = [['MALE', 'Boys'], ['FEMALE', 'Girls'], ['MIXED', 'Both']];
type Draft = Omit<SquadItem, 'id' | 'format' | 'players' | 'coach'> & { id: number | null; players: number };
/** Who plays, from words typed to Dola, in English or Georgian. */
const genderIn = (text: string): Gender | null => (/both|mixed|ორივე|შერეულ/i.test(text) ? 'MIXED' : /girl|გოგ/i.test(text) ? 'FEMALE' : /boy|ბიჭ/i.test(text) ? 'MALE' : null);
const order = (age: string) => (age === 'SENIOR' ? 99 : Number(age.slice(1)));

/**
 * Which teams: one row per birth year (parents know the year, not "U11"; the age group is small beside it) with Boys ·
 * Girls · Both, one tap per team. Scheduling belongs to the squad page. Existing schedule fields travel unchanged.
 */
export function SquadsPanel() {
  const t = usePagesCopy();
  const { page, saveBox, closePanel } = usePageEdit();
  const language = appLanguage() === 'ka' ? 'ka' : 'en';
  const [squads, setSquads] = useState<Draft[]>(() => (page?.boxes.squads.items ?? []).map(squad => ({ id: squad.id, name: squad.name, ageGroup: squad.ageGroup, gender: squad.gender, days: squad.days, time: squad.time, groundId: squad.groundId, players: squad.players })));
  const [busy, setBusy] = useState(false);
  const year = new Date().getFullYear();
  const team = (age: string, gender: Gender): Draft => ({ id: null, name: teamName(age, gender, language, year), ageGroup: age, gender, days: [], time: null, groundId: null, players: 0 });
  // Typed to Dola ("2015, 2016 boys"): the years and who plays, ticked the same way as the chips.
  usePetAnswer('squads', text => {
    const who = genderIn(text) ?? 'MALE';
    const ages = [...new Set((text.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(born => ageGroupOf(Number(born), year)))].filter(age => (TEAM_AGES as readonly string[]).includes(age));
    if (!ages.length) return null;
    const fresh = ages.filter(age => !squads.some(squad => squad.ageGroup === age && squad.gender === who));
    setSquads(current => [...current, ...fresh.map(age => team(age, who))]);
    return t('Added {teams}. Tap Done to keep them.', { teams: (fresh.length ? fresh : ages).map(age => teamName(age, who, language, year)).join(', ') });
  });
  const save = async () => {
    if (busy) return false;
    setBusy(true);
    try { const ok = await saveBox('squads', { items: squads.map(squad => ({ id: squad.id ?? undefined, name: squad.name, ageGroup: squad.ageGroup, gender: squad.gender, days: squad.days, time: squad.time, groundId: squad.groundId })) }, { label: t('Teams saved') }); if (ok) closePanel(); return ok; } finally { setBusy(false); }
  };
  useGuideTask('squads', { disabled: busy || !squads.length, next: async () => ({ status: await save() ? 'complete' : 'stay' }) });
  if (!page) return null;
  const has = (age: string, gender: Gender) => squads.some(squad => squad.ageGroup === age && squad.gender === gender);
  const toggle = (age: string, gender: Gender) => setSquads(current => (current.some(squad => squad.ageGroup === age && squad.gender === gender)
    ? current.filter(squad => !(squad.ageGroup === age && squad.gender === gender && squad.players === 0))
    : [...current, team(age, gender)]));
  const update = (index: number, patch: Partial<Draft> | ((squad: Draft) => Partial<Draft>)) => setSquads(current => current.map((squad, i) => (i === index ? { ...squad, ...(typeof patch === 'function' ? patch(squad) : patch) } : squad)));
  const sorted = [...squads].sort((a, b) => order(a.ageGroup) - order(b.ageGroup));
  return (
    <SplitPanel title={t('Which teams?')} description={t('Tap boys, girls or both beside each year they were born. The teams are named for you.')} onClose={closePanel}
      footer={<><Button variant="ghost" onClick={closePanel}>{t('Cancel')}</Button><Button variant="primary" disabled={busy} onClick={() => void save()}>{t('Done')}</Button></>}
      preview={<div className="gk-boxedit" aria-live="polite">
        <p className="gk-field__label">{t('Your teams')}</p>
        {squads.length === 0 && <p className="gk-muted">{t('No teams yet.')}</p>}
        {sorted.map(squad => {
          const index = squads.indexOf(squad);
          return (
            <div key={`${squad.ageGroup}-${squad.gender}-${squad.id ?? 'new'}`} className="gk-squadrow">
              <div className="gk-boxedit__row">
                <input className="gk-input" value={squad.name} maxLength={60} aria-label={t('Team name')} onChange={event => update(index, { name: event.target.value })} />
                {squad.players === 0 && <Button size="sm" variant="ghost" iconOnly aria-label={t('Remove')} onClick={() => setSquads(current => current.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" /></Button>}
              </div>
            </div>
          );
        })}
        <p className="gk-muted">{t('Set training days and times on each squad’s page.')}</p>
      </div>}>
      <div className="gk-yearrows" role="group" aria-label={t('Born in')}>
        {TEAM_AGES.map(age => {
          const born = birthYearOf(age, year);
          return (
            <div key={age} className="gk-yearrow">
              <span className="gk-yearrow__year"><span className="gk-num">{born ?? t('Adults')}</span>{born && <small>{age}</small>}</span>
              {GENDERS.map(([gender, word]) => <button key={gender} type="button" className="gk-chip" aria-pressed={has(age, gender)} aria-label={born ? `${born} ${t(word)}` : `${t('Adults')} ${t(word)}`} onClick={() => toggle(age, gender)}>{t(word)}</button>)}
            </div>
          );
        })}
      </div>
    </SplitPanel>
  );
}
