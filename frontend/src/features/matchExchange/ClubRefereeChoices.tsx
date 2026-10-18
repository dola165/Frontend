import { EmptyState } from '../../components/ui/EmptyState';
import { Flag, Check } from 'lucide-react';
import { useRefereeHistory } from './useRefereeHistory';
import { useMatchCopy } from './copy';
import type { Referee } from './api';
import './club-referees.css';

export function ClubRefereeChoices({squadId,volunteer,selectedId,onSelect}:{squadId?:number|null;volunteer:boolean;selectedId:number;onSelect:(referee:Referee)=>void}){
  const t = useMatchCopy();
  const {data,error,reload}=useRefereeHistory<Referee[]>(squadId?`/referees/club-squad/${squadId}`:'');
  if(!squadId)return null;
  return <section className="club-referee-choices mx-wide"><header><Flag size={19}/><div><h3>{t('Your club’s referees')}</h3><p>{t('Active club appointments for this squad. Choose a referee to invite.')}</p></div></header>
    {error?<p role="alert">{t('Could not load your club referees.')} <button type="button" onClick={reload}>{t('Retry')}</button></p>:!data?<p role="status">{t('Loading club referees…')}</p>:!data.length?<EmptyState compact icon={Flag} title={t('No club referee is ready for invitations yet')} description={t('A referee needs an accepted, current club appointment and a published profile to appear here. You can also search the referee directory below.')}/>:<div>{data.map(r=>{const eligible=volunteer?r.accepts_volunteer:r.accepts_paid;return <button type="button" key={r.user_id} aria-pressed={selectedId===r.user_id} disabled={!eligible} onClick={()=>onSelect(r)}><Flag size={18}/><span><strong>{r.full_name}</strong><small>{r.service_area}{eligible?` · ${volunteer?t('Accepts volunteer matches'):t('{fee} {currency} listed fee',{fee:r.fee,currency:r.currency})}`:` · ${t('Does not accept these terms')}`}</small></span>{selectedId===r.user_id?<Check size={18}/>:<span>{t('Select')}</span>}</button>;})}</div>}
    <small>{t('Affiliation does not confirm a fixture. The referee accepts the invitation after checking availability.')}</small>
  </section>;
}
