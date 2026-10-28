import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, PenLine, Trophy } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Badge, Button, ButtonLink, EmptyNote, FixtureRow, List, ListRow, Panel, Section, Skeleton } from '../../../design/primitives';
import { Fact } from '../../../design/profile/ProfileLayout';
import { dayLabel, kindOf, timeLabel } from '../../clubWorkspace/fixtures';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { summarizeClubTrust } from '../../../components/club/clubProfileInfo';
import { overviewFixtures, overviewLead } from '../overviewPolicy';
import { profileKindLabel } from '../presentation';
import { useOverviewSource } from '../useOverviewSource';
import { ClubPostStrip } from './ClubPostStrip';
import { useProfilePostFeed } from '../../profiles/useProfilePostFeed';
import { ClubFamilyWeek } from './ClubFamilyWeek';
import type { ClubPermissions } from './useClubProfile';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import type { ClubProfile } from './types';

type Source<T> = ReturnType<typeof useOverviewSource<T>>;
const tabLink = (club: number, tab: string) => `/clubs/${club}?tab=${tab}`;

/** Who the club is and its latest news: the story, the facts, what is coming up and the honours. */
export function ClubAboutTab({ club, can }: { club: ClubProfile; can: ClubPermissions }) {
    const { user } = useAuth();
    const feed = useProfilePostFeed(`/posts/club/${club.id}`, 6);
    const lead = overviewLead(club.id, user?.navigationCapabilities);
    const [window] = useState(() => {
        const start = new Date(), end = new Date(start); end.setDate(end.getDate() + 30);
        const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
        return `from=${local(start)}&to=${local(end)}`;
    });
    const schedule = useOverviewSource<{ events: ScheduleEventOccurrence[] }>(`/schedule/clubs/${club.id}/events?${window}`);
    const honours = [...(club.honours ?? [])].sort((a, b) => b.yearWon - a.yearWon);

    return <>
        {lead === 'family' && <ClubFamilyWeek clubId={club.id} />}
        <Section boxed title="About" action={club.presentation?.canEdit ? { label: 'Edit', to: `/clubs/${club.id}?edit=1&panel=identity` } : undefined}>
            <Panel padded>
                {club.description ? <p className="gk-club-story">{club.description}</p> : <p className="gk-muted">The club has not written its story yet.</p>}
                <dl className="gk-club-facts">
                    <Fact label="Type">{club.presentation ? profileKindLabel[club.presentation.profileKind] : club.type || 'Football club'}</Fact>
                    {club.foundedYear && <Fact label="Founded">{club.foundedYear}</Fact>}
                    {club.addressText && <Fact label="Based at">{club.addressText}</Fact>}
                    <Fact label="Status">{summarizeClubTrust(club)}</Fact>
                    {club.trustedByClubs.length > 0 && <Fact label="Trusted by"><span className="gk-chips">{club.trustedByClubs.map(t => <Badge key={t.clubId}>{t.clubName}</Badge>)}</span></Fact>}
                </dl>
            </Panel>
        </Section>
        <Section boxed title="Latest news" action={<span className="gk-row">{can.canPost && <Link className="gk-section__action gk-row" to={tabLink(club.id, 'posts')}><PenLine size={15} aria-hidden="true" />Write a post</Link>}<Link className="gk-section__action" to={tabLink(club.id, 'posts')}>See all posts</Link></span>}>
            <ClubPostStrip posts={feed.posts} loading={feed.pages.loading} allTo={tabLink(club.id, 'posts')}
                empty={{ title: 'No posts yet', body: can.canPost ? 'Share the first update from the Posts tab. It appears here and in your followers’ Home feed.' : 'When the club shares news, photos and results, they appear here.' }} />
        </Section>
        <Section boxed icon={CalendarDays} title="Coming up" hint="Next 30 days" action={can.canManage ? { label: 'Club calendar', to: `/clubs/${club.id}/office?tab=calendar` } : undefined}>
            <Fixtures club={club} source={schedule} canManage={can.canManage} />
        </Section>
        <Section boxed icon={Trophy} tone="warning" title="Honours" hint={honours.length ? `${honours.length} recorded` : undefined}>
            <Panel flush>{honours.length ? <List label="Honours">{honours.map(h => <ListRow key={h.id}
                lead={<span className="gk-club-year gk-num">{h.yearWon}</span>} title={h.title} meta={h.description || undefined} />)}</List>
                : <EmptyNote title="No honours recorded yet">Trophies, league finishes and milestones appear here once the club records them.</EmptyNote>}</Panel>
        </Section>
    </>;
}

function Fixtures({ club, source, canManage }: { club: ClubProfile; source: Source<{ events: ScheduleEventOccurrence[] }>; canManage: boolean }) {
    const fixtures = overviewFixtures(source.data?.events ?? []).slice(0, 4);
    if (source.loading) return <Panel flush><div className="gk-panel--pad"><Skeleton height={56} /></div></Panel>;
    if (source.failed) return <Panel flush><EmptyNote title="The schedule couldn’t load" action={<Button size="sm" onClick={source.retry}>Try again</Button>} /></Panel>;
    if (!fixtures.length) return <Panel flush><EmptyNote title="No public matches in the next 30 days" action={canManage ? <ButtonLink size="sm" to={`/clubs/${club.id}/office?tab=calendar`}>Open the club calendar</ButtonLink> : undefined}>Training times are under Teams & training.</EmptyNote></Panel>;
    return <Panel flush><List label="Upcoming matches">{fixtures.map(f => {
        const squad = f.clubId === club.id ? f.challengerSquadName : f.targetSquadName;
        const kind = kindOf({ eventType: f.eventType });
        return <FixtureRow key={`${f.occurrenceId}:${f.startsAt}`} tone={kind.tone} icon={activityIcons[f.eventType]} iconColor={activityColors[f.eventType]} time={timeLabel(f.startsAt)} day={dayLabel(f.startsAt)} title={f.title}
            to={f.matchExchangeId ? `/match-exchange/${f.matchExchangeId}` : undefined}
            meta={[squad, f.locationName].filter(Boolean).join(' · ')}
            trail={f.challengeStatus && f.challengeStatus !== 'ACCEPTED' ? <Badge tone="warning">Awaiting confirmation</Badge> : <span className="gk-fixture__tag">{kind.label}</span>} />;
    })}</List></Panel>;
}
