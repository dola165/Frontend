import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Camera, MapPin, ShieldCheck } from 'lucide-react';
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
import { clubTabFrom, clubTabs, isWide, tabFilters, type ClubTab } from './clubTabs';
import { useClubEnquiry } from './useClubEnquiry';
import { useClubProfile } from './useClubProfile';
import { clubBoxes } from '../../pages/club/clubBoxes';
import { usePagesCopy } from '../../pages/copy';
import { EditBar } from '../../pages/edit/EditBar';
import { InlineText } from '../../pages/edit/InlineText';
import { PageColumn } from '../../pages/edit/PageColumn';
import { ExamplePreview } from '../../pages/edit/ExamplePreview';
import { PageEditProvider } from '../../pages/edit/PageEditProvider';
import { PagePanels } from '../../pages/edit/PagePanels';
import { RearrangeFrame } from '../../pages/edit/Rearrange';
import { usePageEdit } from '../../pages/edit/context';
import './club-profile.css';

const managementTabs: ClubManagementTab[] = ['personnel', 'players', 'invites', 'applications', 'roles', 'squads', 'tryouts'];
const managementTabFrom = (value: string | null) => managementTabs.find(tab => tab === value) ?? null;

/** A club's public page: its posts first, then its photos, story, squads, people, places and ways to get involved. */
export function ClubProfilePage() {
    const { id } = useParams<{ id: string }>();
    const { sessionId, status } = useAuth();
    const clubId = Number(id);
    if (!Number.isSafeInteger(clubId) || clubId <= 0) return <ClubUnavailable />;
    // The page provider wraps the club page: the owner edits the page on the page itself; visitors see the page as it is.
    return <PageEditProvider key={`${clubId}:${sessionId}:${status}`} pageRef={{ type: 'club', id: clubId }}><ClubProfileView id={clubId} /></PageEditProvider>;
}

function ClubProfileView({ id }: { id: number }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { status, sessionId } = useAuth();
    const [params, setParams] = useSearchParams();
    const { club, loading, failed, permissions: can, refresh, toggleFollow, leftClub, updateImage, forgetMembership } = useClubProfile(id);
    // The page under edit (identity, boxes, layout): absent on a backend without pages, and then nothing here changes.
    const edit = usePageEdit();
    const pt = usePagesCopy();
    const page = edit.page, editing = edit.editing;
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

    if ((loading && !club) || (edit.loading && !page && !edit.notFound)) return <ClubLoading />;
    if (!club) return <ClubUnavailable failed={failed} onRetry={refresh} />;

    const kind = club.presentation ? profileKindLabel[club.presentation.profileKind] : club.type || 'Football club';
    // The academy and its club point at each other right under the name, not at the bottom of the page.
    const linked = club.presentation?.affiliations.find(a => a.status === 'ACTIVE');
    const place = club.addressText || [club.cityName, club.countryName].filter(Boolean).join(', ');
    return <>
        <RearrangeFrame><ProfileLayout className="gk-club-page"
            identity={{
                name: page?.identity.name ?? club.name, image: page?.identity.crest.url ?? club.logoUrl, square: true,
                nameNode: editing ? <InlineText as="span" value={page?.identity.name ?? club.name} placeholder={pt('Name your page')} label={pt('Name')} maxLength={120} onSave={next => { if (next.length >= 2) void edit.saveIdentity({ name: next }, { label: pt('Name saved') }).then(refresh); }} /> : undefined,
                summaryNode: editing ? <InlineText as="p" multiline value={page?.identity.about ?? club.description ?? ''} placeholder={pt('Say what you are, in a line or two')} label={pt('About')} maxLength={600} className="gk-profile__summary" onSave={next => void edit.saveIdentity({ about: next, aboutAuto: false }, { label: pt('About saved') }).then(refresh)} /> : undefined,
                badge: club.isOfficial ? <Badge tone="accent"><ShieldCheck size={13} aria-hidden="true" />Verified club</Badge> : page?.status === 'DRAFT' ? <Badge tone="warning">{pt('Draft')}</Badge> : undefined,
                line: <>{kind}{linked && <> · {club.presentation?.profileKind === 'ACADEMY' ? 'Academy of ' : 'Academy: '}<Link className="gk-profile__link" to={`/clubs/${linked.clubId}`}>{linked.name}</Link></>}{can.role && <> · Your role: {clubRoleLabel(can.role)}</>}</>,
                facts: [
                    place ? <><MapPin aria-hidden="true" />{place}</> : null,
                    <><strong>{club.followerCount.toLocaleString()}</strong>{club.followerCount === 1 ? 'follower' : 'followers'}</>,
                    <><strong>{club.memberCount.toLocaleString()}</strong>{club.memberCount === 1 ? 'member' : 'members'}</>,
                ],
                summary: page?.identity.about || club.description || undefined,
            }}
            banner={page ? page.identity.cover?.url ?? null : club.bannerUrl}
            bannerAction={editing ? <Button size="sm" onClick={() => edit.openPanel('cover')}><Camera aria-hidden="true" />{page?.identity.cover ? pt('Change cover') : pt('Add cover')}</Button> : images.coverAction}
            imageAction={editing ? <Button size="sm" iconOnly aria-label={pt('Change crest')} className={page?.goLive.missing.includes('crest') ? 'gk-needs' : undefined} onClick={() => edit.openPanel('crest')}><Camera aria-hidden="true" /></Button> : images.imageAction}
            actions={<ClubActions club={club} can={can} onFollow={() => void follow()} onJoin={join} onMessage={message} />}
            notice={<>{notice && <p className="gk-notice gk-notice--danger" role="alert">{notice}</p>}{images.dialogs}<EditBar /></>}
            tabs={clubTabs} tab={tab} onTab={setTab} tabsLabel="Club sections"
            sideLeft={editing ? <PageColumn column="left" renderers={clubBoxes} /> : tab === 'involved' && isWide(params) ? undefined : <ClubInfo club={club} canEdit={can.canManage && (page ? edit.canEdit : true)} />} sideLeftLabel="Club information"
            side={editing ? <PageColumn column="right" renderers={clubBoxes} /> : <ClubSide club={club} canEdit={can.canManage && (page ? edit.canEdit : true)} />} sideLabel="Get involved">
            {tab === 'posts' && editing && page?.status === 'DRAFT' && <ExamplePreview />}
            {tab === 'posts' && <ClubPostsTab club={club} can={can} />}
            {tab === 'media' && <ProfileMediaTab endpoint={`/posts/club/${club.id}`} clubId={club.id} />}
            {tab === 'about' && <ClubAboutTab club={club} can={can} />}
            {tab === 'teams' && <ClubTeamsTab club={club} refreshKey={squadsRevision} onContact={setEnquiry} isAuthenticated={status === 'authenticated'} canManage={can.canManage} />}
            {tab === 'people' && <ClubPeopleTab clubId={club.id} canManageStaff={can.canManageStaff} />}
            {tab === 'facilities' && <ClubFacilitiesTab club={club} canEdit={can.canEditFacilities} />}
            {tab === 'involved' && <ClubInvolvedTab club={club} canEdit={can.canManage} />}
            {tab === 'contact' && <ClubContactTab club={club} />}
        </ProfileLayout></RearrangeFrame>
        <PagePanels />

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
            onCancel={() => { if (dissolving) return; setDissolveOpen(false); }} />
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
