import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { ageFromDob, isKnownMinor } from '../../../../utils/age';
import { fetchAdmissionHome } from '../../../admissions/api';
import type { Participant } from '../../../admissions/types';
import { usePreferences } from '../../../preferences/preferencesStore';
import type { ClubJob } from '../../api';
import type { PublicSquad, PublicStaff } from '../../publicJourney';
import { useOverviewSource } from '../../useOverviewSource';
import { squadFits, squadsWithoutCoach } from './joinFit';

/**
 * What the Join pop-up needs, read once when it opens: the club's squads, coaches and open jobs as the public sees
 * them, and about the person their age, their children and what they said they came for at sign-up. A part that fails
 * to load shows as empty; nothing here is guessed.
 */
export function useJoinFacts(clubId: number) {
    const { user, sessionId, status } = useAuth();
    const signedIn = status === 'authenticated';
    const squads = useOverviewSource<PublicSquad[]>(`/clubs/${clubId}/squads`);
    const staff = useOverviewSource<PublicStaff[]>(`/clubs/${clubId}/staff-directory`);
    const jobs = useOverviewSource<ClubJob[]>(`/clubs/${clubId}/jobs`);
    const choice = usePreferences(user?.id).start?.welcome?.choice ?? null;
    const [children, setChildren] = useState<{ key: string; list: Participant[] }>();
    // A child chosen in the address (one just added from here) is asked for again.
    const [params] = useSearchParams();
    const key = `${sessionId}:${user?.id ?? ''}:${params.get('player') ?? ''}`;
    useEffect(() => {
        if (!signedIn) return;
        const controller = new AbortController();
        void fetchAdmissionHome(sessionId, controller.signal)
            .then(home => { if (!controller.signal.aborted) setChildren({ key, list: (home.participants ?? []).filter(person => person.minor) }); })
            .catch(() => { if (!controller.signal.aborted) setChildren({ key, list: [] }); });
        return () => controller.abort();
    }, [key, sessionId, signedIn]);

    const age = ageFromDob(user?.dob);
    const minor = isKnownMinor(user?.dob);
    const allSquads = useMemo(() => squads.data ?? [], [squads.data]);
    const mySquads = useMemo(() => allSquads.filter(squad => squadFits(squad, { age })), [allSquads, age]);
    const uncoached = useMemo(() => (staff.data ? squadsWithoutCoach(allSquads, staff.data) : []), [allSquads, staff.data]);
    return {
        signedIn, age, minor, choice,
        loading: squads.loading || jobs.loading || staff.loading || (signedIn && children?.key !== key),
        squads: allSquads,
        /** The squads that suit the person themselves. */
        mySquads,
        coaches: staff.data ?? [],
        /** Open jobs and volunteering the club posted. */
        jobs: (jobs.data ?? []).filter(job => job.status !== 'CLOSED'),
        /** Squads with no coach on the club page (only once the staff list has loaded). */
        uncoached,
        children: children?.key === key ? children.list : [],
    };
}
export type JoinFacts = ReturnType<typeof useJoinFacts>;
