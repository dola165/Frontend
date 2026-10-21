import { useMemo } from 'react';
import type { TournamentDetail } from './domain';

export interface TournamentPermissions {
    isAdmin: boolean;
    isStaff: boolean;
    isReferee: boolean;
    /** Admin or staff — bracket building, teams, destructive actions. */
    canManage: boolean;
    /** Admin or staff — matches the backend tournament operator policy. */
    canScore: boolean;
    /** Admin only — settings incl. the banner. */
    canEditSettings: boolean;
}

/** Role derived from the viewer's active staff assignment on the tournament. */
export const useTournamentPermissions = (
    tournament: TournamentDetail | null,
    userId?: number | null,
): TournamentPermissions => {
    return useMemo(() => {
        const assignments = tournament?.staffAssignments?.filter(
            (s) => userId != null && s.userId === userId && s.status === 'ACTIVE',
        );
        const isAdmin = assignments?.some(assignment => assignment.role === 'ADMIN') === true;
        const isStaff = isAdmin || assignments?.some(assignment => assignment.role === 'STAFF') === true;
        const isReferee = assignments?.some(assignment => assignment.role === 'REFEREE') === true;
        return {
            isAdmin,
            isStaff,
            isReferee,
            canManage: isStaff,
            canScore: isStaff,
            canEditSettings: isAdmin,
        };
    }, [tournament, userId]);
};
