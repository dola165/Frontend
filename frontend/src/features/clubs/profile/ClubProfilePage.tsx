import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MapPin, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { Badge, Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Panel, Skeleton } from '../../../design/primitives';
import { ProfileLayout } from '../../../design/profile/ProfileLayout';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ClubManagementModal, type ClubManagementTab } from '../../../components/club/ClubManagementModal';
import { ClubEnquiryModal } from '../../../components/club/ClubEnquiryModal';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { playerPath, positivePlayerId } from '../../parents/playerSelection';
import { ProfileMediaTab } from '../../profiles/ProfileMediaTab';
import { useProfileImageControls } from '../../profiles/useProfileImageControls';
import { dissolveClub } from '../api';
import { clubRoleLabel } from '../domain';
import { profileKindLabel } from '../presentation';
import { ClubAboutTab } from './ClubAboutTab';
import { ClubActions } from './ClubActions';
import { ClubContactTab } from './ClubInfoTabs';
import { ClubFacilitiesTab } from './ClubFacilitiesTab';
import { ClubInfo } from './ClubInfo';
import { ClubInvolvedTab } from './ClubInvolvedTab';
import { ClubPeopleTab } from './ClubPeopleTab';
import { ClubPostsTab } from './ClubPostsTab';
import { ClubSide } from './ClubSide';
import { ClubTeamsTab } from './ClubTeamsTab';
import { clubTabFrom, clubTabs, tabFilters, type ClubTab } from './clubTabs';
import { useClubEnquiry } from './useClubEnquiry';
import { useClubProfile } from './useClubProfile';
import './club-profile.css';

const managementTabs: ClubManagementTab[] = ['personnel', 'players', 'invites', 'applications', 'roles', 'squads', 'tryouts'];
const managementTabFrom = (value: string | null) => managementTabs.find(tab => tab === value) ?? null;

/** A club's public page: its posts first, then its photos, story, squads, people, places and ways to get involved. */
export function ClubProfilePage() {
    const { id } = useParams<{ id: string }>();
    const { sessionId, status } = useAuth();
    const clubId = Number(id);
    if (!Number.isSafeInteger(clubId) || clubId <= 0) return <ClubUnavailable />;
    return <ClubProfileView key={`${clubId}:${sessionId}:${status}`} id={clubId} />;
}

