import type { Terms } from '../types';
import { useAdmissionCopy } from './copy';

export function TermsFacts({terms}: {terms:Terms}) {
    const {copy,requirement}=useAdmissionCopy();
    return <dl className="admission-details">
        <div><dt>{copy('Start','დასაწყისი')}</dt><dd>{terms.startDate||copy('To be agreed','შესათანხმებელია')}{terms.endDate?` — ${terms.endDate}`:''}</dd></div>
        <div><dt>{copy('Mandatory charges','სავალდებულო გადასახადები')}</dt><dd>{!terms.feesKnown?copy('Price must be confirmed before enrollment','ფასი ჩარიცხვამდე უნდა დადასტურდეს'):terms.charges.length?terms.charges.map((charge,i)=><p key={i}>{charge.label}: {charge.amount} {charge.currency} · {charge.frequency}</p>):copy('No mandatory charges','სავალდებულო გადასახადი არ არის')}</dd></div>
        <div><dt>{copy('Cancellation','გაუქმება')}</dt><dd>{terms.cancellation||copy('Terms still needed','პირობები ჯერ არ არის მითითებული')}</dd></div>
        <div><dt>{copy('Participation','მონაწილეობა')}</dt><dd>{terms.participation||copy('Terms still needed','პირობები ჯერ არ არის მითითებული')}</dd></div>
        <div><dt>{copy('Competitive club','სათამაშო კლუბი')}</dt><dd>{terms.affiliationEffect==='PRIMARY_CHANGE'?copy('Proposed change of primary competitive club. Separate confirmation and external prerequisites are required.','ძირითადი სათამაშო კლუბის შემოთავაზებული ცვლილება. საჭიროა ცალკე დადასტურება და გარე მოთხოვნების შესრულება.'):copy('Existing competitive affiliation stays unchanged','არსებული სათამაშო წევრობა უცვლელი რჩება')}</dd></div>
        {!!terms.requirements.length&&<div><dt>{copy('Requirements','მოთხოვნები')}</dt><dd>{terms.requirements.map(v=>requirement(v)).join(' · ')}</dd></div>}
    </dl>;
}
