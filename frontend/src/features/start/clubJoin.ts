import { apiClient } from '../../api/axiosConfig';
import { fetchMyClubInvitations } from '../clubs/api';
import type { Appointment } from '../clubOperations/api';
import type { LinkInvite } from '../clubOperations/people/inviteLinkApi';

/**
 * Joining a club from the welcome (owner, 27 October): Join accepts a job or membership this person was already
 * invited to there; otherwise the code from the admin's staff link. Nobody asks to join.
 */

/**
 * Every invite this person has not answered yet: staff jobs (`GET /club-operations/mine`, still INVITED) and club
 * memberships (`GET /club-memberships/invites/me`, PENDING), in the shape the invite link's accept takes. A list that
 * fails to load counts as none: the person is then asked for the code, which always works.
 */
export async function fetchPendingClubInvites(signal?: AbortSignal): Promise<LinkInvite[]> {
    const [mine, memberships] = await Promise.all([
        apiClient.get<{ appointments?: Appointment[] }>('/club-operations/mine', { signal }).then(r => r.data.appointments ?? [], () => [] as Appointment[]),
        fetchMyClubInvitations().catch(() => []),
    ]);
    const jobs = mine.filter(job => (job.effective_status ?? job.status) === 'INVITED').map((job): LinkInvite => ({
        kind: 'APPOINTMENT', id: job.id, revision: job.revision, clubId: job.club_id, clubName: job.club_name ?? '', clubLogoUrl: null, invitedBy: null,
        job: job.title, title: job.title, clubWide: job.club_wide ?? job.squad_id == null, squads: job.squad_names ?? (job.squad_name ? [job.squad_name] : []), unavailableReason: job.unavailable_reason ?? null,
    }));
    const members = memberships.filter(invite => invite.status === 'PENDING').map((invite): LinkInvite => ({
        kind: 'MEMBERSHIP', id: invite.id, revision: null, clubId: invite.clubId, clubName: invite.clubName, clubLogoUrl: null, invitedBy: null,
        job: invite.role, title: invite.role, clubWide: true, squads: [], unavailableReason: null,
    }));
    return [...jobs, ...members];
}

/** The code from what was typed or pasted: the code itself, or a whole staff link (`…/staff-invite/{code}`). */
export function staffCodeFrom(text: string): string {
    const value = text.trim();
    const fromLink = /staff-invite\/([^/?#\s]+)/i.exec(value);
    return fromLink ? decodeURIComponent(fromLink[1]) : value;
}
