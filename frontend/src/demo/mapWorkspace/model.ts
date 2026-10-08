export type PlaceType = 'ground' | 'academy' | 'stay' | 'meeting';
export type Decision = 'confirmed' | 'pending' | 'declined';
export interface Place {
  id: string; name: string; type: PlaceType; coords: [number, number]; region: 'Tallinn' | 'Tbilisi';
  description: string; conditions: string[]; capacity: number; age: string; availability: string; minutes: number; price?: number; source: string;
}
export interface Activity {
  id: string; day: string; start: string; end: string; title: string; kind: 'training' | 'match' | 'travel' | 'meal' | 'stay' | 'meeting';
  placeId: string; owner: string; note: string; journeyFrom?: string; estimate?: number; buffer?: number; arrangement?: Decision;
}
export interface Draft { activities: Activity[]; accommodation: string; hotelDecision: Decision; mealsResolved: boolean; extraTransport: number }
export interface Publication { version: number; revision: number; draft: Draft; at: string; summary: string; permissionVersion: number }
export interface FamilyRecord { childId: string; acknowledgedVersion: number; permissions: { version: number; status: 'granted' | 'pending'; actor: string; at: string }[] }
export interface ScheduleValues { trainingStart: string; trainingEnd: string; departure: string; arrival: string; warmup: string; kickoff: string }
export interface Proposal extends ScheduleValues { id: string; baseRevision: number; before?: ScheduleValues; applied: boolean }
export interface HistoryEntry { id: string; text: string; actor: string; at: string }
export interface Plan {
  id: string; name: string; squad: string; start: string; end: string; region: 'Tallinn' | 'Tbilisi'; timezone: string; revision: number;
  draft: Draft; published: Publication | null; publications: Publication[]; approval: { amount: number; decision: Decision; version: number };
  supplier: { decision: Decision; version: number }; incoming: null | { status: 'pending' | 'requested' | 'applied' | 'published'; request?: string };
  proposal: Proposal | null; families: FamilyRecord[]; boarding: Record<string, 'expected' | 'boarded' | 'absent'>; saved: string[];
  history: HistoryEntry[]; undo: Draft[]; equipmentOwner: string; progress: 'planning' | 'boarding' | 'departed' | 'arrived'; clock: string;
  milestone: null | { status: string; at: string; actor: string; next: string }; baseCosts: { category: string; cents: number; committed: number; paid: number }[];
  contribution: number;
}
export interface Store { schema: 1; activeId: string; plans: Record<string, Plan> }
export const staff = [
  { id: 'coach', name: 'Maia Demo', role: 'Lead coach · squad planning', initials: 'MD' },
  { id: 'travel', name: 'Ana Demo', role: 'Travel coordinator', initials: 'AD' },
  { id: 'assistant', name: 'Giorgi Demo', role: 'Assistant coach · equipment', initials: 'GD' },
  { id: 'care', name: 'Salome Demo', role: 'Player care · family contact', initials: 'SD' },
];
export const players = Array.from({ length: 18 }, (_, i) => ({ id: `player-${i+1}`, name: `Player ${String(i+1).padStart(2,'0')} Demo`, guardian: `Guardian ${String(i+1).padStart(2,'0')} Demo` }));
export const passengers = [...players, ...staff.map(s=>({ id:s.id, name:s.name }))];
export const ownerName = (id: string) => staff.find(s=>s.id===id)?.name ?? (id==='leader'?'Nino Demo · club director':id==='supplier'?'Baltic Team Transport Demo':id==='fixture'?'Scenario fixture':id);
export const money = (cents: number) => new Intl.NumberFormat('en-IE',{ style:'currency', currency:'EUR', maximumFractionDigits:cents%100?2:0 }).format(cents/100);
export const clone = <T,>(value:T):T => structuredClone(value);
export const minutes = (t:string) => Number(t.slice(0,2))*60+Number(t.slice(3,5));
export const addMinutes = (t:string,n:number) => { const v=minutes(t)+n; return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`; };
export const dateLabel = (d:string, long=false) => new Intl.DateTimeFormat('en-GB',{day:'numeric',month:long?'long':'short',timeZone:'UTC'}).format(new Date(`${d}T12:00:00Z`));
export const timeLabel = (at:string, tz:string) => new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:tz}).format(new Date(at));
