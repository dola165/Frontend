import '../features/squadCommunication/squad-life.css';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, HeartHandshake, KeyRound, Loader2, Mail, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MediaImage } from '../components/ui/MediaImage';
import { fetchParentHub, type ParentChild, type ParentHub } from '../features/parents/api';
import { ChildActivationDialog } from '../features/parents/ChildActivationDialog';
import { extractApiErrorMessage } from '../utils/apiError';
import { isCurrentAuthSession, type AuthSessionId } from '../utils/authStorage';
import { formatDate } from '../utils/formatting';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/parents/parents.css';
import { ChildSquadSchedule } from '../features/parents/FamilySchedule';
import { isExtensionCapabilityAvailable } from '../features/capabilities/extensions';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';
import '../features/parents/family-workspace.css';

type Copy = (english: string, georgian: string) => string;
const statusLabel = (status: string | null, copy: Copy) => ({
    CONFIRMED: copy('Consent confirmed', 'თანხმობა დადასტურებულია'),
    PENDING: copy('Consent waiting', 'თანხმობა მოსალოდნელია'),
    EXPIRED: copy('Consent link expired', 'თანხმობის ბმულს ვადა გაუვიდა'),
    DECLINED: copy('Consent declined', 'თანხმობა უარყოფილია'),
    NOT_REQUIRED: copy('Consent not required', 'თანხმობა საჭირო არ არის'),
}[status ?? ''] ?? copy('Consent needed', 'საჭიროა თანხმობა'));

const ChildPortrait = ({ child }: { child: ParentChild }) => child.photoUrl
    ? <MediaImage src={resolveMediaUrl(child.photoUrl) || undefined} alt="" className="parent-child-avatar" />
    : <span className="parent-child-avatar parent-child-initials" aria-hidden="true">{(child.fullName || 'Child').slice(0, 2).toUpperCase()}</span>;

interface ParentHubPageProps { previewSessionId?: AuthSessionId }

export function ParentHubPage(props: ParentHubPageProps = {}) {
    if ('previewSessionId' in props) {
        if (!import.meta.env.DEV) return null;
        return <ParentHubContent sessionId={props.previewSessionId ?? null} />;
    }
    return <AuthenticatedParentHubPage />;
}

function AuthenticatedParentHubPage() {
    const { user, sessionId, isAuthenticated } = useAuth();
    return isAuthenticated ? <ParentHubContent key={`${user?.id}:${sessionId}`} sessionId={sessionId} /> : null;
}

