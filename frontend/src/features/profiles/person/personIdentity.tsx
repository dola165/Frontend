import type { ReactNode } from 'react';
import { MapPin, ShieldCheck } from 'lucide-react';
import { Badge } from '../../../design/primitives';
import type { ProfileIdentity } from '../../../design/profile/ProfileLayout';
import { roleCopy } from '../../roles/domain';
import type { PersonProfile } from '../api';

type Copy = (english: string, georgian: string) => string;

/**
 * A person's profile header: name, photo, what a club confirmed, headline or roles, and short facts. The profile page
 * and the setup's preview of it both draw it from here, so the preview is the page.
 */
export function personIdentity({ profile, roles, own, hidden, possibleMinor, copy, counts }: {
    profile: PersonProfile; roles: string[]; own: boolean; hidden: boolean; possibleMinor: boolean; copy: Copy;
    /** Followers and following, as the page shows them (buttons on the page, plain in a preview). */
    counts: (kind: 'followers' | 'following', value: number) => ReactNode;
}): ProfileIdentity {
    const details = new Map((profile.roleProfiles ?? []).map(item => [item.role, item]));
    const primary = (profile.roleProfiles ?? []).find(item => item.primary && (own || item.published));
    const appointments = profile.footballProfile?.appointments ?? [];
    // Where someone works is public for adults; a possible minor's town stays off their header.
    const place = hidden || possibleMinor ? null : primary?.serviceArea || [...details.values()].find(item => item.serviceArea)?.serviceArea;
    const roleNames = roles.map(role => roleCopy(role, copy).label).join(' · ');
    return {
        name: profile.fullName || profile.username, image: hidden ? null : profile.avatarUrl,
        badge: !hidden && appointments.length > 0 ? <Badge tone="accent"><ShieldCheck size={13} aria-hidden="true" />{copy('Confirmed by', 'დაადასტურა:')} {appointments.length === 1 ? appointments[0].clubName : copy(`${appointments.length} clubs`, `${appointments.length} კლუბმა`)}</Badge> : undefined,
        line: !hidden && primary?.headline ? primary.headline : roleNames,
        facts: [
            profile.username ? <>@{profile.username}</> : null,
            !hidden && primary?.headline ? <>{roleNames}</> : null,
            place ? <><MapPin aria-hidden="true" />{place}</> : null,
            counts('followers', profile.followerCount),
            counts('following', profile.followingCount),
        ],
    };
}
