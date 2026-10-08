import { GitFork, UsersRound, MapPin, Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { structureLabels, type CompetitionRules } from './api';
import { useCompetitionCopy } from './competitionCopy';

export function CompetitionFacts({ rules, loading, error, retry }: { rules?: CompetitionRules | null; loading: boolean; error: string; retry: () => void }) {
  const { i18n } = useTranslation();const ka = i18n.language.startsWith('ka');const copy = useCompetitionCopy();
  if (error) return <div className="tc-facts-error" role="alert"><p>{error}</p><button type="button" onClick={retry}>{ka ? 'წესების ხელახლა ჩატვირთვა' : 'Reload competition details'}</button></div>;
  if (!rules) return <p className="tc-profile-note" role={loading ? 'status' : undefined}>{loading ? (ka ? 'შეჯიბრების დეტალები იტვირთება…' : 'Loading competition details…') : (ka ? 'ფორმატისა და მონაწილეობის პირობების სანახავად გაეცანით ორგანიზატორის წესებს.' : 'See the host’s published rules for this event’s format and eligibility.')}</p>;
  const facts = [
    { icon: GitFork, label: ka ? 'ფორმატი' : 'Format', value: copy(structureLabels[rules.structure]), detail: `${rules.matchMinutes} ${ka ? 'წუთი / მატჩი' : 'min / match'}` },
    { icon: UsersRound, label: ka ? 'მონაწილეობა' : 'Who can play', value: `${rules.ageGroup === 'SENIOR' ? (ka ? 'მოზრდილები' : 'Adults') : rules.ageGroup} · ${rules.sideSize}v${rules.sideSize}`, detail: rules.eligibilityCategory },
    { icon: MapPin, label: ka ? 'ადგილმდებარეობა' : 'Location', value: `${rules.city}, ${rules.country}`, detail: rules.timezone },
    { icon: Ticket, label: ka ? 'შესვლის საფასური' : 'Entry fee', value: rules.entryFee === 0 ? (ka ? 'უფასო მონაწილეობა' : 'Free entry') : `${new Intl.NumberFormat(i18n.language, { style:'currency', currency:rules.currency, maximumFractionDigits:2 }).format(rules.entryFee)}`, detail: rules.feeBasis === 'TEAM' ? (ka ? 'თითო გუნდზე' : 'Per team') : rules.feeBasis === 'PLAYER' ? (ka ? 'თითო მოთამაშეზე' : 'Per player') : (ka ? 'ღონისძიებაზე' : 'Per event') },
  ];
  return <div className="tc-event-facts">{facts.map(({ icon: Icon, label, value, detail })=><div key={label}><Icon size={18} aria-hidden="true"/><dl><dt>{label}</dt><dd><strong>{value}</strong><small>{detail}</small></dd></dl></div>)}</div>;
}
