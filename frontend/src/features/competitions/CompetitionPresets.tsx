import {useTranslation} from 'react-i18next';
import type {CompetitionRules} from './api';
const presets:{id:string;en:string;ka:string;rules:Partial<CompetitionRules>}[]=[
  {id:'knockout',en:'Knockout cup',ka:'თასი გამოვარდნით',rules:{family:'CUP',structure:'KNOCKOUT',standings:true}},
  {id:'roundrobin',en:'Round-robin league',ka:'წრიული ლიგა',rules:{family:'LEAGUE',structure:'ROUND_ROBIN',standings:true}},
  {id:'league',en:'Home & away league',ka:'საშინაო და გასვლითი ლიგა',rules:{family:'LEAGUE',structure:'HOME_AWAY',standings:true,discipline:'ASSOCIATION',sideSize:11,matchMinutes:90,restMinutes:30}},
  {id:'swiss',en:'Three-round Swiss',ka:'შვეიცარიული — სამი რაუნდი',rules:{family:'LEAGUE',structure:'SWISS',standings:true,rounds:3}},
  {id:'cup',en:'Groups into a cup',ka:'ჯგუფები და თასი',rules:{family:'CUP',structure:'GROUPS_KNOCKOUT',standings:true}},
  {id:'futsal',en:'Futsal cup',ka:'ფუტსალის თასი',rules:{family:'CUP',structure:'KNOCKOUT',standings:true,discipline:'FUTSAL',sideSize:5,matchMinutes:40,restMinutes:20}},
  {id:'festival',en:'Small-sided development festival',ka:'მცირე ფორმატის განვითარების ფესტივალი',rules:{family:'FESTIVAL',structure:'ROTATION',standings:false,discipline:'ASSOCIATION',sideSize:5,matchMinutes:12,restMinutes:8,rounds:3}},
  {id:'king',en:'King of the Pitch rotation',ka:'მოედნის მეფე — მონაცვლეობა',rules:{family:'FESTIVAL',structure:'KING_OF_PITCH',standings:false,matchMinutes:10,restMinutes:5,maxConsecutiveStays:2}},
];
export function CompetitionPresets({rules,onChange}:{rules:CompetitionRules;onChange:(rules:CompetitionRules)=>void}){
  const {i18n}=useTranslation();const ka=i18n.language.startsWith('ka');
  return <div><label>{ka?'დაიწყეთ ფორმატის ნიმუშით':'Start from a format preset'}<select value="" onChange={e=>{const preset=presets.find(p=>p.id===e.target.value);if(preset)onChange({...rules,...preset.rules});}}><option value="">{ka?'აირჩიეთ საწყისი ფორმატი':'Choose a starting format'}</option>{presets.map(p=><option key={p.id} value={p.id}>{ka?p.ka:p.en}</option>)}</select></label><p>{ka?'საწყისი მნიშვნელობები შესაცვლელია. მატჩების შექმნამდე გამოაქვეყნეთ წესების ვერსია, მონაწილეობის პირობები და თამაშის დროის უფლებამოსილი საფუძველი.':'Presets supply editable starting values. Publish your rules version, eligibility and playing-time authority before creating fixtures.'}</p></div>;
}
