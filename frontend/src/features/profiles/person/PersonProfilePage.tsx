import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MapPin, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Badge, Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Panel, Skeleton } from '../../../design/primitives';
import { ProfileLayout } from '../../../design/profile/ProfileLayout';
import { ConnectionsDialog } from '../../../components/profile/ConnectionsDialog';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { isProfessionalRole, roleCopy } from '../../roles/domain';
import { ProfileCareer } from '../../roles/ProfileCareer';
import { PersonalSchedule } from '../../schedule/personal/PersonalSchedule';
import { ProfileMediaTab } from '../ProfileMediaTab';
import { useProfileImageControls } from '../useProfileImageControls';
import { PersonActions } from './PersonActions';
import { PersonOverviewTab } from './PersonOverviewTab';
import { PersonPostsTab } from './PersonPostsTab';
import { PersonSide } from './PersonSide';
import { personTabFrom, personTabs, type PersonTab } from './personTabs';
import { usePersonProfile } from './usePersonProfile';
import './person-profile.css';

/** `/profile/me` opens your own profile, keeping the tab and anything else in the link. */
export function MyProfileRedirect() {
    const { user, status } = useAuth();
    const location = useLocation();
    if (status === 'bootstrapping') return null;
    if (!user) return <Navigate replace to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} />;
    return <Navigate replace to={`/profile/${user.id}${location.search}${location.hash}`} />;
}

/** A person's profile: who they are in football, their work and what clubs confirmed, then posts, career, media and, for yourself, your schedule. */
export function PersonProfilePage() {
    const { id } = useParams<{ id: string }>();
    const { sessionId } = useAuth();
    const personId = Number(id);
    if (!Number.isSafeInteger(personId) || personId <= 0) return <PersonUnavailable />;
    return <PersonProfileView key={`${personId}:${sessionId}`} id={personId} />;
}

