import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Zap, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { getMatchHistory, type MatchHistoryPage } from '../matchHistory/api';

const upcoming = '/matches?section=fixtures&period=UPCOMING&mine=true';
export function MatchActivity() {
  const { user, sessionId } = useAuth();
  return <Activity key={`${user?.id ?? 'guest'}:${sessionId}`}/>;
}
function Activity() {
  const { user, sessionId } = useAuth(), { i18n } = useTranslation();
  const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
  const [data, setData] = useState<MatchHistoryPage | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void getMatchHistory('period=UPCOMING&mine=true&page=0&size=3', controller.signal, sessionId)
      .then(result => { if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) setData(result); })
      .catch(() => { if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) setFailed(true); });
    return () => controller.abort();
  }, [user, sessionId, attempt]);
  const match = data?.items[0];
  const date = (value: string, timezone: string | null) => {
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) return copy('Time to be confirmed', 'დრო დასაზუსტებელია');
    const zone = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? timezone : null;
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...(zone ? { timeZone: zone, timeZoneName: 'short' } : {}) };
    try { return new Intl.DateTimeFormat(i18n.language, options).format(instant); }
    catch { return new Intl.DateTimeFormat(i18n.language, { ...options, timeZone: undefined, timeZoneName: undefined }).format(instant); }
  };
  return <section className="mc-lane mc-lane-match" aria-labelledby="mc-match-lane-title">
    <div className="mc-lane-top"><span className="mc-lane-label"><Zap size={14} aria-hidden="true"/>{copy('Match exchange', 'მატჩების გაცვლა')}</span><Link to="/matches?section=find">{copy('Find an opponent', 'მეტოქის პოვნა')}<ArrowRight size={15} aria-hidden="true"/></Link></div>
    <h2 id="mc-match-lane-title">{copy('Your next game starts here', 'თქვენი შემდეგი მატჩი აქ იწყება')}</h2><p className="mc-lane-description">{copy('Arrange a friendly. Keep your next fixture in sight.', 'დაგეგმეთ ამხანაგური მატჩი და ნახეთ მომავალი შეხვედრა.')}</p>
    <div className="mc-lane-main">
      {!user ? <div className="mc-lane-empty"><CalendarDays size={24} aria-hidden="true"/><p>{copy('Your teams, kick-off times and match plans, together here.', 'თქვენი გუნდები, მატჩების დრო და გეგმები ერთ სივრცეში.')}</p><Link to="/login?returnTo=%2Fmatches">{copy('Sign in to see your matches', 'შედით თქვენი მატჩების სანახავად')}<ArrowRight size={15}/></Link></div>
        : failed ? <div className="mc-lane-empty" role="alert"><p>{copy('Your fixtures could not load.', 'თქვენი მატჩები ვერ ჩაიტვირთა.')}</p><button type="button" onClick={() => { setFailed(false); setData(null); setAttempt(n => n + 1); }}>{copy('Try again', 'ხელახლა ცდა')}</button></div>
        : !data ? <p className="mc-lane-empty" role="status">{copy('Loading your fixtures…', 'თქვენი მატჩები იტვირთება…')}</p>
        : !match ? <div className="mc-lane-empty"><CalendarDays size={24} aria-hidden="true"/><p>{copy('No upcoming fixtures for your teams or appointments yet.', 'თქვენი გუნდებისა და დანიშვნებისთვის მომავალი მატჩები ჯერ არ არის.')}</p><Link to="/matches?section=find">{copy('Arrange your next match', 'დაგეგმეთ შემდეგი მატჩი')}<ArrowRight size={15}/></Link></div>
        : <Link className="mc-next-fixture" to={match.detailPath.startsWith('/') && !match.detailPath.startsWith('//') ? match.detailPath : upcoming}>
          <span className="mc-fixture-caption">{copy('Next fixture', 'შემდეგი მატჩი')}<span>{match.tournamentName || copy('Your teams & appointments', 'თქვენი გუნდები და დანიშვნები')}</span></span>
          <span className="mc-fixture-time"><CalendarDays size={14} aria-hidden="true"/>{match.startsAt ? <time dateTime={match.startsAt}>{date(match.startsAt, match.timezone)}</time> : copy('Date to be confirmed', 'თარიღი დასაზუსტებელია')}</span>
          <strong>{match.homeClubName && match.awayClubName ? `${match.homeClubName} ${copy('vs', '—')} ${match.awayClubName}` : match.title}</strong>
          {(match.homeSquadName || match.awaySquadName) && <span className="mc-fixture-context">{[match.homeSquadName, match.awaySquadName].filter(Boolean).join(' · ')}</span>}
          {match.locationName && <span className="mc-fixture-context"><MapPin size={13} aria-hidden="true"/>{match.locationName}</span>}
          <span className="mc-fixture-open">{copy('Match details', 'მატჩის დეტალები')}<ArrowRight size={15} aria-hidden="true"/></span>
        </Link>}
    </div>
    <footer className="mc-lane-footer"><Link to={upcoming}>{data?.total ? copy(`${data.total} upcoming ${data.total === 1 ? 'fixture' : 'fixtures'}`, `${data.total} მომავალი მატჩი`) : copy('Upcoming fixtures', 'მომავალი მატჩები')}<ArrowRight size={14} aria-hidden="true"/></Link><Link to="/matches?section=fixtures&period=HISTORY&mine=true">{copy('Results & reports', 'შედეგები და ოქმები')}</Link></footer>
  </section>;
}
