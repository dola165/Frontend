import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { Avatar, Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Section, Skeleton } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { sanitizeAuthRedirect } from '../../../utils/authRedirect';
import type { PersonProfile } from '../api';
import { AboutInPlace } from './AboutInPlace';
import { CareerCards, CareerTotalsRow, FootballLines } from './FootballLines';
import { PublicLinePicker } from './PublicLinePicker';
import { StartDoors } from './StartDoors';
import { WhatYouDo } from './WhatYouDo';
import { useFootball } from './useFootball';
import './football-profile.css';

/**
 * `/account/football`, your football profile: where you are (filled from your links and jobs), your career, what you
 * do, and doors to start something. Nothing here is ticked to describe yourself; only links and jobs grant anything.
 */
export function FootballProfilePage() {
    const { user, sessionId } = useAuth();
    if (!user) return null;
    return <FootballProfile key={`${user.id}:${sessionId}`} userId={Number(user.id)} />;
}

function FootballProfile({ userId }: { userId: number }) {
    const copy = useJourneyCopy();
    const { user } = useAuth();
    const { hash } = useLocation();
    const [params] = useSearchParams();
    const next = sanitizeAuthRedirect(params.get('next'));
    const football = useFootball('me');
    const { data, status } = football;
    // Links from the profile ("Add", "Write about yourself") land on their section.
    useEffect(() => {
        if (!hash) return;
        const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 300);
        return () => window.clearTimeout(timer);
    }, [hash]);
    const name = user?.fullName || user?.username || '';
    const lines = data?.lines ?? [];
    const hasCareer = Boolean(data && (data.career.length || data.totals.sessionsCoached || data.totals.matchesPlayed || data.totals.matchesRefereed));

    return <GkRoot className="gk-page gk-fp">
        <PageFrame>
            <header className="gk-fp-head">
                <Avatar src={user?.avatarUrl} name={name} size={56} />
                <div className="gk-fp-head__text">
                    <h1>{name}</h1>
                    {data ? <PublicLinePicker data={data} onSaved={football.set} onStale={football.reload} /> : <span className="gk-faint">{copy('Your football', 'თქვენი ფეხბურთი')}</span>}
                </div>
                <div className="gk-fp-head__actions">
                    {next && <ButtonLink to={next}><ArrowLeft aria-hidden="true" />{copy('Back to opportunity', 'შეთავაზებაზე დაბრუნება')}</ButtonLink>}
                    <ButtonLink to={`/profile/${userId}`} variant={next ? 'ghost' : 'secondary'}><Eye aria-hidden="true" />{copy('View profile', 'პროფილის ნახვა')}</ButtonLink>
                </div>
            </header>
            <div className="gk-fp-grid">
                <div className="gk-fp-main">
                    <Section boxed id="where" title={copy('Where you are', 'სად ხართ')} hint={copy('Fills itself from your squads, jobs and family', 'ივსება თქვენი გუნდებიდან, სამსახურებიდან და ოჯახიდან')}>
                        {status === 'loading' && !data ? <div role="status" aria-label={copy('Loading', 'იტვირთება')} className="gk-fp-loading"><Skeleton height={48} /><Skeleton height={48} /></div>
                            : !data ? <EmptyNote title={copy('This couldn’t load', 'ვერ ჩაიტვირთა')} action={<Button size="sm" onClick={football.reload}>{copy('Try again', 'ხელახლა ცდა')}</Button>} />
                            : lines.length || data.follows.length ? <FootballLines lines={lines} follows={data.follows} own onChanged={football.reload} />
                            : <p className="gk-fp-empty">{copy('Nothing yet. This fills itself when a coach or a club adds you.', 'ჯერ არაფერია. შეივსება, როცა მწვრთნელი ან კლუბი დაგამატებთ.')}</p>}
                    </Section>
                    <Section boxed id="career" title={copy('Career', 'კარიერა')} hint={copy('From the clubs’ records; it stays with you when you leave', 'კლუბების ჩანაწერებიდან; წასვლისას თქვენთან რჩება')}>
                        {!data ? (status === 'loading' ? <Skeleton height={120} /> : null)
                            : hasCareer ? <><CareerTotalsRow totals={data.totals} /><CareerCards rows={data.career} /></>
                            : <p className="gk-fp-empty">{copy('Your career builds itself from your squads and jobs.', 'კარიერა თავად შედგება თქვენი გუნდებიდან და სამსახურებიდან.')}</p>}
                    </Section>
                </div>
                <aside className="gk-fp-side" aria-label={copy('What you do', 'რას აკეთებთ')}>
                    <Section boxed id="work" title={copy('What you do', 'რას აკეთებთ')} hint={copy('Clubs find you by it for jobs and volunteering', 'კლუბები ამით გიპოვიან სამსახურისა და მოხალისეობისთვის')}>
                        <WhatYouDo />
                    </Section>
                    <Section boxed id="start" title={copy('Start something', 'დაიწყეთ')}>
                        <StartDoors />
                    </Section>
                    <Section boxed id="about" title={copy('About you', 'თქვენ შესახებ')}>
                        <AboutBox userId={userId} />
                    </Section>
                </aside>
            </div>
        </PageFrame>
    </GkRoot>;
}

/** A few lines at the top of your profile, saved when you leave the box. */
function AboutBox({ userId }: { userId: number }) {
    const copy = useJourneyCopy();
    const [bio, setBio] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        void apiClient.get<PersonProfile>(`/users/${userId}`, { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setBio(response.data.bio ?? ''); })
            .catch(() => { if (!controller.signal.aborted) setFailed(true); });
        return () => controller.abort();
    }, [userId]);
    if (failed) return <p role="alert" className="gk-fp-error">{copy('This couldn’t load.', 'ვერ ჩაიტვირთა.')}</p>;
    return bio === null ? <Skeleton height={72} /> : <AboutInPlace bio={bio} alwaysOpen />;
}