function PersonProfileView({ id }: { id: number }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { status } = useAuth();
    const [params, setParams] = useSearchParams();
    const view = usePersonProfile(id);
    const copy = useJourneyCopy();
    const { profile, own, roles, hidden } = view;
    const [notice, setNotice] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);
    const images = useProfileImageControls({ enabled: own, scope: `user:${id}`, imageKind: 'avatar', hasCover: Boolean(profile?.bannerUrl), onSave: view.updateImage });
    const career = Boolean(profile && !hidden && (roles.some(isProfessionalRole) || (own && (profile.footballProfile?.entries.length ?? 0) > 0)));
    const tabs = personTabs({ own, hidden, career }, copy);
    const tab = personTabFrom(params.get('tab'), tabs);
    const connections = params.get('connections');

    // Links to representation land beside it.
    useEffect(() => {
        if (!profile || !params.has('representation')) return;
        const frame = requestAnimationFrame(() => document.getElementById('representation')?.scrollIntoView({ block: 'center' }));
        return () => cancelAnimationFrame(frame);
    }, [profile, params]);

    const setTab = (next: PersonTab) => {
        const query = new URLSearchParams();
        if (next !== 'overview') query.set('tab', next);
        setParams(query);
    };
    const setConnections = (kind: 'followers' | 'following' | null) => setParams(current => {
        const query = new URLSearchParams(current);
        if (kind) query.set('connections', kind); else query.delete('connections');
        return query;
    }, { replace: true, preventScrollReset: true });
    const follow = async () => {
        if (status !== 'authenticated') return navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
        setNotice(null);
        try { await view.toggleFollow(); } catch (error) { setNotice({ tone: 'danger', text: extractApiErrorMessage(error, copy('Following could not be saved. Please try again.', 'გამოწერა ვერ შეინახა. სცადეთ ხელახლა.')) }); }
    };
    const share = async () => {
        if (!profile) return;
        const url = `${window.location.origin}/profile/${profile.id}`;
        if (navigator.share) { await navigator.share({ title: `${profile.fullName || profile.username} on GrassKickZ`, url }).catch(() => undefined); return; }
        try { await navigator.clipboard.writeText(url); setNotice({ tone: 'info', text: copy('Profile link copied.', 'პროფილის ბმული დაკოპირდა.') }); }
        catch { setNotice({ tone: 'danger', text: copy('The link couldn’t be copied. Copy it from the address bar instead.', 'ბმული ვერ დაკოპირდა. დააკოპირეთ მისამართის ზოლიდან.') }); }
    };
    const openRepresentation = () => {
        const query = new URLSearchParams(params);
        query.delete('tab'); query.set('representation', '1');
        setParams(query, { replace: true });
    };

    if (view.status === 'loading' && !profile) return <PersonLoading />;
    if (!profile) return <PersonUnavailable failed={view.status === 'failed'} onRetry={view.reload} />;

    const name = profile.fullName || profile.username;
    const details = new Map((profile.roleProfiles ?? []).map(item => [item.role, item]));
    const primary = (profile.roleProfiles ?? []).find(item => item.primary && (own || item.published));
    const appointments = profile.footballProfile?.appointments ?? [];
    // Where someone works is public for adults; a possible minor's town stays off their header.
    const place = hidden || view.possibleMinor ? null : primary?.serviceArea || [...details.values()].find(item => item.serviceArea)?.serviceArea;
    const counts = (kind: 'followers' | 'following', value: number) => <button type="button" disabled={hidden} title={hidden ? copy('Connections are private', 'კავშირები დამალულია') : undefined}
        onClick={() => setConnections(kind)}><strong>{value.toLocaleString()}</strong>{kind === 'followers' ? copy(value === 1 ? 'follower' : 'followers', 'გამომწერი') : copy('following', 'გამოწერილი')}</button>;
    return <>
        <ProfileLayout
            identity={{
                name, image: hidden ? null : profile.avatarUrl,
                badge: !hidden && appointments.length > 0 ? <Badge tone="accent"><ShieldCheck size={13} aria-hidden="true" />{copy('Confirmed by', 'დაადასტურა:')} {appointments.length === 1 ? appointments[0].clubName : copy(`${appointments.length} clubs`, `${appointments.length} კლუბმა`)}</Badge> : undefined,
                line: !hidden && primary?.headline ? primary.headline : roles.map(role => roleCopy(role, copy).label).join(' · '),
                facts: [
                    <>@{profile.username}</>,
                    !hidden && primary?.headline ? <>{roles.map(role => roleCopy(role, copy).label).join(' · ')}</> : null,
                    place ? <><MapPin aria-hidden="true" />{place}</> : null,
                    counts('followers', profile.followerCount),
                    counts('following', profile.followingCount),
                ],
            }}
            banner={hidden ? null : profile.bannerUrl} bannerAction={images.coverAction} imageAction={images.imageAction}
            actions={<PersonActions profile={profile} own={own} onFollow={() => void follow()} onShare={() => void share()} onRepresentation={openRepresentation} />}
            notice={<>{notice && <p className={`gk-notice${notice.tone === 'danger' ? ' gk-notice--danger' : ''}`} role={notice.tone === 'danger' ? 'alert' : 'status'}>{notice.text}</p>}{images.dialogs}</>}
            tabs={tabs} tab={tab} onTab={setTab} tabsLabel={copy('Profile sections', 'პროფილის სექციები')}
            side={tab === 'schedule' ? undefined : <PersonSide view={view} />} sideLabel={copy(`About ${name}`, `${name} — შესახებ`)}>
            {tab === 'overview' && <PersonOverviewTab view={view} />}
            {tab === 'posts' && <PersonPostsTab view={view} />}
            {tab === 'career' && <ProfileCareer key={`career-${profile.id}`} profile={profile} isMyProfile={own}
                onChanged={footballProfile => view.setProfile(current => current?.id === profile.id ? { ...current, footballProfile } : current)} />}
            {tab === 'media' && <ProfileMediaTab endpoint={`/posts/user/${profile.id}`} />}
            {tab === 'schedule' && own && <PersonalSchedule />}
        </ProfileLayout>
        {(connections === 'followers' || connections === 'following') && !hidden && <ConnectionsDialog key={`${profile.id}-${connections}`} userId={profile.id} kind={connections}
            showFollowingStatus={connections === 'following' && own} onClose={() => setConnections(null)} />}
    </>;
}

function PersonLoading() {
    const copy = useJourneyCopy();
    return <GkRoot className="gk-page gk-profile"><PageFrame width="profile">
        <div className="gk-person-loading" role="status" aria-label={copy('Loading profile', 'პროფილი იტვირთება')}><Skeleton height={104} width={104} /><Skeleton height={28} width="40%" /><Skeleton height={44} /><Skeleton height={220} /></div>
    </PageFrame></GkRoot>;
}

function PersonUnavailable({ failed = false, onRetry }: { failed?: boolean; onRetry?: () => void }) {
    const copy = useJourneyCopy();
    return <GkRoot className="gk-page gk-profile"><PageFrame width="profile"><div className="gk-person-loading">
        <Panel>{failed
            ? <EmptyNote title={copy('This profile couldn’t load', 'პროფილი ვერ ჩაიტვირთა')} action={<Button onClick={onRetry}>{copy('Try again', 'ხელახლა ცდა')}</Button>}>{copy('Check your connection and try again.', 'შეამოწმეთ კავშირი და სცადეთ ხელახლა.')}</EmptyNote>
            : <EmptyNote title={copy('Profile not found', 'პროფილი ვერ მოიძებნა')} action={<ButtonLink to="/world/people">{copy('Find people', 'ადამიანების მოძებნა')}</ButtonLink>}>{copy('The account may have been closed, or the link is wrong.', 'ანგარიში შეიძლება დახურულია, ან ბმული არასწორია.')}</EmptyNote>}</Panel>
    </div></PageFrame></GkRoot>;
}