function ParentHubContent({ sessionId }: { sessionId: AuthSessionId }) {
    const copy = useJourneyCopy();
    const [hub, setHub] = useState<ParentHub | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [activatingChild, setActivatingChild] = useState<ParentChild | null>(null);
    const request = useRef(0);
    const refresh = () => {
        setLoading(true);
        setError(null);
        setRevision(value => value + 1);
    };

    useEffect(() => {
        const controller = new AbortController();
        const current = ++request.current;
        void fetchParentHub(sessionId, controller.signal).then(result => {
            if (controller.signal.aborted || current !== request.current || !isCurrentAuthSession(sessionId)) return;
            setHub(result);
            setSelectedId(previous => result.children.some(child => child.cardId === previous) ? previous : result.children[0]?.cardId ?? null);
        }).catch(err => {
            if (controller.signal.aborted || current !== request.current || !isCurrentAuthSession(sessionId)) return;
            setHub(null);
            setError(extractApiErrorMessage(err, 'We could not load your family information. Please try again.'));
        }).finally(() => {
            if (!controller.signal.aborted && current === request.current && isCurrentAuthSession(sessionId)) setLoading(false);
        });
        return () => controller.abort();
    }, [sessionId, revision]);

    const children = hub?.children ?? [];
    const selected = children.find(child => child.cardId === selectedId);
    const childCount = new Set(children.map(child => child.userId)).size;
    const consentCount = children.filter(child => child.consentStatus !== 'CONFIRMED' && child.consentStatus !== 'NOT_REQUIRED').length;

    return <main className="parent-hub">
        <header className="parent-hub-header">
            <div className="parent-hub-heading">
                <p className="parent-eyebrow"><HeartHandshake size={15} />{copy('Family workspace', 'ოჯახის სივრცე')}</p>
                <h1>{copy('Parent Hub', 'მშობლის სივრცე')}</h1>
                <p>{copy('Your child’s week, coach updates and club connection in one calm view.', 'ბავშვის კვირა, მწვრთნელის განახლებები და კლუბთან კავშირი ერთ სივრცეში.')}</p>
            </div>
            <div className="parent-header-actions">
                <Link className="parent-button" to="/club-operations">{copy('Club permissions', 'კლუბის ნებართვები')} <ArrowRight size={16}/></Link>
                {isExtensionCapabilityAvailable('squadEnrollment') && <Link className="parent-button" to="/parent/enrollment">{copy('Enrollment requests', 'ჩარიცხვის მოთხოვნები')} <ArrowRight size={16} /></Link>}
                <button type="button" className="parent-button parent-refresh" disabled={loading} onClick={refresh} aria-label={copy('Refresh Parent Hub', 'მშობლის სივრცის განახლება')}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /><span>{copy('Refresh', 'განახლება')}</span></button>
            </div>
        </header>
        

        {loading ? <div role="status" className="parent-empty"><Loader2 className="animate-spin" size={26} /><p>Loading your family…</p></div> : error ? <div className="parent-panel parent-empty" role="alert"><h2>Family information is unavailable</h2><p>{error}</p><button type="button" className="parent-button parent-button-primary" onClick={refresh}>Try again</button></div> : children.length === 0 ? <section className="parent-panel parent-empty">
            <div className="parent-icon"><Users size={28} /></div><h2>Your children's clubs belong here</h2><p>Ask your child's club to send a parental consent invitation to your email. Sign in with that verified email and accept the invitation to link your child's record.</p>
            <div className="parent-empty-steps"><span><Mail size={18} /> Open the club's consent email</span><span><ShieldCheck size={18} /> Confirm with your adult account</span><span><HeartHandshake size={18} /> Return here to manage the connection</span></div>
            <p className="parent-muted">Already connected? Check that you are signed in with the email used for consent. Only linked children under 18 with a current club connection appear here.</p>
            <Link to="/account?tab=security" className="parent-button">Check my account <ArrowRight size={16} /></Link>
        </section> : <>
<nav className="parent-children parent-children-top" aria-label={copy('Choose a child', 'აირჩიეთ ბავშვი')}><div className="parent-children-heading"><h2>{copy('Choose a child', 'აირჩიეთ ბავშვი')}</h2><p>{childCount} {childCount === 1 ? copy('linked child', 'დაკავშირებული ბავშვი') : copy('linked children', 'დაკავშირებული ბავშვი')}</p></div><div className="parent-child-list">
                    {children.map(child => <button key={child.cardId} type="button" aria-label={`${child.fullName || copy('Your child', 'თქვენი ბავშვი')} ${child.clubName} ${statusLabel(child.consentStatus, copy)}`} aria-pressed={selectedId === child.cardId} onClick={() => setSelectedId(child.cardId)} className={`parent-child-choice ${selectedId === child.cardId ? 'is-selected' : ''}`}><ChildPortrait child={child} /><span><strong>{child.fullName || copy('Your child', 'თქვენი ბავშვი')}</strong><small className={child.consentStatus !== 'CONFIRMED' && child.consentStatus !== 'NOT_REQUIRED' ? 'parent-warning' : undefined}>{child.clubName} · {statusLabel(child.consentStatus, copy)}</small></span><ArrowRight size={16} /></button>)}
                </div></nav>

            <div className="parent-family-layout">
                {selected && <section className="parent-family-main" key={`schedule:${selected.cardId}`} aria-label={copy(`${selected.fullName || 'Your child'}’s schedule`, `${selected.fullName || 'ბავშვის'} — განრიგი`)}>
                    <div className="parent-week-heading">
                        <div><p className="parent-eyebrow"><CalendarDays size={14}/>{copy('This week', 'ეს კვირა')}</p><h2>{selected.fullName || copy('Your child', 'თქვენი ბავშვი')}</h2><p>{copy('Sessions, replies and coach changes for the selected squad.', 'სესიები, პასუხები და მწვრთნელის ცვლილებები არჩეული გუნდისთვის.')}</p></div>
                    </div>
                    <ChildSquadSchedule child={selected} />
                </section>}
                {selected && <aside className="parent-child-detail" key={selected.cardId}>
                    <section className="parent-panel parent-connection"><div className="parent-section-heading"><div className="parent-profile"><ChildPortrait child={selected}/><div><p className="parent-eyebrow">{copy('Selected player', 'არჩეული მოთამაშე')}</p><h2>{selected.fullName || copy('Your child', 'თქვენი ბავშვი')}</h2><p>{selected.birthYear ? `${copy('Born', 'დაბადების წელი')} ${selected.birthYear}` : copy('Birth year not recorded', 'დაბადების წელი არ არის მითითებული')}{selected.position ? ` · ${selected.position.replaceAll('_', ' ').toLowerCase()}` : ''}</p></div></div><span className="parent-badge">{selected.affiliationStatus === 'TRIALIST' ? copy('On trial', 'საცდელ პერიოდში') : copy('Active player', 'აქტიური მოთამაშე')}</span></div>
                        <div className="parent-club-link"><div><p className="parent-detail-label">{copy('Club & squad', 'კლუბი და გუნდი')}</p><h3>{selected.clubName}</h3><p>{selected.squadNames.length ? selected.squadNames.join(' · ') : copy('No squad assigned yet', 'გუნდი ჯერ არ არის მინიჭებული')}</p>{selected.trialEndsOn && <p>Trial ends {formatDate(selected.trialEndsOn)}</p>}</div><Link className="parent-button" to={`/clubs/${selected.clubId}`}>{copy('View club', 'კლუბის ნახვა')} <ArrowRight size={16} /></Link></div>
                    </section>
                    <details className="parent-panel parent-actions" open={selected.consentStatus !== 'CONFIRMED' && selected.consentStatus !== 'NOT_REQUIRED'}><summary>Account & consent{selected.activationEligible ? ' · sign-in available' : ''}</summary>
                        <div className="parent-action"><div className={`parent-icon ${selected.consentStatus === 'CONFIRMED' ? '' : 'parent-warning'}`}><ShieldCheck size={20} /></div><div><h3>{statusLabel(selected.consentStatus, copy)}</h3><p>{selected.consentStatus === 'CONFIRMED' ? 'Your consent is recorded for participation with this club.' : selected.consentStatus === 'PENDING' ? 'Open the latest consent email from this club to accept or decline. The secure email link is needed to respond.' : selected.consentStatus === 'DECLINED' ? 'Participation consent was declined. Contact the club if you want to discuss or change this.' : 'Ask the club to send a new consent invitation, then open it with the verified email on your account.'}</p></div></div>
                        <div className="parent-action"><div className="parent-icon"><KeyRound size={20} /></div><div><h3>{selected.registered ? 'Child account active' : 'Child account'}</h3><p>{selected.registered ? 'Your child can sign in with their own account. The family connection remains here while they are under 18.' : selected.activationEligible ? 'Your child can now have their own sign-in. Activate it when they are ready.' : 'Your child can stay linked without their own sign-in. Account activation is available for ages 13–17 once the club consent and birth details are ready.'}</p>{selected.activationEligible && <button type="button" className="parent-button parent-button-primary" onClick={() => setActivatingChild(selected)}>Activate child account <ArrowRight size={16} /></button>}</div>{selected.registered && <CheckCircle2 size={19} className="parent-success" />}</div>
                    </details>
                    <section className="parent-family-summary"><p>{childCount} linked {childCount === 1 ? 'child' : 'children'}{consentCount > 0 ? ` · ${consentCount} consent ${consentCount === 1 ? 'step' : 'steps'} to resolve` : ''}</p><p>To link another child, open the academy club’s consent invitation.</p></section>
                </aside>}
            </div>
        </>}
        {activatingChild && <ChildActivationDialog child={activatingChild} sessionId={sessionId} onClose={() => { setActivatingChild(null); refresh(); }} onActivated={() => setHub(previous => previous ? { ...previous, children: previous.children.map(child => child.userId === activatingChild.userId ? { ...child, registered: true, activationEligible: false } : child) } : previous)} />}
    </main>;
}
