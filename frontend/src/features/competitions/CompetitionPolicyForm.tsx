import {useCompetitionCopy} from './competitionCopy';
import { useTranslation } from 'react-i18next';
import type { EligibilityPolicy } from './api';

export function CompetitionPolicyForm({policy,onChange,disabled=false}:{policy:EligibilityPolicy;onChange:(policy:EligibilityPolicy)=>void;disabled?:boolean}){
  const activityCopy=useCompetitionCopy();
  const {i18n}=useTranslation();const copy=(en:string,ka:string)=>i18n.language.startsWith('ka')?ka:en;
  return <fieldset className="mc-rule-form" disabled={disabled}><legend>{copy('Eligibility & rule authority','მონაწილეობის პირობები და წესების წყარო')}</legend>
    <p>{copy('Publish the limits your organiser applies. Recorded ages use the competition cutoff. Club and off-platform rosters require a recorded review; additional institution/category requirements need an organiser review.','გამოაქვეყნეთ ორგანიზატორის პირობები. ასაკი მოწმდება შეჯიბრების ათვლის თარიღით. კლუბისა და სტუმარი გუნდის შემადგენლობას ორგანიზატორი ამოწმებს.')}</p>
    <div className="mc-rule-grid">{([['Minimum roster','minimumRoster',1,100],['Maximum match length for this age/ruleset (minutes)','maximumMatchMinutes',1,120],['Minimum player age at cutoff','minimumAge',0,90],['Ladder inactivity limit (days; 0 disables)','inactivityDays',0,365]] as const).map(([label,key,min,max])=><label key={key}>{activityCopy(label)}<input required type="number" min={min} max={max} value={policy[key]} onChange={e=>onChange({...policy,[key]:Number(e.target.value)})}/></label>)}</div>
    <label>{copy('Rules authority & version','წესების წყარო და ვერსია')}<input required maxLength={500} value={policy.ruleAuthority} onChange={e=>onChange({...policy,ruleAuthority:e.target.value})}/></label>
    <label>{copy('Public sanctioning evidence, if applicable','საჯარო სანქცირების მტკიცებულება, თუ არსებობს')}<textarea maxLength={1000} value={policy.sanctioningEvidence} onChange={e=>onChange({...policy,sanctioningEvidence:e.target.value})}/><small>{copy('Organiser-reported. This does not mark a competition or qualification as verified.','ორგანიზატორის მიერ მითითებული ინფორმაცია; გადამოწმებას არ ნიშნავს.')}</small></label>
    <label><input type="checkbox" checked={policy.allowParticipantOfficials??false} onChange={e=>onChange({...policy,allowParticipantOfficials:e.target.checked})}/>{copy('Allow participating players or team officials to referee their fixture under the published rules','გამოქვეყნებული წესებით დაუშვით მონაწილის ან გუნდის წარმომადგენლის მსაჯობა თავის მატჩზე')}</label>
  </fieldset>;
}
