import { useCallback, useEffect, useState } from 'react';
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
    const [club, setClub] = useState<ClubProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [revision, setRevision] = useState(0);
    const [membership, setMembership] = useState<{ clubId: number | null; role: string | null }>({ clubId: null, role: null });
    const [entry, setEntry] = useState<WorkspaceEntry | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        void apiClient.get<ClubProfile>(`/clubs/${id}`, { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) { setClub(response.data); setFailed(false); } })
            .catch(error => { if (!controller.signal.aborted) { setClub(null); setFailed(error?.response?.status !== 404); } })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [id, sessionId, revision]);

    const loadMembership = useCallback(async () => {
        const context = await fetchMyClubMembershipContext().catch(() => null);
        setMembership({ clubId: context?.clubId ?? null, role: context?.myRole ?? null });
    }, []);
    useEffect(() => {
        if (status !== 'authenticated') { setMembership({ clubId: null, role: null }); return; }
        void loadMembership();
    }, [id, status, loadMembership]);

    useEffect(() => {
        setEntry(null);
        if (status !== 'authenticated') return;
        const controller = new AbortController();
        void apiClient.get<WorkspaceEntry>(`/clubs/${id}/workspace-entry`, { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setEntry(response.data); })
            .catch(() => { if (!controller.signal.aborted) setEntry(null); });
        return () => controller.abort();
    }, [id, status, sessionId]);

    // Viewing your own club without a role on the profile: confirm the role through the management overview.
    useEffect(() => {
        if (!club || status !== 'authenticated' || membership.clubId !== id || club.myRole) return;
        let cancelled = false;
        void fetchClubManagementOverview(id).then(overview => {
            if (!cancelled && overview.currentUserRole) setClub(previous => previous ? { ...previous, myRole: overview.currentUserRole } : previous);
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
        setClub({ ...club, isFollowedByMe: !club.isFollowedByMe, followerCount: Math.max(0, club.followerCount + (club.isFollowedByMe ? -1 : 1)) });
        try { await apiClient.post(`/clubs/${id}/follow`); refresh(); }
        catch (error) { setClub(previous); throw error; }
    };
    const leftClub = async () => { await loadMembership(); refresh(); };
    const updateImage = async (field: 'banner' | 'logo', url: string) => {
        await apiClient.put(`/clubs/${id}`, field === 'banner' ? { bannerUrl: url } : { logoUrl: url });
        refresh();
    };
    return { club, loading, failed, permissions, refresh, toggleFollow, leftClub, updateImage, setMembership };
}

export type ClubPermissions = ReturnType<typeof useClubProfile>['permissions'];
