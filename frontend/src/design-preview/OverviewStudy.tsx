import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    ArrowDown, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown,
    Compass, Flag, Heart, Inbox, LayoutDashboard, LockKeyhole, MapPin,
    MessageCircle, PackagePlus, Plus, Search, Shield, Shirt, Users,
    UserPlus, X,
} from 'lucide-react';
import { contexts, programmes, updates, programmeDetail, fixtureDetail, groundDetail, staffDetail, refereeDetail } from './study-data';
import type { Context, Detail, PageTab, Scene } from './study-data';

const clubName = 'FC Dinamo Tbilisi Academy';
const pageTabs: PageTab[] = ['Overview', 'Posts', 'Training & teams', 'Schedule', 'People', 'Facilities'];
const scenes: { id: Scene; label: string; icon: typeof Flag }[] = [
    { id: 'football', label: 'The football', icon: Flag },
    { id: 'place', label: 'The place', icon: MapPin },
    { id: 'community', label: 'The people', icon: Users },
];
const workspaceDetail = (workspace: 'club' | 'referee' | 'family'): Detail => ({
    eyebrow: 'Your workspace', workspace,
    title: workspace === 'referee' ? 'Your officiating' : workspace === 'family' ? 'Your family' : 'Your club workspace',
    description: workspace === 'referee'
        ? 'Your availability, appointments and match reports stay together, including work outside this club.'
        : workspace === 'family' ? 'Follow your children’s football, permissions and upcoming activities in one place.'
            : 'A single place for the responsibilities you hold at this club.',
});

function Action({ children, onClick, primary = false, className = '' }: { children: ReactNode; onClick: () => void; primary?: boolean; className?: string }) {
    return <button type="button" className={`os-button ${primary ? 'os-button-primary' : ''} ${className}`} onClick={onClick}>{children}</button>;
}

function Crest({ small = false }: { small?: boolean }) {
    return <div className={`os-crest ${small ? 'os-crest-small' : ''}`} aria-hidden="true"><Shield /><span>D</span></div>;
}

