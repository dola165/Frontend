import {useCompetitionCopy} from './competitionCopy';
import { useTranslation } from 'react-i18next';
import { ages } from '../matchExchange/api';
import { familyLabels, structureLabels, structures, type CompetitionRules, type Family, type Tiebreak } from './api';
import './competition-rules.css';
import {CompetitionPresets} from './CompetitionPresets';

export function CompetitionRulesForm({ rules, onChange, disabled = false }: { rules: CompetitionRules; onChange: (rules: CompetitionRules) => void; disabled?: boolean }) {
  const activityCopy=useCompetitionCopy();
  const { i18n } = useTranslation();
  const copy=(en:string,ka:string)=>i18n.language.startsWith('ka')?ka:en;
  const update=<K extends keyof CompetitionRules>(key:K,value:CompetitionRules[K])=>onChange({...rules,[key]:value});
  const number=(label:string,key:'sideSize'|'matchMinutes'|'restMinutes'|'pitches'|'rounds'|'challengeRange'|'challengeExpiryDays'|'maxConsecutiveStays'|'entryFee',min:number,max:number)=><label>{activityCopy(label)}<input type="number" required min={min} max={max} value={rules[key]} onChange={e=>update(key,Number(e.target.value))}/></label>;
  const text=(label:string,key:'eligibilityCategory'|'country'|'city'|'timezone'|'jurisdiction',max:number)=><label>{activityCopy(label)}<input value={rules[key]} onChange={e=>update(key,e.target.value)} maxLength={max} required={key!=='jurisdiction'}/></label>;
  return <fieldset className="mc-rule-form" disabled={disabled}><legend>{copy('Competition & playing rules','შეჯიბრება და თამაშის წესები')}</legend>
    <CompetitionPresets rules={rules} onChange={onChange}/>
    <p>{copy('State the rules your organiser will apply. Discipline, team size and eligibility are separate choices.','მიუთითეთ ორგანიზატორის წესები. დისციპლინა, გუნდის ზომა და მონაწილეობის პირობები ცალკე არჩევანია.')}</p>
    <div className="mc-rule-grid"><label>{copy('Competition family','შეჯიბრების ოჯახი')}<select value={rules.family} onChange={e=>{const family=e.target.value as Family;onChange({...rules,family,structure:structures[family][0],standings:family!=='FESTIVAL'});}}>{Object.entries(familyLabels).filter(([value])=>value!=='LADDER').map(([value,label])=><option key={value} value={value}>{activityCopy(label)}</option>)}<optgroup label={copy("Advanced formats","დამატებითი ფორმატები")}><option value="LADDER">{copy("Ranked challenges","რეიტინგული გამოწვევები")}</option></optgroup></select></label>
      <label>{copy('Structure','სტრუქტურა')}<select value={rules.structure} onChange={e=>update('structure',e.target.value as CompetitionRules['structure'])}>{structures[rules.family].map(value=><option key={value} value={value}>{activityCopy(structureLabels[value])}</option>)}</select></label>
      <label>{copy('Discipline','დისციპლინა')}<select value={rules.discipline} onChange={e=>update('discipline',e.target.value as CompetitionRules['discipline'])}>{Object.entries({ASSOCIATION:'Association football',FUTSAL:'Futsal',BEACH:'Beach soccer',WALKING:'Walking football',OTHER:'Other ruleset'}).map(([value,label])=><option key={value} value={value}>{activityCopy(label)}</option>)}</select></label>
      {number(copy('Players per side','მოთამაშეები ერთ მხარეს'),'sideSize',3,11)}
      <label>{copy('Age group','ასაკობრივი ჯგუფი')}<select value={rules.ageGroup} onChange={e=>update('ageGroup',e.target.value)}>{ages.map(value=><option key={value} value={value}>{activityCopy(value)}</option>)}</select></label>
      {text(copy('Eligibility category','მონაწილეობის კატეგორია'),'eligibilityCategory',100)}
      <label>{copy('Playing level','თამაშის დონე')}<select value={rules.playingLevel} onChange={e=>update('playingLevel',e.target.value)}>{['DEVELOPMENT','RECREATIONAL','COMPETITIVE','ELITE'].map(value=><option key={value} value={value}>{activityCopy(value)}</option>)}</select></label>
      {rules.ageGroup.startsWith('U')&&<label>{copy('Age cutoff date','ასაკის ათვლის თარიღი')}<input type="date" required value={rules.ageCutoff||''} onChange={e=>update('ageCutoff',e.target.value||null)}/></label>}
      {text(copy('Country','ქვეყანა'),'country',100)}{text(copy('City','ქალაქი'),'city',120)}{text(copy('Timezone','დროის სარტყელი'),'timezone',80)}
    </div>
    <label>{copy('Ruleset & eligibility requirements','თამაშის წესები და მონაწილეობის პირობები')}<textarea required maxLength={2000} value={rules.ruleset} onChange={e=>update('ruleset',e.target.value)} placeholder={copy('Name the rules version and any age, roster, institution or qualification requirements.','მიუთითეთ წესების ვერსია და ასაკის, შემადგენლობის, დაწესებულების ან კვალიფიკაციის პირობები.')}/></label>
    <div className="mc-rule-grid">{number(copy('Match length, minutes','მატჩის ხანგრძლივობა, წუთი'),'matchMinutes',1,120)}{number(copy('Minimum rest, minutes','მინიმალური დასვენება, წუთი'),'restMinutes',0,240)}{number(copy('Available pitches','ხელმისაწვდომი მოედნები'),'pitches',1,20)}
      {['SWISS','ROTATION','KING_OF_PITCH'].includes(rules.structure)&&number(copy('Number of rounds','რაუნდების რაოდენობა'),'rounds',1,30)}
      {rules.family==='LADDER'&&<>{number('Challenge range, ranking positions','challengeRange',1,20)}{number('Challenge expiry, days','challengeExpiryDays',1,30)}</>}
      {rules.structure==='KING_OF_PITCH'&&number('Maximum consecutive stays','maxConsecutiveStays',1,10)}
    </div>
    {rules.family==='FESTIVAL'&&<label className="mc-rule-check"><input type="checkbox" checked={rules.standings} onChange={e=>update('standings',e.target.checked)}/>{copy('Publish standings and a champion','გამოაქვეყნეთ ცხრილი და ჩემპიონი')}</label>}
    {rules.structure==='SWISS'&&<p>{activityCopy("Pairings follow current points and the ordered tie-breaks. Repeat opponents and repeated byes are prevented. Confirm each round before generating the next.")}</p>}
    {rules.family==='LADDER'&&<p>{activityCopy("Rankings use this competition’s confirmed results: Elo starts at 1500, K=32. Challenge only inside the agreed range. The organiser resolves disputes; corrections recalculate the ranking.")}</p>}
    {rules.structure==='KING_OF_PITCH'&&<p>{activityCopy("Winners stay up to the configured limit. On a draw both teams rotate. Waiting teams with the fewest appearances enter first.")}</p>}
    {rules.structure==='ROTATION'&&<p>{activityCopy("Teams rotate through distinct opponents. Development festivals can finish without standings or a winner.")}</p>}
    <label>{copy('Season / reset / inactivity policy','სეზონის, განახლებისა და უმოქმედობის პოლიტიკა')}<textarea required maxLength={1000} value={rules.seasonPolicy} onChange={e=>update('seasonPolicy',e.target.value)} placeholder="State season dates, withdrawal/forfeit and inactivity decisions. Rankings restart for a new competition; historical results remain."/></label>
    <details><summary>{copy('Fees, governance & tie-breaks','საფასური, მმართველობა და თანაბარი შედეგები')}</summary>
      <div className="mc-rule-grid">{number(copy('Entry fee','მონაწილეობის საფასური'),'entryFee',0,1000000)}<label>{activityCopy("Currency")}<select value={rules.currency} onChange={e=>update('currency',e.target.value)}>{['GEL','EUR','USD','GBP'].map(value=><option key={value} value={value}>{activityCopy(value)}</option>)}</select></label><label>{activityCopy("Fee basis")}<select value={rules.feeBasis} onChange={e=>update('feeBasis',e.target.value as CompetitionRules['feeBasis'])}><option value="TEAM">{activityCopy("Per team")}</option><option value="PLAYER">{activityCopy("Per player")}</option><option value="EVENT">{activityCopy("Per event")}</option></select></label>{text('Jurisdiction / governing authority','jurisdiction',300)}</div>
      <p>{activityCopy("Self-reported rules and authority. No sanctioning or verification is implied.")}</p>
      <label>{activityCopy("Ordered tie-breaks")}<select value="" onChange={e=>{const value=e.target.value as Tiebreak;if(value&&!rules.tiebreaks.includes(value))update('tiebreaks',[...rules.tiebreaks,value]);}}><option value="">{activityCopy("Add tie-break")}</option>{['POINTS','GOAL_DIFFERENCE','GOALS_FOR','WINS','BUCHHOLZ','SEED'].filter(value=>!rules.tiebreaks.includes(value as Tiebreak)).map(value=><option key={value} value={value}>{activityCopy(value)}</option>)}</select></label>
      <ol className="mc-tiebreaks">{rules.tiebreaks.map((value,index)=><li key={value}><span>{activityCopy(value)}</span><button type="button" disabled={index===0} aria-label={`Move ${value} earlier`} onClick={()=>{const next=[...rules.tiebreaks];[next[index-1],next[index]]=[next[index],next[index-1]];update('tiebreaks',next);}}>{activityCopy("Earlier")}</button><button type="button" disabled={rules.tiebreaks.length===1} aria-label={`Remove ${value}`} onClick={()=>update('tiebreaks',rules.tiebreaks.filter(item=>item!==value))}>{activityCopy("Remove")}</button></li>)}</ol>
    </details>
  </fieldset>;
}
