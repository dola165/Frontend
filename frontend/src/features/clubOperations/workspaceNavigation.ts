import { BadgeCheck, BookOpen, Bus, CalendarCheck, ClipboardCheck, ClipboardList, HeartPulse, Landmark, MapPin, Package, Settings2, Shield, UserCheck, UserMinus, Users, Goal } from 'lucide-react';
import type { Bootstrap } from './api';

export const operationTabs = [
  { id: 'actions', module: 'HOME', label: 'Outstanding actions', icon: ClipboardList, group: 'Club' },
  { id: 'staff-duties', module: 'STAFF', label: 'Staff duties', icon: Users, group: 'Staff' },
  { id: 'credentials', module: 'CREDENTIALS', label: 'Credentials', icon: BadgeCheck, group: 'Staff' },
  { id: 'specialists', module: 'SPECIALISTS', label: 'Specialists', icon: UserCheck, group: 'Staff' },
  { id: 'guardians', module: 'GUARDIANS', label: 'Guardians & permissions', icon: Shield, group: 'People' },
  { id: 'attendance', module: 'ATTENDANCE', label: 'Attendance & collection', icon: CalendarCheck, group: 'People' },
  { id: 'registration', module: 'REGISTRATION', label: 'Registration', icon: ClipboardCheck, group: 'People' },
  { id: 'departures', module: 'DEPARTURES', label: 'Departures', icon: UserMinus, group: 'People' },
  { id: 'development', module: 'DEVELOPMENT', label: 'Player development', icon: Goal, group: 'Football' },
  { id: 'education', module: 'EDUCATION', label: 'Education', icon: BookOpen, group: 'Football' },
  { id: 'facilities', module: 'FACILITIES', label: 'Venues & facilities', icon: MapPin, group: 'Club' },
  { id: 'preparation', module: 'READINESS', label: 'Match preparation', icon: ClipboardCheck, group: 'Football' },
  { id: 'equipment', module: 'EQUIPMENT', label: 'Equipment', icon: Package, group: 'Administration' },
  { id: 'finance', module: 'FINANCE', label: 'Finance', icon: Landmark, group: 'Administration' },
  { id: 'travel', module: 'TRAVEL', label: 'Travel', icon: Bus, group: 'Administration' },
  { id: 'restrictions', module: 'AVAILABILITY', label: 'Participation restrictions', icon: HeartPulse, group: 'Care' },
  { id: 'medical', module: 'MEDICAL', label: 'Medical coordination', icon: HeartPulse, group: 'Care' },
  { id: 'welfare', module: 'WELFARE', label: 'Confidential welfare', icon: Shield, group: 'Care' },
  { id: 'workspace-settings', module: 'SETTINGS', label: 'Workspace settings', icon: Settings2, group: 'Club' },
] as const;
export type OperationTab = typeof operationTabs[number]['id'];
export const operationModule = (tab: string) => operationTabs.find(item => item.id === tab)?.module;
export const operationTab = (module: string | null) => operationTabs.find(item => item.module === module)?.id ?? 'actions';
export const staffTabs = new Set<string>(['personnel', 'staff-duties', 'credentials', 'specialists', 'role-requests']);
export const availableOperationTabs = (boot: Bootstrap) => operationTabs.filter(item => item.module === 'HOME' || item.module === 'SETTINGS' && boot.leadership || boot.modules.some(m => m.id === item.module));
export const operationDescriptions: Record<string, string> = {
  HOME: 'Upcoming deadlines, expiring credentials and decisions that need your attention.',
  STAFF: 'Appoint your staff, assign responsibilities and arrange cover.', CREDENTIALS: 'Keep qualifications, evidence and renewal dates together.',
  SPECIALISTS: 'Coordinate external specialists, their bookings and engagement dates.', FACILITIES: 'Manage playing venues and supporting facilities, with practical information for visitors.',
  READINESS: 'Prepare emergency information, competition requirements and match-day checks.', GUARDIANS: 'Manage emergency contacts, collection arrangements and separate permissions.',
  ATTENDANCE: 'Record who arrived, who is absent and who collected each player.', REGISTRATION: 'Track documents, competition approvals and registration deadlines.',
  DEVELOPMENT: 'Set individual goals, record observations and plan reviews.', EDUCATION: 'Plan around exams, school commitments and education contacts.',
  EQUIPMENT: 'Manage club inventory, issues to players and squads, maintenance and returns.', FINANCE: 'Manage budgets, requests, receipts and membership instalments.',
  TRAVEL: 'Organise trips, passenger lists, responsibilities and departure checks.', DEPARTURES: 'Complete returns, access changes and departure administration.',
  AVAILABILITY: 'See the restrictions relevant to safe participation.', MEDICAL: 'Coordinate appointments, clinical records and professional clearance within your access.',
  WELFARE: 'Handle confidential concerns, assigned follow-ups and review dates.',
};
