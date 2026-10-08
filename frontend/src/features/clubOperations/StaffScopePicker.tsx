import type { Choice } from './api';
import './staff-team.css';

export interface StaffScopeSelection { clubWide: boolean; squadIds: number[] }

export function StaffScopePicker({squads,value,onChange,disabled=false}:{squads:Choice[];value:StaffScopeSelection;onChange:(value:StaffScopeSelection)=>void;disabled?:boolean}) {
  return <fieldset className="staff-scope-picker" disabled={disabled}>
    <legend>Team scope</legend>
    <label>Where this responsibility applies<select value={value.clubWide?'club':'teams'} onChange={e=>onChange({clubWide:e.target.value==='club',squadIds:[]})}>
      <option value="teams">Selected teams</option><option value="club">Whole club</option>
    </select></label>
    {value.clubWide?<p className="staff-access-note">The approved tools apply to club-wide records and every current and future team. Choose selected teams for academy, reserves or first-team work.</p>:<>
      <p>Select every team this person will support. For academy work, choose the academy teams. New teams need a revised appointment and approval.</p>
      <div className="staff-scope-teams" role="group" aria-label="Teams included">{squads.map(s=><label key={s.id}><input type="checkbox" checked={value.squadIds.includes(s.id)} onChange={e=>onChange({...value,squadIds:e.target.checked?[...value.squadIds,s.id]:value.squadIds.filter(id=>id!==s.id)})}/><span>{s.name}</span></label>)}</div>
      {!squads.length&&<p>No teams have been created yet. Add teams in the club workspace, or explicitly choose whole-club work.</p>}
      <p aria-live="polite">{value.squadIds.length?`${value.squadIds.length} ${value.squadIds.length===1?'team':'teams'} selected`:'Choose at least one team.'}</p>
    </>}
  </fieldset>;
}
