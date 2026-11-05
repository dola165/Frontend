import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '../../../design/primitives';
import type { ProfileIdentity } from '../../../design/profile/ProfileLayout';
import type { PersonProfile } from '../api';

type Copy = (english: string, georgian: string) => string;

/**
 * A person's profile header: name, photo, what a club confirmed, the line under the name and short facts. The line is
 * one of the person's real lines (a job, a squad place), picked on their football profile; nobody types it.
 */
export function personIdentity({ profile, hidden, line, copy, counts }: {
    profile: PersonProfile; hidden: boolean; copy: Copy;
    /** "Head coach · U12 · Dinamo Tbilisi Academy", from the person's football lines; null when there is none. */
    line: string | null;
    /** Followers and following, as the page shows them. */
    counts: (kind: 'followers' | 'following', value: number) => ReactNode;
}): ProfileIdentity {
    const appointments = profile.footballProfile?.appointments ?? [];
    return {
        name: profile.fullName || profile.username, image: hidden ? null : profile.avatarUrl,
        badge: !hidden && appointments.length > 0 ? <Badge tone="accent"><ShieldCheck size={13} aria-hidden="true" />{copy('Confirmed by', 'დაადასტურა:')} {appointments.length === 1 ? appointments[0].clubName : copy(`${appointments.length} clubs`, `${appointments.length} კლუბმა`)}</Badge> : undefined,
        line: hidden ? undefined : line ?? undefined,
        facts: [
            profile.username ? <>@{profile.username}</> : null,
            counts('followers', profile.followerCount),
            counts('following', profile.followingCount),
        ],
    };
}
