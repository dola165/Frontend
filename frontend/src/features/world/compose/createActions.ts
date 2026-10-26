import { CalendarPlus, Briefcase, Megaphone, Shield, Trophy, type LucideIcon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { canManageClubOperations } from '../../clubs/domain';
import { createHref } from '../../pages/create/entry';
import { useMayCreatePages } from '../../pages/create/useMayCreatePages';
import { useWorldSession } from '../worldSession';
import { drawPeek } from '../../tournaments/create/drawDraft';
import { arrangePeek } from './arrangeSeed';
import { useArrangeableSquads } from './useArrangeableSquads';

export type CreateId = 'create-page' | 'arrange' | 'open-match' | 'post-job' | 'create-tournament';
/** One thing a person can start from World: opened in World's frame (`peek`: a match, a tournament) or, for a page, the start sheet over this page (`to`). */
export interface CreateAction { id: CreateId; label: string; icon: LucideIcon; group: 'Page' | 'Matches' | 'Club' | 'Tournaments'; peek?: string; to?: string }

/**
 * What this person can start, by real permissions only (never the role picked in World): a page for anyone signed
 * in (first, with Club pre-chosen on the Clubs tab), matches for anyone with squads they may arrange for, a job for
 * club staff who run its operations, a tournament for anyone (setting up the organiser comes first when they have
 * none). Undefined while the permissions load, so nothing appears and then vanishes.
 */
export function useCreateActions(): CreateAction[] | undefined {
    const { status } = useAuth();
    const { membership } = useWorldSession();
    const squads = useArrangeableSquads();
    const location = useLocation();
    const adult = useMayCreatePages();
    if (status !== 'authenticated') return status === 'bootstrapping' ? undefined : [];
    if (squads === undefined || membership === undefined) return undefined;
    const canArrange = squads.length > 0;
    const clubId = membership?.clubId;
    const onClubs = location.pathname === '/world/clubs';
    const offered: (CreateAction | false | null | undefined)[] = [
        adult && { id: 'create-page', label: 'Create a page', icon: Shield, group: 'Page', to: createHref(location, onClubs ? 'CLUB' : null, onClubs ? 'world-clubs' : 'world') },
        canArrange && { id: 'arrange', label: 'Arrange a match', icon: CalendarPlus, group: 'Matches', peek: arrangePeek({ mode: 'direct' }) },
        canArrange && { id: 'open-match', label: 'Post an open match', icon: Megaphone, group: 'Matches', peek: arrangePeek({ mode: 'open' }) },
        clubId != null && canManageClubOperations(membership?.myRole) && { id: 'post-job', label: 'Post a job', icon: Briefcase, group: 'Club', to: `/clubs/${clubId}/workspace?tab=jobs` },
        { id: 'create-tournament', label: 'Create a tournament', icon: Trophy, group: 'Tournaments', peek: drawPeek() },
    ];
    return offered.filter((action): action is CreateAction => Boolean(action));
}
