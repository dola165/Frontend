/** Standalone QA entry only. All API requests are handled in memory; no credentials or services. */
/* eslint-disable react-refresh/only-export-components -- standalone React root, not an app module */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import i18n from '../../../i18n';
import '../../../index.css';
import '../../../styles/product-identity.css';
import '../../parents/family-theme.css';
import { SquadRoom } from '../../../pages/SquadCommunicationPage';
import type { SquadMessage, SquadSession, SquadOverview } from '../api';

if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    throw new Error('Local development fixture only');
}

// This entry is never imported by App. Remove inherited interceptors only in this QA page.
apiClient.interceptors.request.clear();
apiClient.interceptors.response.clear();
const at = new Date();at.setHours(18,0,0,0);at.setDate(at.getDate()+1);
const ends = new Date(at.getTime()+90*60000);
const params = new URLSearchParams(location.search);
const initialActor = params.get('actor') === 'parent' ? 'parent' : 'coach';
const initialDark = params.get('theme') === 'dark';
const initialLanguage = params.get('lang') === 'ka' ? 'ka' : 'en';
const clean = params.get('clean') === '1';
const sessionsSurface = params.get('surface') === 'sessions';
const scenario = ['empty','error','loading'].includes(params.get('case') || '') ? params.get('case') : 'populated';
document.documentElement.classList.toggle('dark', initialDark);
document.documentElement.lang = initialLanguage;
void i18n.changeLanguage(initialLanguage);
let staff = initialActor === 'coach';
const roster = [{ id: 61, name: 'ნიკა / Nika' }, { id: 62, name: 'საბა / Saba' }];
const sessions: SquadSession[] = [{ id: 9, title: 'Passing practice · პასების ვარჯიში', starts_at: at.toISOString(), ends_at: ends.toISOString(), location: 'Pitch A · მოედანი A', status: 'SCHEDULED', cancellation_reason: null, revision: 1, response_revision: 1,
    attendance: [{ ...roster[0], response: 'RECONFIRMATION_REQUIRED', response_status: 'RECONFIRMATION_REQUIRED', previous_response: 'GOING', active: true, recorded_by: 'GUARDIAN' }, { ...roster[1], response: 'GOING', previous_response: 'GOING', active: true, recorded_by: 'COACH' }] },
    { id: 10, title: 'Cancelled training · გაუქმებული ვარჯიში', starts_at: new Date(at.getTime()+86400000).toISOString(), ends_at: new Date(ends.getTime()+86400000).toISOString(), location: 'Pitch B', status: 'CANCELLED', cancellation_reason: 'Heavy rain · ძლიერი წვიმა', revision: 2, attendance: [{ ...roster[0], response: 'INVALIDATED', previous_response: 'GOING', active: true, recorded_by: 'GUARDIAN' }] }];
const room = (): SquadOverview => ({ id: 11, club_id: 1, name: 'U14', academy_name: 'Synthetic Academy', category: 'U14', can_manage: staff, can_assign_coach: false, head_coach_id: 21, viewer_id: staff ? 21 : 31, member_count: 4, unread_count: 0, notify_chat: true, players: roster, available_coaches: [], coaches: [{ user_id: 21, full_name: 'Coach Maia' }], threads: [{ user_id: 31, full_name: 'Parent', unread_count: scenario === 'empty' ? 0 : 1 }], attention: scenario === 'empty' ? undefined : { upcoming_sessions: 1, replies_needed: 1, acknowledgements_needed: 2 } });
const messages: SquadMessage[] = [{ id: 41, author_id: 21, author_name: 'Coach Maia', thread_user_id: null, kind: 'ANNOUNCEMENT', title: 'Tomorrow: bring rain jackets', body: 'Training stays on. Please reply to the updated session and bring a light rain jacket.', important: true, created_at: new Date(at.getTime()-3*3600000).toISOString(), acknowledgement_requested: true, acknowledged_at: null, acknowledged_by: [{ user_id: 62, full_name: 'Saba', acknowledged_at: new Date().toISOString() }], reactions: [{ user_id: 31, full_name: 'Parent', reaction: 'HEART' }], comment_count: 1 }];
apiClient.defaults.adapter = async config => {
    let data: unknown;
    const url = config.url ?? '';
    if (config.method === 'get' && url === '/squad-communication/11') {
        if (scenario === 'error') throw new Error('Synthetic squad loading failure');
        if (scenario === 'loading') return new Promise<never>(() => {});
        data = room();
    }
    else if (config.method === 'get' && url === '/squad-communication/11/messages') data = scenario === 'empty' ? [] : messages;
    else if (config.method === 'get' && url === '/squad-communication/11/sessions') data = sessions.filter(s => Date.parse(s.starts_at)<Date.parse(config.params.to) && Date.parse(s.ends_at)>Date.parse(config.params.from))
        .map(s => ({ ...s, attendance: s.attendance.filter(p => staff || config.params.playerId == null || p.id === config.params.playerId) })).filter(s => staff || s.attendance.length);
    else if (config.method === 'get' && url === '/schedule/clubs/1/events') data = { events: [] };
    else if (config.method === 'post' && url === '/squad-communication/11/read') data = { saved: true };
    else if (config.method === 'put' && /\/sessions\/9\/attendance$/.test(url)) {
        const command = JSON.parse(config.data);const person=sessions[0].attendance.find(p=>p.id===command.playerId)!;
        Object.assign(person,{ response:command.response, response_status:'VALID', previous_response:command.response, recorded_by:staff?'COACH':'GUARDIAN' });data={saved:true};
    } else throw new Error(`Synthetic preview does not implement ${config.method} ${url}. No request was sent.`);
    return { data: structuredClone(data), status: 200, statusText: 'Synthetic', headers: {}, config };
};
function Preview() {
    const [actor,setActor]=useState<'parent'|'coach'>(initialActor);const [dark,setDark]=useState(initialDark);const [language,setLanguage]=useState(initialLanguage);
    return <>{!clean&&<header style={{padding:16,borderBottom:'1px solid var(--theme-border)',display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}>
        <strong>Synthetic local preview · no live requests</strong>
        <label>View <select value={actor} onChange={e=>{staff=e.target.value==='coach';setActor(e.target.value as 'parent'|'coach');}}><option value="parent">Parent</option><option value="coach">Assigned coach</option></select></label>
        <span>Case: {scenario}</span>
        <button onClick={()=>{document.documentElement.classList.toggle('dark',!dark);setDark(!dark);}}>{dark?'Light':'Dark'}</button>
        <label>Language <select value={language} onChange={e=>{document.documentElement.lang=e.target.value;setLanguage(e.target.value);void i18n.changeLanguage(e.target.value);}}><option value="en">English</option><option value="ka">ქართული</option></select></label>
        <a href={`?actor=${actor}&surface=${sessionsSurface?'room':'sessions'}&theme=${dark?'dark':'light'}&lang=${language}`}>{sessionsSurface?'Squad room':'Session workspace'}</a>
    </header>}<SquadRoom key={`${actor}:${sessionsSurface}`} id={11}/></>;
}
if (!import.meta.env.DEV || !['localhost','127.0.0.1','[::1]'].includes(location.hostname)) throw new Error('Synthetic preview is local development only.');
const root = createRoot(document.getElementById('root')!);
root.render(<MemoryRouter initialEntries={[sessionsSurface?'/squads/11?tab=sessions':'/squads/11']}><Routes><Route path="*" element={<Preview/>}/></Routes></MemoryRouter>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
