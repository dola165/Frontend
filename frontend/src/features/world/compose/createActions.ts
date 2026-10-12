import { CalendarPlus, Briefcase, LandPlot, Megaphone, Shield, Trophy, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { canManageClubOperations } from '../../clubs/domain';
import { useWorldSession } from '../worldSession';
import { drawPeek } from '../../tournaments/create/drawDraft';
import { arrangePeek } from './arrangeSeed';
import { useArrangeableSquads } from './useArrangeableSquads';

export type CreateId = 'arrange' | 'open-match' | 'post-job' | 'create-tournament' | 'create-club' | 'list-venue';
/** One thing a person can start from World: opened in World's frame (`peek`: a match, a tournament) or, for setting up an organisation, its page (`to`). */
export interface CreateAction { id: CreateId; label: string; icon: LucideIcon; group: 'Matches' | 'Club' | 'Tournaments' | 'Places'; peek?: string; to?: string }

/**
 * What this person can start, by real permissions only (never the role picked in World): matches for anyone with squads
 * they may arrange for, a job for club staff who run its operations, a club for someone the server lets create one, a
 * tournament or a venue for anyone signed in (setting up the organiser comes first when they have none). Undefined
 * while the permissions load, so nothing appears and then vanishes.
 */
export function useCreateActions(): CreateAction[] | undefined {
    const { status } = useAuth();
    const { membership } = useWorldSession();
    const squads = useArrangeableSquads();
    if (status !== 'authenticated') return status === 'bootstrapping' ? undefined : [];
    if (squads === undefined || membership === undefined) return undefined;
    const canArrange = squads.length > 0;
    const clubId = membership?.clubId;
    const offered: (CreateAction | false | null | undefined)[] = [
        canArrange && { id: 'arrange', label: 'Arrange a match', icon: CalendarPlus, group: 'Matches', peek: arrangePeek({ mode: 'direct' }) },
        canArrange && { id: 'open-match', label: 'Post an open match', icon: Megaphone, group: 'Matches', peek: arrangePeek({ mode: 'open' }) },
        clubId != null && canManageClubOperations(membership?.myRole) && { id: 'post-job', label: 'Post a job', icon: Briefcase, group: 'Club', to: `/clubs/${clubId}/workspace?tab=jobs` },
        { id: 'create-tournament', label: 'Create a tournament', icon: Trophy, group: 'Tournaments', peek: drawPeek() },
        membership?.canCreateClub && { id: 'create-club', label: 'Create a club', icon: Shield, group: 'Places', to: '/organizations/create?kind=CLUB' },
        { id: 'list-venue', label: 'List your venue', icon: LandPlot, group: 'Places', to: '/organizations/create?kind=VENUE' },
    ];
    return offered.filter((action): action is CreateAction => Boolean(action));
}
