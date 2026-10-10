import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { clubViewerRole } from '../../../components/club/clubViewerRole';
import { fetchClubManagementOverview, fetchMyClubMembershipContext } from '../api';
import { canManageClubOperations, isLeadershipRole, type ClubMembershipRole } from '../domain';
import { currentProgramme } from '../presentation';
import type { ClubProfile } from './types';

interface WorkspaceEntry { canOpenWorkspace: boolean; canEditFacilities: boolean; canManageStaff: boolean; invitationOnly?: boolean }

/**
 * The club, the viewer's relationship to it and what the viewer may do there.
 * Every permission comes from the server's membership and workspace answers, never from a football role.
 */
export function useClubProfile(id: number) {
    const { status, sessionId } = useAuth();
    const [revision, setRevision] = useState(0);
    // Each answer is kept with the request it belongs to, so a newer club, account or retry never shows an older answer.
    const clubKey = `${id}:${sessionId}:${revision}`;
    const [result, setResult] = useState<{ key: string; club: ClubProfile | null; failed: boolean } | null>(null);
    const memberKey = `${sessionId}:${status}:${revision}`;
    const [membershipResult, setMembershipResult] = useState<{ key: string; clubId: number | null; role: string | null } | null>(null);
    const entryKey = `${id}:${sessionId}:${status}`;
    const [entryResult, setEntryResult] = useState<{ key: string; value: WorkspaceEntry | null } | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        void apiClient.get<ClubProfile>(`/clubs/${id}`, { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setResult({ key: clubKey, club: response.data, failed: false }); })
            .catch(error => { if (!controller.signal.aborted) setResult({ key: clubKey, club: null, failed: error?.response?.status !== 404 }); });
        return () => controller.abort();
    }, [id, clubKey]);

    useEffect(() => {
        if (status !== 'authenticated') return;
        let current = true;
        void fetchMyClubMembershipContext().catch(() => null)
            .then(context => { if (current) setMembershipResult({ key: memberKey, clubId: context?.clubId ?? null, role: context?.myRole ?? null }); });
        return () => { current = false; };
    }, [status, memberKey]);

    useEffect(() => {
        if (status !== 'authenticated') return;
        const controller = new AbortController();
        void apiClient.get<WorkspaceEntry>(`/clubs/${id}/workspace-entry`, { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setEntryResult({ key: entryKey, value: response.data }); })
            .catch(() => { if (!controller.signal.aborted) setEntryResult({ key: entryKey, value: null }); });
        return () => controller.abort();
    }, [id, status, entryKey]);

    // While a refresh is on its way the page keeps showing the club it has.
    const club = result && result.key.startsWith(`${id}:${sessionId}:`) ? result.club : null;
    const loading = result?.key !== clubKey;
    const failed = result?.key === clubKey && result.failed;
    const setClub = (change: (previous: ClubProfile | null) => ClubProfile | null) => setResult(previous => previous ? { ...previous, club: change(previous.club) } : previous);
    const membership = status === 'authenticated' && membershipResult && membershipResult.key.startsWith(`${sessionId}:${status}:`) ? membershipResult : { clubId: null, role: null };
    const entry = status === 'authenticated' && entryResult?.key === entryKey ? entryResult.value : null;

    // Viewing your own club without a role on the profile: confirm the role through the management overview.
    useEffect(() => {
        if (!club || status !== 'authenticated' || membership.clubId !== id || club.myRole) return;
        let cancelled = false;
        void fetchClubManagementOverview(id).then(overview => {
            if (!cancelled && overview.currentUserRole) setResult(previous => previous?.club ? { ...previous, club: { ...previous.club, myRole: overview.currentUserRole } } : previous);
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [club, id, membership.clubId, status]);

    const role = clubViewerRole(id, club?.myRole, membership.clubId, membership.role);
    const own = Boolean(club?.isStaffMember || club?.myRole || entry?.canOpenWorkspace || (membership.clubId !== null && membership.clubId === id));
    const affiliated = club?.playerAffiliationStatus === 'TRIALIST' || club?.playerAffiliationStatus === 'ACTIVE';
    const visitor = Boolean(club && !club.isStaffMember && !affiliated);
    const programmes = Boolean(club?.presentation?.programmes.some(p => p.published && currentProgramme(p)));
    const connected = Boolean(club && (club.isMember || club.isStaffMember || club.myRole || role || affiliated
        || club.relationshipState === 'ACTIVE' || club.relationshipState === 'TRIALIST'));
    const permissions = {
        role: role as ClubMembershipRole | null,
        own,
        connected,
        isLeader: own && isLeadershipRole(role),
        canManage: own && canManageClubOperations(role),
        canOpenWorkspace: Boolean(entry?.canOpenWorkspace || (own && canManageClubOperations(role))),
        invitationOnly: Boolean(entry?.invitationOnly),
        canEditFacilities: Boolean(entry?.canEditFacilities),
        canManageStaff: Boolean(entry?.canManageStaff),
        canPost: own && canManageClubOperations(role),
        canMessage: visitor,
        canFollow: Boolean(club && !club.isMember),
        canChallenge: visitor && Boolean(membership.clubId && membership.clubId !== id && membership.role && canManageClubOperations(membership.role)),
        /** Joining is offered to people with no connection here, when the club takes players or publishes training. */
        canJoin: visitor && !connected && (programmes || club?.playerJoinPolicy !== 'INVITE_ONLY'),
        myClubId: membership.clubId,
    };

    const refresh = () => setRevision(value => value + 1);
    const toggleFollow = async () => {
        if (!club) return;
        const previous = club;
        setClub(() => ({ ...club, isFollowedByMe: !club.isFollowedByMe, followerCount: Math.max(0, club.followerCount + (club.isFollowedByMe ? -1 : 1)) }));
        try { await apiClient.post(`/clubs/${id}/follow`); refresh(); }
        catch (error) { setClub(() => previous); throw error; }
    };
    // Leaving the club changes the membership as well as the club, so both are asked again.
    const leftClub = async () => { refresh(); };
    const forgetMembership = () => setMembershipResult({ key: memberKey, clubId: null, role: null });
    const updateImage = async (field: 'banner' | 'logo', url: string) => {
        await apiClient.put(`/clubs/${id}`, field === 'banner' ? { bannerUrl: url } : { logoUrl: url });
        refresh();
    };
    return { club, loading, failed, permissions, refresh, toggleFollow, leftClub, updateImage, forgetMembership };
}

export type ClubPermissions = ReturnType<typeof useClubProfile>['permissions'];
