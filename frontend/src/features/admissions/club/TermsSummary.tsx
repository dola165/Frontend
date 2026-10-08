import type { Terms, Location } from '../types';
import { useClubAdmissionCopy } from './copy';
import { requirementCopy } from './domain';

export function TermsSummary({terms,location,schedule}:{terms:Terms;location:Location;schedule:string}) {
  const {c,locale}=useClubAdmissionCopy();
  return <dl className="admission-summary">
    <div><dt>{c('location')}</dt><dd>{location.name}<br/>{location.address}</dd></div>
    <div><dt>{c('schedule')}</dt><dd>{schedule}</dd></div>
    <div><dt>{c('startDate')}</dt><dd>{terms.startDate}{terms.endDate && ` → ${terms.endDate}`}</dd></div>
    <div><dt>{c('charges')}</dt><dd>{!terms.feesKnown?c('unknownFees'):!terms.charges.length?c('free'):terms.charges.map((charge,index)=><div key={index}>{charge.label} · {new Intl.NumberFormat(locale,{style:'decimal',maximumFractionDigits:2}).format(charge.amount)} {charge.currency} · {charge.frequency}</div>)}</dd></div>
    <div><dt>{c('cancellation')}</dt><dd>{terms.cancellation || '—'}</dd></div>
    <div><dt>{c('participation')}</dt><dd>{terms.participation || '—'}</dd></div>
    <div><dt>{c('effect')}</dt><dd>{c(terms.affiliationEffect==='NONE'?'noChange':'primaryChange')}</dd></div>
    {terms.requirements.length>0 && <div><dt>{c('prerequisites')}</dt><dd>{terms.requirements.map(kind=>c(requirementCopy[kind])).join(' · ')}</dd></div>}
  </dl>;
}

export const completeOfferTerms=(terms:Terms,schedule:string,location:Location) => terms.feesKnown && Boolean(terms.startDate && terms.cancellation.trim() && terms.participation.trim() && schedule.trim() && location.name.trim() && location.address.trim());
