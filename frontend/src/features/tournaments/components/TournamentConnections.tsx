import { Link } from 'react-router-dom';
import { Building2, CalendarDays, MapPin, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TournamentDetail } from '../domain';

export function TournamentConnections({ tournament, privateView = false }: { tournament: TournamentDetail; privateView?: boolean }) {
    const { i18n } = useTranslation();
    const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
    return <section className="tc-panel" aria-label={copy('Connected football', 'ფეხბურთთან კავშირი')}>
        <div className="tc-panel-heading"><ShieldCheck size={18}/><h2>{copy('Connected football', 'ფეხბურთთან კავშირი')}</h2></div>
        <Link className="tc-connection" aria-label={`${copy('Organizer', 'ორგანიზატორი')}: ${tournament.organizerName || copy('Organizer profile', 'ორგანიზატორის პროფილი')}`} to={`/organizations/${tournament.organizerOrganizationId}`}><Building2 size={18}/><span><small>{copy('Organizer', 'ორგანიზატორი')}</small><strong>{tournament.organizerName || copy('Organizer profile', 'ორგანიზატორის პროფილი')}</strong></span><ArrowUpRight size={15}/></Link>
        {tournament.hostClubId != null && <Link className="tc-connection" to={`/clubs/${tournament.hostClubId}`}><ShieldCheck size={18}/><span><small>{copy('Host club', 'მასპინძელი კლუბი')}</small><strong>{tournament.hostClubName || copy('Club profile', 'კლუბის პროფილი')}</strong></span><ArrowUpRight size={15}/></Link>}
        {privateView && <Link className="tc-connection" to="/calendar"><CalendarDays size={18}/><span><small>{copy('Your calendar', 'თქვენი კალენდარი')}</small><strong>{copy('Personal and team schedule', 'პირადი და გუნდური განრიგი')}</strong></span><ArrowUpRight size={15}/></Link>}
        <Link className="tc-connection" to="/map"><MapPin size={18}/><span><small>{copy('Places to play', 'სათამაშო ადგილები')}</small><strong>{copy('GrassKickZ Map', 'GrassKickZ რუკა')}</strong></span><ArrowUpRight size={15}/></Link>
        <p className="tc-note">{copy('Club and squad participation stays with the club. Families follow published fixtures; player representation does not grant tournament administration access.', 'კლუბისა და გუნდის მონაწილეობა კლუბთან რჩება. ოჯახები გამოქვეყნებულ მატჩებს ადევნებენ თვალს; მოთამაშის წარმომადგენლობა ტურნირის მართვის უფლებას არ იძლევა.')}</p>
    </section>;
}