function ClubProfileView({ id }: { id: number }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { status, sessionId } = useAuth();
    const [params, setParams] = useSearchParams();
    const { club, loading, failed, permissions: can, refresh, toggleFollow, leftClub, updateImage, forgetMembership } = useClubProfile(id);
    const [enquiry, setEnquiry] = useClubEnquiry(club);
    const [notice, setNotice] = useState('');
    const [squadsRevision, setSquadsRevision] = useState(0);
    const [dissolveOpen, setDissolveOpen] = useState(false);
    const [dissolving, setDissolving] = useState(false);
    const images = useProfileImageControls({ enabled: can.isLeader, scope: `club:${id}`, imageKind: 'logo', hasCover: Boolean(club?.bannerUrl), onSave: updateImage });
    const tab = clubTabFrom(params.get('tab'));
    const managing = params.get('manageClub') === '1' && can.canManage;
    const player = positivePlayerId(params.get('player'));

    const setTab = (next: ClubTab) => {
        const query = new URLSearchParams(params);
        for (const key of tabFilters) query.delete(key);
        query.delete('media');
        if (next === 'posts') query.delete('tab'); else query.set('tab', next);
        setParams(query);
    };
    const setManaging = (open: boolean, managementTab?: ClubManagementTab | null) => setParams(current => {
        const query = new URLSearchParams(current);
        if (open) query.set('manageClub', '1'); else query.delete('manageClub');
        if (open && managementTab) query.set('managementTab', managementTab); else query.delete('managementTab');
        return query;
    }, { replace: true });
    const follow = async () => {
        if (status !== 'authenticated') return navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
        setNotice('');
        try { await toggleFollow(); } catch (error) { setNotice(extractApiErrorMessage(error, 'Following could not be saved. Please try again.')); }
    };
    const join = () => navigate(playerPath(`/clubs/${id}?tab=teams`, player));
    const message = () => { if (club) setEnquiry({ name: club.name, path: `/clubs/${club.id}?tab=teams`, squadIds: [] }); };
    const dissolve = async () => {
        if (!club || dissolving) return;
        setDissolving(true);
        try {
            await dissolveClub(club.id);
            setDissolveOpen(false);
            forgetMembership();
            toast.success('Club dissolved');
            navigate('/world/clubs', { replace: true });
        } catch (error) { toast.error(extractApiErrorMessage(error, 'The club could not be dissolved.')); }
        finally { setDissolving(false); }
    };

    if (loading && !club) return <ClubLoading />;
    if (!club) return <ClubUnavailable failed={failed} onRetry={refresh} />;

    const kind = club.presentation ? profileKindLabel[club.presentation.profileKind] : club.type || 'Football club';
    // The academy and its club point at each other right under the name, not at the bottom of the page.
    const linked = club.presentation?.affiliations.find(a => a.status === 'ACTIVE');
    const place = club.addressText || [club.cityName, club.countryName].filter(Boolean).join(', ');
    return <>
        <ProfileLayout className="gk-club-page"
            identity={{
                name: club.name, image: club.logoUrl, square: true,
                badge: club.isOfficial ? <Badge tone="accent"><ShieldCheck size={13} aria-hidden="true" />Verified club</Badge> : undefined,
                line: <>{kind}{linked && <> · {club.presentation?.profileKind === 'ACADEMY' ? 'Academy of ' : 'Academy: '}<Link className="gk-profile__link" to={`/clubs/${linked.clubId}`}>{linked.name}</Link></>}{can.role && <> · Your role: {clubRoleLabel(can.role)}</>}</>,
                facts: [
                    place ? <><MapPin aria-hidden="true" />{place}</> : null,
                    <><strong>{club.followerCount.toLocaleString()}</strong>{club.followerCount === 1 ? 'follower' : 'followers'}</>,
                    <><strong>{club.memberCount.toLocaleString()}</strong>{club.memberCount === 1 ? 'member' : 'members'}</>,
                ],
                summary: club.description || undefined,
            }}
            banner={club.bannerUrl} bannerAction={images.coverAction} imageAction={images.imageAction}
            actions={<ClubActions club={club} can={can} onFollow={() => void follow()} onJoin={join} onMessage={message} onSettings={() => setManaging(true)} />}
            notice={<>{notice && <p className="gk-notice gk-notice--danger" role="alert">{notice}</p>}{images.dialogs}</>}
            tabs={clubTabs} tab={tab} onTab={setTab} tabsLabel="Club sections"
            sideLeft={<ClubInfo club={club} />} sideLeftLabel="Club information"
            side={<ClubSide club={club} />} sideLabel="Get involved">
            {tab === 'posts' && <ClubPostsTab club={club} can={can} />}
            {tab === 'media' && <ProfileMediaTab endpoint={`/posts/club/${club.id}`} clubId={club.id} />}
            {tab === 'about' && <ClubAboutTab club={club} can={can} />}
            {tab === 'teams' && <ClubTeamsTab club={club} refreshKey={squadsRevision} onContact={setEnquiry} isAuthenticated={status === 'authenticated'} canManage={can.canManage} />}
            {tab === 'people' && <ClubPeopleTab clubId={club.id} canManageStaff={can.canManageStaff} />}
            {tab === 'facilities' && <ClubFacilitiesTab club={club} canEdit={can.canEditFacilities} />}
            {tab === 'involved' && <ClubInvolvedTab club={club} />}
            {tab === 'contact' && <ClubContactTab club={club} />}
        </ProfileLayout>

        {managing && <ClubManagementModal clubId={club.id} clubName={club.name} currentRole={can.role} initialTab={managementTabFrom(params.get('managementTab'))}
            debugMode={params.get('debug') === 'true'} onClose={() => setManaging(false)}
            onDissolveClub={can.isLeader ? () => { setManaging(false); setDissolveOpen(true); } : undefined}
            onSquadCreated={() => setSquadsRevision(value => value + 1)}
            onDataChanged={() => { refresh(); setSquadsRevision(value => value + 1); }}
            onMembershipLeft={async () => { setManaging(false); await leftClub(); setSquadsRevision(value => value + 1); }} />}
        {enquiry && <ClubEnquiryModal key={`${club.id}:${sessionId}:${enquiry.path}`} clubId={club.id} clubName={club.name} context={enquiry} onClose={() => setEnquiry(null)} />}
        <ConfirmDialog open={dissolveOpen} variant="danger" title="Dissolve this club?"
            message="Dissolving is permanent. Club memberships end, pending invitations and applications close, and recruitment stops. Accounts and club history are preserved. Members and followers will be notified. Finish or cancel tournaments the club hosts or organizes, and withdraw its unfinished entries before continuing."
            confirmLabel={dissolving ? 'Dissolving…' : 'Dissolve club'} onConfirm={() => void dissolve()}
            onCancel={() => { if (dissolving) return; setDissolveOpen(false); requestAnimationFrame(() => document.getElementById('club-settings-trigger')?.focus()); }} />
    </>;
}

function ClubLoading() {
    return <GkRoot className="gk-page gk-profile"><PageFrame width="profile">
        <div className="gk-club-loading" role="status" aria-label="Loading club"><Skeleton height={104} width={104} /><Skeleton height={28} width="40%" /><Skeleton height={44} /><Skeleton height={220} /></div>
    </PageFrame></GkRoot>;
}

function ClubUnavailable({ failed = false, onRetry }: { failed?: boolean; onRetry?: () => void }) {
    return <GkRoot className="gk-page gk-profile"><PageFrame width="profile"><div className="gk-club-loading">
        <Panel>{failed
            ? <EmptyNote title="This club couldn’t load" action={<Button onClick={onRetry}>Try again</Button>}>Check your connection and try again.</EmptyNote>
            : <EmptyNote title="Club not found" action={<ButtonLink to="/world/clubs">Find clubs</ButtonLink>}>The club may have been dissolved, or the link is wrong.</EmptyNote>}</Panel>
    </div></PageFrame></GkRoot>;
}
