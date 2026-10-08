import type { Opportunity } from '../types';
import type { MapFilters } from '../../../components/map/MapFilterSidebar';
export function matchesOpportunity(o:Opportunity,filters:MapFilters) {
    const f=filters.clubs;
    if(o.visibility!=='PUBLIC'||!o.published)return false;
    const active=!['CLOSED','WAITLIST'].includes(o.availability)&&o.intakeOpen;
    if(f.openTryoutsOnly&&!active&&!(f.includeWaitlist&&o.availability==='WAITLIST'))return false;
    if(f.birthYear!=null&&(f.birthYear<o.birthYearFrom||f.birthYear>o.birthYearTo))return false;
    if(f.genders.length&&!f.genders.some(g=>g==='Mixed'?o.gender==='ANY':o.gender==='ANY'||o.gender===(g==='Girls'||g==='Women'?'FEMALE':'MALE')))return false;
    const referenceYear=Number(o.referenceDate.slice(0,4));
    if(f.ageGroups.length&&!f.ageGroups.some(age=>{
        if(age==='Senior')return o.birthYearFrom<=referenceYear-18;
        const under=Number(age.replace(/^U/,''));
        const cohort=referenceYear-under+1;
        return Number.isFinite(under)&&cohort>=o.birthYearFrom&&cohort<=o.birthYearTo;
    }))return false;
    if(f.levels.length&&(!o.level||!f.levels.includes(o.level as typeof f.levels[number])))return false;
    if(filters.positions.length&&!filters.positions.some(p=>o.positions?.includes(p)))return false;
    // Geographic metadata belongs to the configured training venue, never headquarters.
    if(f.city&&o.city?.toLocaleLowerCase()!==f.city.toLocaleLowerCase())return false;
    if(f.country&&o.country?.toLocaleLowerCase()!==f.country.toLocaleLowerCase())return false;
    if(f.trainingMinPrice||f.trainingMaxPrice) {
        if(!o.terms.feesKnown)return false;
        const charges=o.terms.charges;
        if(charges.some(c=>c.currency!==(f.trainingCurrency||'GEL')||c.frequency!==(f.trainingPeriod||'MONTH')))return false;
        const amount=charges.reduce((sum,c)=>sum+c.amount,0);
        if(f.trainingMinPrice&&amount<Number(f.trainingMinPrice))return false;
        if(f.trainingMaxPrice&&amount>Number(f.trainingMaxPrice))return false;
    }
    return true;
}