function Pitch({ compact = false }: { compact?: boolean }) {
    return <div className={`os-pitch-scene ${compact ? 'os-pitch-compact' : ''}`} aria-hidden="true">
        <div className="os-pitch-halo" />
        <div className="os-pitch">
            <svg viewBox="0 0 500 320" fill="none">
                <rect x="17" y="17" width="466" height="286" rx="3" />
                <path d="M250 17V303" />
                <circle cx="250" cy="160" r="49" /><circle cx="250" cy="160" r="3" className="os-pitch-dot" />
                <path d="M17 85H92V235H17M483 85H408V235H483M17 120H46V200H17M483 120H454V200H483" />
                <path className="os-passing-line" d="M112 223L228 196L330 125L410 160" />
            </svg>
            {[[13,50],[28,24],[28,75],[46,38],[46,64],[67,28],[68,72],[83,50]].map(([left, top], i) =>
                <span key={i} className="os-player-dot" style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${i * 35}ms` }}>{i + 1}</span>)}
            <span className="os-pitch-ball" />
        </div>
        <span className="os-field-note"><span /> Every session. A step forward.</span>
    </div>;
}

function DetailDrawer({ detail, onClose, onOpen, hasOfficiating }: { detail: Detail | null; onClose: () => void; onOpen: (detail: Detail) => void; hasOfficiating: boolean }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const open = Boolean(detail);
    useEffect(() => {
        const element = dialog.current;
        if (!element || !open) return;
        const oldOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        element.showModal();
        return () => { element.close(); document.body.style.overflow = oldOverflow; };
    }, [open]);
    return <dialog ref={dialog} className="os-drawer" aria-labelledby="os-detail-title" onCancel={onClose}
        onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        {detail && <div className="os-drawer-body">
            <div className="os-drawer-top"><span className="os-eyebrow">{detail.eyebrow}</span><button type="button" className="os-icon-button" aria-label="Close details" onClick={onClose} autoFocus><X /></button></div>
            {detail.image && <img className="os-detail-image" src={detail.image} alt="Illustrative academy training ground" />}
            <h2 id="os-detail-title">{detail.title}</h2><p className="os-lead">{detail.description}</p>
            {detail.facts && <dl className="os-facts">{detail.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
            {detail.workspace && <div className="os-workspace-preview">
                <p className="os-eyebrow">Your next steps</p>
                {(detail.workspace === 'referee' ? [
                    ['Availability', 'Keep your availability in one calendar.'],
                    ['Match appointments', 'Review invitations and assigned matches.'],
                    ['Reports & results', 'Complete reports for matches assigned to you.'],
                ] : detail.workspace === 'family' ? [
                    ['Children & squads', 'See your confirmed family connections.'],
                    ['Activities', 'Training, matches and meeting information.'],
                    ['Permissions', 'Review requests requiring your decision.'],
                ] : [
                    ['Squads & training', 'Plan sessions and follow your teams.'],
                    ['Club operations', 'Manage the people and work you are responsible for.'],
                    ['My responsibilities', 'See the scope of your approved access.'],
                ]).map(([title, description]) => <div className="os-workspace-row" key={title}><Check /><div><h3>{title}</h3><p>{description}</p></div></div>)}
                {detail.workspace === 'club' && hasOfficiating && <Action onClick={() => onOpen(workspaceDetail('referee'))}><Flag /> Open personal officiating <ArrowUpRight /></Action>}
            </div>}
            {detail.note && <p className="os-detail-note">{detail.note}</p>}
            <div className="os-prototype-note"><Compass /><p><strong>Design preview</strong>These details use sample content. Workspace navigation and submissions will connect to the existing app after review.</p></div>
        </div>}
    </dialog>;
}

function SearchDialog({ onClose, navigate, onOpen, tabs, showProgrammes }: { onClose: () => void; navigate: (tab: PageTab) => void; onOpen: (detail: Detail) => void; tabs: PageTab[]; showProgrammes: boolean }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [query, setQuery] = useState('');
    useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
    const options = tabs.filter(tab => tab.toLowerCase().includes(query.toLowerCase()));
    const matchingProgrammes = showProgrammes ? programmes.filter(p => p.name.toLowerCase().includes(query.toLowerCase())) : [];
    return <dialog ref={dialog} className="os-search-dialog" aria-label="Search this preview" onCancel={onClose}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="os-search-top"><Search /><input aria-label="Search this academy" placeholder="Search this academy…" value={query} onChange={e => setQuery(e.target.value)} autoFocus /><button type="button" className="os-icon-button" onClick={onClose} aria-label="Close search"><X /></button></div>
        <p className="os-eyebrow">In this preview</p>
        {options.map(tab => <button type="button" className="os-search-result" key={tab} onClick={() => { navigate(tab); onClose(); }}><span>{tab}</span><ArrowRight /></button>)}
        {matchingProgrammes.map(p => <button type="button" className="os-search-result" key={p.name} onClick={() => { onClose(); onOpen(programmeDetail(programmes.indexOf(p))); }}><span>{p.name}<small>Training programme</small></span><ArrowRight /></button>)}
        {options.length === 0 && matchingProgrammes.length === 0 && <p className="os-search-empty">No matches here. Try a section name.</p>}
    </dialog>;
}

function Programmes({ onOpen, full = false }: { onOpen: (detail: Detail) => void; full?: boolean }) {
    return <div className={`os-programmes ${full ? 'os-programmes-full' : ''}`}>{programmes.map((programme, index) =>
        <button type="button" className="os-programme" key={programme.name} onClick={() => onOpen(programmeDetail(index))}>
            <span className="os-programme-index">{programme.icon}</span><div><span className="os-eyebrow">{programme.age}</span><h3>{programme.name}</h3><p>{programme.description}</p>{full && <p className="os-programme-days"><CalendarDays />{programme.days}</p>}</div>
            <div className="os-programme-price"><strong>{programme.price}<small> GEL</small></strong><span>per month</span></div><ArrowUpRight className="os-programme-arrow" />
        </button>)}<p className="os-muted os-programme-note">Three sessions a week. Ask the academy about the right group and availability.</p></div>;
}

function Fixture({ onOpen, compact = false }: { onOpen: (detail: Detail) => void; compact?: boolean }) {
    return <button type="button" className={`os-fixture ${compact ? 'os-fixture-compact' : ''}`} onClick={() => onOpen(fixtureDetail)}>
        <div className="os-fixture-top"><span className="os-eyebrow">Next public fixture</span><span>U16 · Friendly</span></div>
        <div className="os-fixture-teams"><div><Crest small /><strong>Dinamo</strong></div><div className="os-fixture-time"><strong>11:00</strong><span>Sat, 3 Oct</span></div><div><span className="os-away-crest"><Shield /></span><strong>Riverside</strong></div></div>
        <div className="os-fixture-bottom"><span><MapPin />Academy ground</span><ArrowUpRight /></div>
    </button>;
}

function WorkArea({ context, sparse, onOpen }: { context: Context; sparse: boolean; onOpen: (detail: Detail) => void }) {
    if (!['owner', 'family', 'referee'].includes(context)) return null;
    const referee = context === 'referee';
    const family = context === 'family';
    return <section className="os-work" aria-labelledby="os-work-heading">
        <div className="os-section-heading"><div className="os-work-title"><span className="os-work-symbol"><LayoutDashboard /></span><div><h2 id="os-work-heading">{family ? 'Your family at Dinamo' : referee ? 'Your connection to the club' : 'Your club, in motion.'}</h2><p>{family ? 'The essentials for your child’s week.' : referee ? 'Club referee · Active appointment' : 'Good afternoon, Luka. Pick up where you left off.'}</p></div></div><span className="os-private"><LockKeyhole />Only visible to you</span></div>
        {referee ? <div className="os-connection-grid">
            <div className="os-connection"><Flag /><div><h3>Your officiating</h3><p>Availability, match appointments and reports — across all your football.</p><button type="button" className="os-text-link" onClick={() => onOpen(workspaceDetail('referee'))}>Open personal workspace <ArrowUpRight /></button></div></div>
            <div className="os-connection"><Shield /><div><h3>Your place at Dinamo</h3><p>See your approved club responsibilities. A club appointment stays alongside your independent work.</p><button type="button" className="os-text-link" onClick={() => onOpen(workspaceDetail('club'))}>Open club workspace <ArrowUpRight /></button></div></div>
        </div> : <div className="os-work-grid">
            <button type="button" className="os-next-session" onClick={() => onOpen({ eyebrow: 'Your next activity', title: sparse ? 'Your schedule is clear' : 'U12 · Training', description: sparse ? 'Future sessions will appear here when they are scheduled.' : 'First touch & decision making', facts: sparse ? undefined : [['When', 'Today · 17:00–18:15'], ['Where', 'Academy ground'], ['Group', family ? 'Your child’s U12 squad' : 'Under 12']], note: 'Only activities within your approved relationship appear in this private area.' })}>
                <span className="os-date-tile"><small>SEP</small><strong>29</strong><span>TUE</span></span><div><span className="os-eyebrow">{sparse ? 'Your schedule' : 'Next up · Today, 17:00'}</span><h3>{sparse ? 'A clear calendar.' : 'U12 training'}</h3><p>{sparse ? 'New activities will appear here.' : 'Academy ground · 75 minutes'}</p></div><ArrowUpRight />
            </button>
            <button type="button" className="os-decision" onClick={() => onOpen({ eyebrow: 'Requests', title: sparse ? 'You’re all caught up.' : family ? 'Permission to take part' : 'Two requests to review', description: sparse ? 'There are no decisions waiting for you in this sample.' : family ? 'Review the activity details before giving permission.' : 'One staff invitation and one player application need your attention.', note: 'The real Requests workflow will open here. This preview does not accept, decline or alter any invitation.' })}>
                <span className="os-decision-symbol">{sparse ? <Check /> : <Inbox />}</span><div><span className="os-eyebrow">{sparse ? 'Nothing waiting' : 'Needs your attention'}</span><h3>{sparse ? 'All caught up' : family ? '1 permission request' : '2 requests to review'}</h3><p>{sparse ? 'We’ll bring the next decision here.' : family ? 'Upcoming squad activity' : 'Staff invitation · Player application'}</p></div><ArrowRight />
            </button>
        </div>}
        <div className="os-work-footer"><span className="os-muted">{referee ? 'One identity. All your responsibilities.' : family ? 'Connected through your confirmed family relationship.' : 'A few useful shortcuts'}</span><div>
            {context === 'owner' && <><button type="button" onClick={() => onOpen({ eyebrow: 'Club leadership', title: 'Invite someone to contribute.', description: 'Choose a person, describe their responsibility and set the scope of access. Their invitation remains pending until they accept.', note: 'Preview of the existing Add staff destination. No invitation will be sent.' })}><UserPlus />Add staff</button><button type="button" onClick={() => onOpen({ eyebrow: 'Club store', title: 'Your next club item.', description: 'Add a product, its price and availability in the existing store editor.', note: 'Preview of the existing Add store item destination. Nothing is created or published.' })}><PackagePlus />Add store item</button></>}
            <button type="button" className="os-workspace-link" onClick={() => onOpen(referee ? { eyebrow: 'Your club responsibilities', title: 'Club referee', description: 'Your appointment and the access approved for it stay visible in your club workspace.', note: 'Match actions depend on your assignment to that match. Additional club responsibilities require leadership approval; they are not granted by changing the overview.' } : workspaceDetail(family ? 'family' : 'club'))}>{referee ? 'View responsibilities' : family ? 'Open family hub' : 'Open workspace'}<ArrowUpRight /></button>
        </div></div>
    </section>;
}

function Explorer({ initialScene, onOpen, navigate }: { initialScene: Scene; onOpen: (detail: Detail) => void; navigate: (tab: PageTab) => void }) {
    const [scene, setScene] = useState<Scene>(initialScene);
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    return <section className="os-explorer" aria-labelledby="os-explore-heading">
        <div className="os-section-heading"><div><span className="os-eyebrow">Inside the academy</span><h2 id="os-explore-heading">Find your place in the game.</h2></div><span className="os-section-number">0{scenes.findIndex(item => item.id === scene) + 1} / 03</span></div>
        <div className="os-scene-tabs" role="tablist" aria-label="Explore the academy">
            {scenes.map(({ id, label, icon: Icon }, index) => <button type="button" role="tab" id={`scene-tab-${id}`} aria-controls="academy-scene" aria-selected={scene === id} tabIndex={scene === id ? 0 : -1} key={id} ref={el => { buttons.current[index] = el; }}
                onClick={() => setScene(id)} onKeyDown={event => {
                    const next = event.key === 'ArrowRight' ? (index + 1) % scenes.length : event.key === 'ArrowLeft' ? (index + scenes.length - 1) % scenes.length : event.key === 'Home' ? 0 : event.key === 'End' ? scenes.length - 1 : null;
                    if (next !== null) { event.preventDefault(); setScene(scenes[next].id); buttons.current[next]?.focus(); }
                }}><Icon />{label}<span className="os-tab-indicator" /></button>)}
        </div>
        <div id="academy-scene" role="tabpanel" aria-labelledby={`scene-tab-${scene}`} className={`os-scene os-scene-${scene}`} tabIndex={0}>
            <div key={scene} className="os-scene-inner">
                {scene === 'football' ? <><div className="os-scene-copy"><span className="os-eyebrow">From first touch to next level</span><h3>Good football<br />starts here.</h3><p>Find the right group, understand the commitment and meet the people behind the training.</p><button type="button" className="os-text-link" onClick={() => navigate('Training & teams')}>Explore training & teams <ArrowRight /></button></div><Pitch /></>
                    : scene === 'place' ? <><div className="os-scene-copy"><span className="os-eyebrow">More than a pitch</span><h3>A place<br />to belong.</h3><p>The ground. The familiar faces. The small moments that make a club feel like home.</p><button type="button" className="os-text-link" onClick={() => onOpen(groundDetail)}>Explore the training ground <ArrowRight /></button></div><div className="os-ground-scene"><img src="/preview/club-ground.png" alt="Illustrative football ground in Tbilisi" /><span><MapPin />Tbilisi, Georgia</span></div></>
                        : <><div className="os-scene-copy"><span className="os-eyebrow">Football is a shared effort</span><h3>The people<br />make the club.</h3><p>Coaches, players, families and volunteers. Different contributions. The same love of the game.</p><button type="button" className="os-text-link" onClick={() => navigate('People')}>Meet the people <ArrowRight /></button></div><div className="os-people-scene"><div className="os-people-orbit" /><span className="os-person-bubble os-bubble-one">CL<small>Coaching</small></span><span className="os-person-bubble os-bubble-two">TB<small>Officiating</small></span><span className="os-person-bubble os-bubble-three"><Heart /><small>Families</small></span><div className="os-community-note"><Users /><div><strong>Many roles. One community.</strong><span>Every contribution has a place.</span></div></div></div></>}
            </div>
        </div>
    </section>;
}

function Posts({ onOpen, summary = false }: { onOpen: (detail: Detail) => void; summary?: boolean }) {
    return <div className={`os-posts ${summary ? 'os-posts-summary' : ''}`}>{updates.map((post, i) => <article className="os-post" key={post.title}>
        <button type="button" className="os-post-open" onClick={() => onOpen({ eyebrow: `${post.category} · ${post.date}`, title: post.title, description: post.text, image: post.image })}>
            {post.image && <div className="os-post-photo"><img src={post.image} alt="Illustrative academy training session" loading="lazy" /></div>}
            <div className="os-post-copy"><span className="os-eyebrow">{post.category}</span><h3>{post.title}</h3><p>{post.text}</p><div className="os-post-meta"><span>Academy update · {post.date}</span><ArrowUpRight /></div></div>
        </button>{!summary && <div className="os-post-author"><Crest small /><span>{clubName}</span><span className="os-muted">Post {i + 1}</span></div>}
    </article>)}</div>;
}

function EmptyContent({ title, children, action, onAction }: { title: string; children: ReactNode; action: string; onAction: () => void }) {
    return <section className="os-empty"><span className="os-empty-symbol"><Flag /></span><span className="os-eyebrow">The story starts here</span><h2>{title}</h2><p>{children}</p><Action onClick={onAction}>{action}<ArrowUpRight /></Action></section>;
}

function StudyPage({ context, sparse }: { context: Context; sparse: boolean }) {
    const [tab, setTab] = useState<PageTab>('Overview');
    const [detail, setDetail] = useState<Detail | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [following, setFollowing] = useState(false);
    const content = useRef<HTMLDivElement>(null);
    const viewer = contexts.find(item => item.id === context)!;
    const organization = context === 'organization';
    const connected = ['owner', 'referee', 'family'].includes(context);
    const name = organization ? 'Fieldwork Sportswear' : clubName;
    const navigate = (next: PageTab) => {
        setTab(next);
        requestAnimationFrame(() => content.current?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    };
    const contact = () => setDetail({ eyebrow: 'Get in touch', title: organization ? 'Talk about your club’s kit.' : 'Start a conversation.', description: organization ? 'Tell the organization about your club, the items you need and your timeline.' : 'Ask about training, joining the academy or planning a visit.', note: 'In the connected app, this opens the organization’s published contact options. This preview does not send messages or invent contact details.' });
    const currentTabs = organization ? ['Overview', 'About'] as PageTab[] : pageTabs;
    return <div className="os-app">
        <a href="#overview-content" className="os-skip">Skip to content</a>
        <header className="os-global"><div className="os-frame os-global-inner">
            <button type="button" className="os-brand" onClick={() => { setTab('Overview'); window.scrollTo({ top: 0, behavior: 'instant' }); }} aria-label="GrassKickZ overview"><img src="/brand/grasskickz-main.png" alt="GrassKickZ" /></button>
            <nav aria-label="Main navigation" className="os-global-nav"><button type="button" onClick={() => setDetail({ eyebrow: 'Your football', title: 'Everything you’re part of.', description: 'Your clubs, people and activities stay connected from Home. This study focuses on the new organization overview.' })}>Home</button><button type="button" aria-current={connected ? 'page' : undefined} onClick={() => setDetail({ eyebrow: 'Your connections', title: 'My clubs', description: connected ? `You’re connected to ${clubName}. Each club keeps its own responsibilities and workspace.` : 'Clubs you join will be easy to reach here.', facts: connected ? [['Current club', clubName], ['Your connection', context === 'referee' ? 'Club referee' : context === 'family' ? 'Parent / guardian' : 'Owner · Coach']] : undefined })}>My clubs<ChevronDown /></button><button type="button" onClick={() => setDetail(workspaceDetail(context === 'referee' ? 'referee' : context === 'family' ? 'family' : 'club'))}>My work</button><button type="button" onClick={() => { navigate('Schedule'); if (organization) setDetail({ eyebrow: 'Your schedule', title: 'Your football calendar', description: 'Personal and club activities stay connected in your schedule.' }); }}>Schedule</button></nav>
            <div className="os-global-actions"><button type="button" className="os-search-trigger" aria-label="Search this academy" onClick={() => setSearchOpen(true)}><Search /><span>Find something</span></button><button type="button" className="os-icon-button" aria-label="Requests" onClick={() => setDetail({ eyebrow: 'Requests', title: 'Your decisions, together.', description: 'Invitations, applications and permissions addressed to you or organizations you can manage.', note: 'Request status comes from the original workflow. Viewing an overview will never accept a request.' })}><Inbox /></button><button type="button" className="os-icon-button os-notifications" aria-label="Notifications" onClick={() => setDetail({ eyebrow: 'Notifications', title: 'You’re up to date.', description: 'Updates from the people and organizations you follow will appear here.' })}><Bell /></button><button type="button" className="os-account" aria-label={`Account: ${viewer.name}`} onClick={() => setDetail({ eyebrow: 'Your identity', title: viewer.name, description: 'Your public identity stays separate from your permissions. You can contribute to football in more than one way.' })}>{viewer.initials}</button></div>
        </div></header>
        <main>
            <section className={`os-hero ${organization ? 'os-hero-organization' : ''}`} aria-labelledby="os-club-name"><div className="os-frame os-hero-grid">
                <div className="os-hero-copy"><div className="os-identity-meta">{organization ? <Shirt /> : <Crest small />}<span>{organization ? 'The people behind the kit' : 'Football academy · Tbilisi'}</span></div>
                    <h1 id="os-club-name">{organization ? <>Made for<br />your team.</> : <>FC Dinamo<br />Tbilisi Academy<span>.</span></>}</h1>
                    <p>{organization ? 'Fieldwork Sportswear. Teamwear and club clothing, made for the people who live the game.' : 'A place to learn. A team to grow with. Football that stays with you long after the final whistle.'}</p>
                    <div className="os-hero-actions"><Action primary onClick={() => organization ? contact() : connected ? setDetail(workspaceDetail(context === 'family' ? 'family' : 'club')) : navigate(context === 'coach' ? 'Schedule' : 'Training & teams')}>{organization ? 'Contact organization' : connected ? context === 'family' ? 'Open family hub' : 'Open workspace' : context === 'coach' ? 'Explore squads & fixtures' : 'Find your training'}<ArrowUpRight /></Action><button type="button" className="os-quiet-button" onClick={contact}><MessageCircle />Get in touch</button></div>
                    <div className="os-hero-footer"><span><MapPin />Tbilisi, Georgia</span><span className="os-hero-separator" /><span>{connected ? context === 'owner' ? 'Your club · Owner & coach' : context === 'referee' ? 'Your club · Referee' : 'Your child’s academy' : organization ? 'Teamwear & club clothing' : 'Youth football'}</span></div>
                </div>
                {organization ? <div className="os-kit-art" aria-hidden="true"><div className="os-kit-circle" /><Shirt /><span>For the badge.<br />For each other.</span></div>
                    : sparse ? <div className="os-hero-no-photo"><Pitch compact /><span>Space for the next chapter.</span></div>
                        : <figure className="os-hero-image"><img src="/preview/club-ground.png" alt="Illustrative academy ground, shown in full without cropping" width="1536" height="1024" fetchPriority="high" /><figcaption><span className="os-image-line" />The game belongs to everyone.<button type="button" aria-label="View full cover image" onClick={() => setDetail(groundDetail)}><ArrowUpRight /></button></figcaption></figure>}
            </div></section>
            <div className="os-section-nav"><div className="os-frame os-section-nav-inner"><nav aria-label="Organization sections">{currentTabs.map(item => <button type="button" key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => navigate(item)}>{item}</button>)}</nav><button type="button" className={`os-follow ${following ? 'is-following' : ''}`} aria-pressed={following} onClick={() => setFollowing(!following)}>{following ? <Check /> : <Plus />}{following ? 'Following' : 'Follow'}</button></div></div>
            <div ref={content} className="os-frame os-content" id="overview-content" tabIndex={-1}>
                {organization ? <div className="os-content-grid"><div><span className="os-eyebrow">{tab === 'About' ? 'About Fieldwork' : 'Made for clubs'}</span><h2 className="os-page-heading">Every team has a story.<br />Wear yours.</h2><p className="os-lead">Club clothing and teamwear. Start with a conversation about your team, your colours and what you need.</p><div className="os-organization-services"><div><Shirt /><h3>Teamwear</h3><p>Explore the organization’s published focus.</p></div><div><Users /><h3>Club clothing</h3><p>Contact the team to discuss your club.</p></div></div><Action primary onClick={contact}>Discuss your club’s kit<ArrowUpRight /></Action><p className="os-muted os-organization-note">No catalogue or published prices yet. Contact the organization for product information.</p></div><aside className="os-rail"><section className="os-rail-section"><span className="os-eyebrow">Organization</span><h3>{name}</h3><p>Sportswear · Tbilisi, Georgia</p><button type="button" className="os-text-link" onClick={contact}>Contact the team<ArrowUpRight /></button></section></aside></div>
                    : tab === 'Overview' ? <>
                        <WorkArea context={context} sparse={sparse} onOpen={setDetail} />
                        <div className="os-content-grid"><div className="os-main-stack">
                            {sparse ? <EmptyContent title="A new chapter for this club." action="Contact the academy" onAction={contact}>Training programmes, fixtures and updates will appear as the club shares them. In the meantime, get to know the people behind the club.</EmptyContent>
                                : <>
                                    {context === 'visitor' && <section className="os-training-lead"><div className="os-section-heading"><div><span className="os-eyebrow">For your next chapter</span><h2>A good start. The right group.</h2></div><Flag /></div><Programmes onOpen={setDetail} /></section>}
                                    {context === 'coach' && <section className="os-training-lead"><div className="os-section-heading"><div><span className="os-eyebrow">Meet your next opposition</span><h2>Good teams make a better game.</h2></div><Flag /></div><p className="os-lead">Explore the academy’s public squads and fixtures before starting a match conversation.</p><div className="os-squad-links">{['Under 12', 'Under 16'].map(squad => <button type="button" key={squad} onClick={() => setDetail({ eyebrow: 'Public squad', title: squad, description: 'Academy youth football', note: 'The public squad page will show published team information. Individual players’ private records stay in their authorized workspace.' })}><Shirt /><span>{squad}<small>Academy squad</small></span><ArrowUpRight /></button>)}</div><button type="button" className="os-text-link" onClick={contact}>Discuss a friendly <ArrowRight /></button></section>}
                                    <Explorer initialScene={context === 'referee' ? 'community' : 'football'} onOpen={setDetail} navigate={navigate} />
                                    {context !== 'visitor' && <section><div className="os-section-heading"><div><span className="os-eyebrow">Training at Dinamo</span><h2>Room to grow.</h2></div><button type="button" className="os-text-link" onClick={() => navigate('Training & teams')}>All programmes<ArrowRight /></button></div><Programmes onOpen={setDetail} /></section>}
                                    <section><div className="os-section-heading"><div><span className="os-eyebrow">Around the academy</span><h2>Life between the lines.</h2></div><button type="button" className="os-text-link" onClick={() => navigate('Posts')}>All posts<ArrowRight /></button></div><Posts onOpen={setDetail} summary /></section>
                                </>}
                        </div><aside className="os-rail" aria-label="Academy information">
                            {!sparse && <Fixture onOpen={setDetail} />}
                            <section className="os-rail-section"><span className="os-eyebrow">The academy, at a glance</span><h3>Rooted in Tbilisi.<br />Built around football.</h3><p>Youth training, team development and a shared love for the game.</p><div className="os-rail-fact"><MapPin /><div><strong>Tbilisi, Georgia</strong><span>Explore the published venue information</span></div></div><button type="button" className="os-text-link" onClick={contact}>Contact the academy<ArrowUpRight /></button></section>
                            <section className="os-rail-section"><div className="os-section-heading"><span className="os-eyebrow">People behind the club</span><Users /></div><button type="button" className="os-person-row" onClick={() => setDetail(staffDetail)}><span className="os-avatar">CL</span><span><strong>Coach Luka</strong><small>Club leadership · Coaching</small></span><ArrowUpRight /></button>{<button type="button" className="os-person-row" onClick={() => setDetail(refereeDetail)}><span className="os-avatar">TB</span><span><strong>Tamar Beridze</strong><small>Club referee</small></span><ArrowUpRight /></button>}</section>
                            {context === 'referee' && <section className="os-rail-section os-officiating-note"><Flag /><h3>Your game goes beyond this club.</h3><p>Your personal officiating remains one click away.</p><button type="button" className="os-text-link" onClick={() => setDetail(workspaceDetail('referee'))}>My officiating<ArrowUpRight /></button></section>}
                        </aside></div>
                    </> : <div className="os-section-page" key={tab}><div className="os-section-heading"><div><span className="os-eyebrow">{clubName}</span><h2 className="os-page-heading">{tab === 'Posts' ? 'From the academy.' : tab === 'Training & teams' ? 'Find your next step.' : tab === 'Schedule' ? 'The week ahead.' : tab === 'People' ? 'A club is its people.' : 'Where the game happens.'}</h2></div><span className="os-section-number">{tab}</span></div>
                        {sparse ? <EmptyContent title={`More ${tab === 'Training & teams' ? 'training information' : tab.toLowerCase()} to come.`} action="Contact the academy" onAction={contact}>The club hasn’t published this information yet. You can still ask about the academy and how to get involved.</EmptyContent>
                            : tab === 'Posts' ? <Posts onOpen={setDetail} />
                                : tab === 'Training & teams' ? <><p className="os-lead">Two pathways. The same commitment to helping young players grow.</p><Programmes onOpen={setDetail} full /><div className="os-training-bottom"><Pitch /><div><h3>Not sure where to start?</h3><p>Ask the academy about the right group for your child before making a commitment.</p><Action onClick={contact}>Ask about training<ArrowUpRight /></Action></div></div></>
                                    : tab === 'Schedule' ? <><p className="os-lead">Public fixtures and events. Private team activities stay in your workspace.</p><Fixture onOpen={setDetail} /><div className="os-calendar-note"><CalendarDays /><span>More fixtures will appear here when the club publishes them.</span></div></>
                                        : tab === 'People' ? <div className="os-people-page">{[
                                                { initials: 'CL', detail: staffDetail, summary: 'Helping the club and its people move forward.' },
                                                { initials: 'TB', detail: refereeDetail, summary: 'Contributing to the game through officiating.' },
                                            ].map(person => <button type="button" className="os-person-card" key={person.initials} onClick={() => setDetail(person.detail)}><span className="os-person-initials">{person.initials}</span><div><span className="os-eyebrow">{person.detail.description}</span><h3>{person.detail.title}</h3><p>{person.summary}</p><span className="os-text-link">View responsibilities<ArrowUpRight /></span></div></button>)}<div className="os-people-page-note"><Users /><h3>Different roles.<br />A shared direction.</h3><p>Public staff appointments help you understand who contributes to the club.</p></div></div>
                                            : <div className="os-facilities-page"><img src="/preview/club-ground.png" alt="Illustrative academy ground" /><div><span className="os-eyebrow">Tbilisi, Georgia</span><h3>Space to play.<br />Room to grow.</h3><p>Explore the ground and ask the academy about arriving for your first session.</p><Action onClick={() => setDetail(groundDetail)}>View ground details<ArrowUpRight /></Action></div></div>}
                    </div>}
                <footer className="os-footer"><span>GrassKickZ<span className="os-footer-dot">.</span></span><p>Connected by the game.</p><button type="button" onClick={() => { window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}>Back to top<ArrowDown /></button></footer>
            </div>
        </main>
        <DetailDrawer detail={detail} onClose={() => setDetail(null)} onOpen={setDetail} hasOfficiating={context === 'referee'} />
        {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} navigate={navigate} onOpen={setDetail} tabs={currentTabs} showProgrammes={!organization && !sparse} />}
    </div>;
}

export function OverviewStudy() {
    const initial = new URLSearchParams(window.location.search).get('view');
    const [context, setContext] = useState<Context>(contexts.find(item => item.id === initial)?.id ?? 'owner');
    const [sparse, setSparse] = useState(false);
    return <><StudyPage key={`${context}:${sparse}`} context={context} sparse={sparse} /><aside className="os-review-bar" aria-label="Design review controls"><div><span className="os-review-indicator" /><strong>DESIGN STUDY 01</strong><span className="os-review-disclaimer">Local preview · Sample content</span></div><label><span>Viewing as</span><select aria-label="Viewing as" value={context} onChange={event => { const next = event.target.value as Context; setContext(next); const url = new URL(window.location.href); url.searchParams.set('view', next); window.history.replaceState({}, '', url); }}>{contexts.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="os-sparse-toggle"><input type="checkbox" checked={sparse} onChange={event => setSparse(event.target.checked)} />Sparse content</label><span className="os-review-live"><LockKeyhole />Live site unchanged</span></aside></>;
}
