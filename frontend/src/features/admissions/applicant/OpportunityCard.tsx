import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import type { Opportunity } from '../types';
import { useAdmissionCopy } from './copy';
import { playerPath } from '../../parents/playerSelection';
export function OpportunityCard({opportunity:o,playerId}: {opportunity:Opportunity;playerId?:number}) {
    const {copy,availability}=useAdmissionCopy();
    return <article className="admission-card"><header><div><p className="admission-eyebrow">{o.organizationName}</p><h2>{o.name}</h2></div></header>
        <span className="admission-badge">{availability(o.availability)}</span>
        <p><MapPin size={14} className="inline"/> {o.location.name} · {o.location.address}</p>
        <p>{copy('Born','დაბადების წელი')} {o.birthYearFrom}–{o.birthYearTo} · {o.gender==='ANY'?copy('All genders','ყველა სქესი'):o.gender==='MALE'?copy('Boys / men','ბიჭები / კაცები'):copy('Girls / women','გოგოები / ქალები')}{o.beginnerWelcome?` · ${copy('Beginners welcome','დამწყებები მისასალმებელია')}`:''}</p>
        <p>{o.schedule||copy('Schedule to be agreed','განრიგი შესათანხმებელია')} · {o.timezone}</p>
        <p>{!o.terms.feesKnown?copy('Price to be confirmed','ფასი დასაზუსტებელია'):o.terms.charges.length?o.terms.charges.map(c=>`${c.amount} ${c.currency} · ${c.frequency}`).join(' + '):copy('No mandatory charges','სავალდებულო გადასახადი არ არის')}</p>
        <Link className="admission-button admission-primary" to={`/admissions/opportunities/${o.id}${playerId?`?player=${playerId}`:''}`}>{copy('View joining arrangements','მონაწილეობის პირობების ნახვა')}<ArrowRight size={16}/></Link>
        <Link className="admission-button" to={playerPath(`/admissions/organizations/${o.organizationId}/inquire?group=${o.id}`, playerId)}>{copy("Ask for group guidance","ჯგუფის შესახებ რჩევის კითხვა")}</Link>
    </article>;
}
