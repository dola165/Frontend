import { useMemo } from 'react';
import type { TournamentDetail } from './domain';

export interface TournamentPermissions {
    isAdmin: boolean;
    isStaff: boolean;
    isReferee: boolean;
    /** Admin or staff — bracket building, teams, destructive actions. */
    canManage: boolean;
    /** Admin, staff or referee — score entry during play. */
    canScore: boolean;
    /** Admin only — settings incl. the banner. */
    canEditSettings: boolean;
}

/**
 * P7 access-control groundwork: role derived from the viewer's active staff
 * assignment on the tournament. Full enforcement lands in P8.
 */
export const useTournamentPermissions = (
    tournament: TournamentDetail | null,
    userId?: number | null,
): TournamentPermissions => {
    return useMemo(() => {
        const assignment = tournament?.staffAssignments?.find(
            (s) => s.userId === userId && s.status === 'ACTIVE',
        );
        const role = assignment?.role;
        const isAdmin = role === 'ADMIN';
        const isStaff = role === 'STAFF' || isAdmin;
        const isReferee = role === 'REFEREE';
        return {
            isAdmin,
            isStaff,
            isReferee,
            canManage: isStaff,
            canScore: isStaff || isReferee,
            canEditSettings: isAdmin,
        };
    }, [tournament, userId]);
};
