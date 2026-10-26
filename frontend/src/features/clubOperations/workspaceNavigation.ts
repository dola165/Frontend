import { BadgeCheck, BookOpen, Bus, CalendarCheck, ClipboardCheck, ClipboardList, HeartPulse, Landmark, MapPin, Package, Settings2, Shield, UserCheck, UserMinus, Users, Goal } from 'lucide-react';
import type { Bootstrap } from './api';
import { translate } from '../../locales/useCopy';
import { clubRecordsEn } from '../../locales/clubRecords';

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
export const staffTabs = new Set<string>(['personnel', 'staff-duties', 'credentials', 'specialists']);
export const availableOperationTabs = (boot: Bootstrap) => operationTabs.filter(item => item.module === 'HOME' || item.module === 'SETTINGS' && boot.leadership || boot.modules.some(m => m.id === item.module));
const DESCRIBED = ['HOME', 'STAFF', 'CREDENTIALS', 'SPECIALISTS', 'FACILITIES', 'READINESS', 'GUARDIANS', 'ATTENDANCE', 'REGISTRATION', 'DEVELOPMENT', 'EDUCATION', 'EQUIPMENT', 'FINANCE', 'TRAVEL', 'DEPARTURES', 'AVAILABILITY', 'MEDICAL', 'WELFARE'] as const;
/** What each tool is for, in one line, in the person's language. */
export const operationDescriptions: Record<string, string> = Object.defineProperties({}, Object.fromEntries(DESCRIBED.map(id => [id, { enumerable: true, get: () => translate('clubRecords', clubRecordsEn, `describe_${id}`) }])));
