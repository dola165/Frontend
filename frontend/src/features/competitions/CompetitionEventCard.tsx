import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, UsersRound, ArrowRight, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TournamentStatusBadge } from '../../components/tournaments/TournamentPresentation';
import { formatTournamentDateRange } from '../../components/tournaments/tournamentFormatters';
import { CompetitionCapacity } from './CompetitionCapacity';
import { CompetitionVisual } from './CompetitionVisual';
import { useCompetitionCopy } from './competitionCopy';
import { familyLabels, structureLabels, type CompetitionCard } from './api';

export function CompetitionEventCard({ event, returnTo }: { event: CompetitionCard; returnTo: string }) {
  const { i18n } = useTranslation(), translate = useCompetitionCopy();
  const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
  const rules = event.profile.rules;
  return <article className={`mc-event mc-collection-event mc-tone-${rules?.family.toLowerCase() || 'unclassified'}`}>
    <Link className="mc-event-art-link" to={`/tournaments/${event.id}`} state={{ returnTo }} aria-label={`${copy('View', 'ნახვა')} ${event.name}`}><CompetitionVisual id={event.id} name={event.name} imageUrl={event.bannerImageUrl} discipline={rules?.discipline}/></Link>
    <div className="mc-event-content"><div className="mc-event-status"><TournamentStatusBadge status={event.status}/><span>{copy(event.participantScope === 'PLAYER' ? 'Individual entry' : event.participantScope === 'SQUAD' ? 'Squads' : 'Club teams', event.participantScope === 'PLAYER' ? 'ინდივიდუალური' : event.participantScope === 'SQUAD' ? 'გუნდები' : 'კლუბები')}</span></div>
      <h3><Link to={`/tournaments/${event.id}`} state={{ returnTo }}>{event.name}</Link></h3>
      {rules ? <div className="mc-event-format"><span><Trophy size={13} aria-hidden="true"/>{translate(structureLabels[rules.structure])}</span><span>{translate(rules.ageGroup)} · {rules.sideSize}v{rules.sideSize}</span></div> : <p className="mc-event-description">{event.description || copy('Format details from the host', 'ფორმატის დეტალები მასპინძელთან')}</p>}
      <dl><div><CalendarDays size={14} aria-hidden="true"/><dt className="sr-only">{copy('Dates', 'თარიღები')}</dt><dd>{formatTournamentDateRange(event.startDate, event.endDate, i18n.language) || copy('Dates to be confirmed', 'თარიღები დასაზუსტებელია')}</dd></div>
        {rules && <div><MapPin size={14} aria-hidden="true"/><dt className="sr-only">{copy('Location', 'მდებარეობა')}</dt><dd>{[rules.city, rules.country].filter(Boolean).join(', ') || copy('Location to be confirmed', 'ადგილი დასაზუსტებელია')}</dd></div>}
        <div><UsersRound size={14} aria-hidden="true"/><dt className="sr-only">{copy('Entries', 'მონაწილეები')}</dt><dd className="mc-event-capacity"><CompetitionCapacity count={event.entryCount} capacity={event.entryCap} name={event.name}/>{rules && <span className="mc-entry-fee">{rules.entryFee === 0 ? copy('Free entry', 'უფასო მონაწილეობა') : `${rules.entryFee} ${rules.currency} / ${copy(rules.feeBasis === 'PLAYER' ? 'player' : rules.feeBasis === 'TEAM' ? 'team' : 'event', rules.feeBasis === 'PLAYER' ? 'მოთამაშე' : rules.feeBasis === 'TEAM' ? 'გუნდი' : 'ღონისძიება')}`}</span>}</dd></div></dl>
      <footer><span>{event.hostClubName || event.organizerName || (rules ? translate(familyLabels[rules.family]) : copy('Tournament host', 'ტურნირის მასპინძელი'))}</span><Link to={`/tournaments/${event.id}`} state={{ returnTo }}>{copy('Explore', 'ნახვა')}<ArrowRight size={14} aria-hidden="true"/></Link></footer>
    </div>
  </article>;
}
