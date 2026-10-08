import { lazy, Suspense, useEffect, useRef } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { CalendarDays, Compass, Flag, Zap, Trophy, Plus, Handshake, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { hasNavigationCapability } from '../../context/navigationCapabilities';
import './matches-hub.css';
import { SelectionIndicator } from '../../components/ui/SelectionIndicator';
import { CompetitionOfficialAssignments } from './CompetitionOfficialAssignments';
import { CompetitionRecoveryPanel } from './CompetitionRecoveryPanel';
import { MatchesOverview } from './MatchesOverview';
import './matches-experience.css';

const CompetitionDirectory = lazy(() => import('./CompetitionDirectory'));
const MatchExchangePage = lazy(() => import('../../pages/MatchExchangePage').then(module => ({ default: module.MatchExchangePage })));
const BrowseTournamentsPage = lazy(() => import('../../pages/BrowseTournamentsPage').then(module => ({ default: module.BrowseTournamentsPage })));
const MatchHistoryPage = lazy(() => import('../../pages/MatchHistoryPage').then(module => ({ default: module.MatchHistoryPage })));
const sections = [
  { id: 'overview', en: 'Overview', ka: 'მიმოხილვა', icon: Compass },
  { id: 'competitions', en: 'Tournaments & leagues', ka: 'ტურნირები და ლიგები', icon: Trophy },
  { id: 'find', en: 'Match exchange', ka: 'მატჩების გაცვლა', icon: Zap },
  { id: 'fixtures', en: 'Fixtures & results', ka: 'მატჩები და შედეგები', icon: CalendarDays },
  { id: 'officials', en: 'Officials', ka: 'მსაჯები', icon: Flag },
];

export function LegacyMatchesRoute({ kind }: { kind: 'matches' | 'competitions' | 'history' }) {
  const location = useLocation();
  const next = new URLSearchParams(location.search);
  next.set('section', kind === 'competitions' ? 'competitions' : kind === 'history' || ['UPCOMING','HISTORY'].includes(next.get('period') ?? '') ? 'fixtures' : next.get('tab') === 'referees' ? 'officials' : 'find');
  return <Navigate replace to={{ pathname: '/matches', search: `?${next}`, hash: location.hash }} state={location.state} />;
}

export function MatchesHub() {
  const { user, sessionId } = useAuth();
  return <HubContent key={`${user?.id ?? 'guest'}:${sessionId}`} />;
}

function HubContent() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
  const [params] = useSearchParams();
  const section = sections.some(item => item.id === params.get('section')) ? params.get('section')! : 'overview';
  const sectionNav = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = sectionNav.current;
    if (!nav) return;
    const revealActive = () => {
      const active = nav.querySelector('[aria-current="page"]');
      if (!active) return;
      const bounds = nav.getBoundingClientRect(), item = active.getBoundingClientRect();
      if (item.right > bounds.right) nav.scrollLeft += item.right - bounds.right;
      else if (item.left < bounds.left) nav.scrollLeft += item.left - bounds.left;
    };
    revealActive();
    const observer = new ResizeObserver(revealActive);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [section]);
  const workView = params.get('view');
  const legacyWork = ['hosts', 'mine', 'invitations'].includes(workView ?? '');
  const privateSection = ['find', 'fixtures', 'officials'].includes(section);
  return <main className="mc-hub mc-experience" data-section={section}>
    <CompetitionRecoveryPanel/>
    <header className="mc-heading"><div><h1>{copy('Matches & Competitions', 'მატჩები და შეჯიბრებები')}</h1><p>{copy('Find your next opponent. Discover a competition. Keep your football moving.', 'იპოვეთ შემდეგი მეტოქე, შეჯიბრება და დაგეგმეთ თქვენი ფეხბურთი.')}</p></div>
      <div className="mc-heading-tools"><div className="mc-heading-actions"><Link className="mc-exchange-action" to="/matches?section=find"><Zap size={16} aria-hidden="true"/>{copy('Find an opponent', 'მეტოქის პოვნა')}</Link>{hasNavigationCapability(user?.navigationCapabilities, 'tournament.create') && <Link className="mc-primary" to="/tournaments/setup"><Plus size={16} aria-hidden="true"/>{copy('Create tournament', 'ტურნირის შექმნა')}</Link>}</div>
      {user && <nav className="mc-personal" aria-label={copy('My activity', 'ჩემი აქტივობა')}><span>{copy('My activity', 'ჩემი აქტივობა')}</span><Link to="/matches?section=find&tab=mine"><Handshake size={13} aria-hidden="true"/>{copy('Arrangements', 'შეთანხმებები')}</Link><Link to="/matches?section=competitions&view=mine"><Trophy size={13} aria-hidden="true"/>{copy('Competitions', 'შეჯიბრებები')}</Link><Link to="/matches?section=competitions&view=invitations"><Inbox size={13} aria-hidden="true"/>{copy('Invitations', 'მოწვევები')}</Link></nav>}</div>
    </header>
    <nav ref={sectionNav} className="mc-sections app-selection-rail" aria-label={copy('Matches & Competitions', 'მატჩები და შეჯიბრებები')}>{sections.map(item => <Link key={item.id} to={item.id === 'overview' ? '/matches' : `/matches?section=${item.id}`} aria-current={section === item.id ? 'page' : undefined}><item.icon size={18} aria-hidden="true" />{copy(item.en, item.ka)}</Link>)}<SelectionIndicator value={section}/></nav>
    <Suspense fallback={<p role="status">{copy('Loading football activity…', 'საფეხბურთო საქმიანობა იტვირთება…')}</p>}>{privateSection && !user ? <section className="mc-panel"><h2>{copy('Continue with your football account', 'გააგრძელეთ თქვენი ანგარიშით')}</h2><p>{copy('Sign in to discover matches and officials and view your permitted fixtures.', 'შედით ანგარიშში მატჩების, მსაჯებისა და ხელმისაწვდომი შეხვედრების სანახავად.')}</p><Link className="mc-primary" to={`/login?returnTo=${encodeURIComponent(`/matches?${params}`)}`}>{copy('Sign in', 'შესვლა')}</Link></section>
      : section === 'overview' ? <MatchesOverview/> : section === 'find' ? <MatchExchangePage embedded />
      : section === 'officials' ? <>{hasNavigationCapability(user?.navigationCapabilities,'referee.workspace')&&<CompetitionOfficialAssignments/>}<MatchExchangePage embedded officials /></>
      : section === 'fixtures' ? <MatchHistoryPage embedded />
      : legacyWork ? <BrowseTournamentsPage embedded />
      : <Suspense fallback={<p role="status">{copy('Loading competitions…', 'შეჯიბრებები იტვირთება…')}</p>}><CompetitionDirectory /></Suspense>}
  </Suspense></main>;
}
