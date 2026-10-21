import { TournamentSettings } from './TournamentSettings';
import type { TournamentDetail } from '../domain';
export const EventSettingsPanel = ({tournament,onRefresh}:{tournament:TournamentDetail;onRefresh:()=>void}) => <TournamentSettings tournament={tournament} onUpdate={onRefresh}/>;
