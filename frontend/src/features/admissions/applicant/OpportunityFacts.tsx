import type { Location, Opportunity, Terms } from '../types';
import { useAdmissionCopy } from './copy';

export const termsComplete=(terms:Terms,schedule:string,location:Location)=>terms.feesKnown&&Boolean(terms.startDate&&terms.cancellation.trim()&&terms.participation.trim()&&schedule.trim()&&location.name.trim());
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
export function OpportunityFacts({opportunity:o}: {opportunity:Opportunity}) {
    const {copy,method}=useAdmissionCopy();
    return <><dl className="admission-details">
        <div><dt>{copy('Training venue','ვარჯიშის ადგილი')}</dt><dd>{o.location.name}<p>{o.location.address}</p></dd></div>
        <div><dt>{copy('Schedule','განრიგი')}</dt><dd>{o.schedule||copy('Arrange with the club','შეათანხმეთ კლუბთან')} · {o.timezone}</dd></div>
        <div><dt>{copy('Who can join','ვის შეუძლია ჩარიცხვა')}</dt><dd>{copy('Born','დაბადების წელი')} {o.birthYearFrom}–{o.birthYearTo} · {o.gender==='ANY'?copy('All genders','ყველა სქესი'):o.gender==='MALE'?copy('Boys / men','ბიჭები / კაცები'):copy('Girls / women','გოგოები / ქალები')}<p>{copy('Eligibility reference date','შესაბამისობის საცნობარო თარიღი')}: {o.referenceDate}</p></dd></div>
        <div><dt>{copy('Experience','გამოცდილება')}</dt><dd>{o.beginnerWelcome?copy('Beginners welcome','დამწყებები მისასალმებელია'):copy('Experience expected — ask the club about requirements','საჭიროა გამოცდილება — მოთხოვნები კლუბთან დააზუსტეთ')}</dd></div>
        <div><dt>{copy('Joining method','ჩარიცხვის მეთოდი')}</dt><dd>{method(o.method)}</dd></div>
        <div><dt>{copy('Intake','მიღება')}</dt><dd>{o.intake}</dd></div>
    </dl>{o.introductionPermission?.required&&<section className="admission-notice"><h3>{copy('Permission before introductory attendance','ნებართვა გაცნობით ვარჯიშზე დასწრებამდე')}</h3><p>{o.introductionPermission.reason}</p><p>{copy('Obtain current-club permission and send the reference to the host staff before confirming a session.','სესიის დადასტურებამდე მიიღეთ მიმდინარე კლუბის ნებართვა და გაუგზავნეთ მითითება მასპინძელ თანამშრომელს.')}</p></section>}<TermsFacts terms={o.terms}/></>;
}
