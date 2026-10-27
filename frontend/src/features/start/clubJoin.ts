import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { getAuthSessionId } from '../../utils/authStorage';
import { fetchMyClubInvitations } from '../clubs/api';
import type { Appointment } from '../clubOperations/api';
import type { LinkInvite } from '../clubOperations/people/inviteLinkApi';
import { fetchClubProfile } from '../world/api';

/**
 * Joining a club from the welcome (owner, 27 October): Join accepts a job or membership this person was already
 * invited to there; otherwise the code from the admin's staff link. Nobody asks to join.
 */

/** An invite as the invite link's accept takes it, with the club's town for the row. */
export type PendingInvite = LinkInvite & { clubCity: string | null };

const stillOpen = (expiresAt?: string | null) => !expiresAt || new Date(expiresAt).getTime() > Date.now();

/**
 * Every invite this person has not answered yet and that has not run out: staff jobs (`GET /club-operations/mine`,
 * still INVITED) and club memberships (`GET /club-memberships/invites/me`, PENDING before `expiresAt`). The invites
 * carry no crest, so each club's own profile gives its crest and town. A list that fails to load counts as none: the
 * person is then asked for the code, which always works.
 */
export async function fetchPendingClubInvites(signal?: AbortSignal): Promise<PendingInvite[]> {
    const [mine, memberships] = await Promise.all([
        apiClient.get<{ appointments?: Appointment[] }>('/club-operations/mine', { signal }).then(r => r.data.appointments ?? [], () => [] as Appointment[]),
        fetchMyClubInvitations({ signal, _authSessionId: getAuthSessionId() } as AuthSessionRequestConfig).catch(() => []),
    ]);
    const jobs = mine.filter(job => (job.effective_status ?? job.status) === 'INVITED' && stillOpen(job.expires_at)).map((job): LinkInvite => ({
        kind: 'APPOINTMENT', id: job.id, revision: job.revision, clubId: job.club_id, clubName: job.club_name ?? '', clubLogoUrl: null, invitedBy: null,
        job: job.title, title: job.title, clubWide: job.club_wide ?? job.squad_id == null, squads: job.squad_names ?? (job.squad_name ? [job.squad_name] : []), unavailableReason: job.unavailable_reason ?? null,
    }));
    const members = memberships.filter(invite => invite.status === 'PENDING' && stillOpen(invite.expiresAt)).map((invite): LinkInvite => ({
        kind: 'MEMBERSHIP', id: invite.id, revision: null, clubId: invite.clubId, clubName: invite.clubName, clubLogoUrl: null, invitedBy: null,
        job: invite.role, title: invite.role, clubWide: true, squads: [], unavailableReason: null,
    }));
    const invites = [...jobs, ...members];
    const clubs = new Map(await Promise.all([...new Set(invites.map(invite => invite.clubId))].map(async id =>
        [id, await fetchClubProfile(id, signal).catch(() => null)] as const)));
    return invites.map(invite => {
        const club = clubs.get(invite.clubId);
        return { ...invite, clubName: invite.clubName || club?.name || '', clubLogoUrl: club?.logoUrl ?? null, clubCity: club?.cityName ?? null };
    });
}

/** The code from what was typed or pasted: the code itself, or a whole staff link (`…/staff-invite/{code}`). */
export function staffCodeFrom(text: string): string {
    const value = text.trim();
    const fromLink = /staff-invite\/([^/?#\s]+)/i.exec(value);
    return fromLink ? decodeURIComponent(fromLink[1]) : value;
}
