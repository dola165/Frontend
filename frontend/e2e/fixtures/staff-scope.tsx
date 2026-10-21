import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { StaffAppointmentForm } from '../../src/features/clubOperations/StaffAppointmentForm';
import { StaffScopePicker, type StaffScopeSelection } from '../../src/features/clubOperations/StaffScopePicker';
import type { Bootstrap } from '../../src/features/clubOperations/api';
import '../../src/index.css';
import '../../src/styles/product-identity.css';
import '../../src/features/clubOperations/operations.css';
import '../../src/features/clubOperations/workspace-operations.css';
import '../../src/features/clubOperations/workspace-roles.css';
import '../../src/features/recruitment/recruitment-offers.css';
const boot:Bootstrap={clubId:1,clubName:'FC Dinamo Tbilisi Academy',actorId:1,leadership:true,definitions:[],specialisations:['HEAD_COACH','TECHNICAL_COACH','SET_PIECE_COACH','REHABILITATION_COACH','SPORTS_SCIENTIST','OTHER'],permissions:[],settings:{setting:'CLUB_ACADEMY',playing_level:'AMATEUR',enabled_modules:[],revision:0},modules:[],squads:[{id:11,name:'Academy U12'},{id:12,name:'Academy U16'},{id:13,name:'First team'},{id:14,name:'Reserve team'}],people:[],staff:[],venues:[],guardians:[],events:[],sessions:[],links:[]};
const roles=[{key:'TECHNICAL_COACH',family:'Specialist coaching',title:'Technical coach',description:'Technical development for selected teams.',permissions:['DEVELOPMENT:WRITE','ATTENDANCE:WRITE','AVAILABILITY:READ']},{key:'REHABILITATION_COACH',family:'Specialist coaching',title:'Rehabilitation coach',description:'Return to training using participation restrictions. No clinical records.',permissions:['DEVELOPMENT:WRITE','AVAILABILITY:READ']}];
document.body.className='workspace-page-shell'+(new URLSearchParams(location.search).get('theme')==='light'?' workspace-light':'');
document.body.style.background='var(--fc-page-bg)';
export function ReusedPicker({surface}:{surface:string}) {
 const [scope,setScope]=useState<StaffScopeSelection>({clubWide:false,squadIds:[]});
 return <main style={{maxWidth:720,margin:'0 auto',padding:16,color:'var(--fc-text-primary)'}}><p>Isolated {surface} layout fixture</p><section className={surface==='roles'?'role-management':'recruitment-offer'}><form className={surface==='roles'?'role-request-form':'recruitment-form'}><fieldset><StaffScopePicker squads={boot.squads} value={scope} onChange={setScope}/></fieldset></form></section></main>;
}
const surface=new URLSearchParams(location.search).get('surface');
createRoot(document.getElementById('root')!).render(surface?<ReusedPicker surface={surface}/>:<main className="club-ops club-ops-embedded staff-team" style={{maxWidth:1280,margin:'0 auto',padding:16}}><p role="note">Isolated interface fixture · no invitation will be sent.</p><StaffAppointmentForm boot={boot} initialPerson={{id:2,name:'Fixture staff member'}} roles={roles} onSaved={()=>{}} onCancel={()=>{}}/></main>);
