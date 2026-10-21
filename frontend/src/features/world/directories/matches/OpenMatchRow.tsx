import { Status } from '../../../../design/DataTable';
import { formats } from '../../../matchExchange/api';
import { useWorldCopy } from '../../copy';
import { MatchRow } from '../../directory/MatchRow';
import { codeLabel, fixtureDay, fixtureTime } from '../../format';
import { useWorldRole } from '../../front/useWorldRole';
import { peekOf } from '../../peek/usePeek';
import { useClubCrests } from '../../scoreboard/useClubCrests';
import { HOSTING } from './matchBrowse';
import type { OpenMatch } from './openMatches';

/**
 * An open match as a row: the host's crest and squad, and in the empty opponent's place my squad that suits it (its
 * crest faint in a dashed ring, "Your U14 Boys?") or "Opponent wanted"; when and where, then the format and who hosts,
 * "You play that day" when my squad already does, "Referee wanted" for referees; the age group at the end.
 */
export function OpenMatchRow({ item: o }: { item: OpenMatch }) {
    const t = useWorldCopy();
    const crestOf = useClubCrests();
    const role = useWorldRole();
    const { m, fit } = o;
    const away = fit
        ? { name: t('Your {squad}?', { squad: fit.name }), logo: crestOf(fit.clubId), ghost: true }
        : { name: t('Opponent wanted'), muted: true };
    const hosting = HOSTING[m.venue_preference];
    const facts = [t(formats[m.format] ?? codeLabel(m.format)), hosting && t(hosting)].filter(Boolean).join(' · ');
    const refereeWanted = role === 'referee' && m.referee_required && m.referee_status === 'NEEDED';
    return (
        <MatchRow to={`/match-exchange/${m.event_id}`} peek={peekOf('match', o.code)} title={[m.title, m.location_name].filter(Boolean).join(' · ')}
            home={{ name: `${m.club_name} ${m.squad_name}`, logo: m.club_logo_url }} away={away}
            lines={[
                [fixtureTime(m.starts_at_iso, m.timezone), fixtureDay(m.starts_at_iso, m.timezone), m.location_name?.split(',')[0]].filter(Boolean).join(' · '),
                o.busy ? <Status tone="warning">{t('You play that day')}</Status> : refereeWanted ? <Status tone="warning">{t('Referee wanted')}</Status> : facts,
            ]}
            aside={<span className="gk-result-code">{codeLabel(m.age_group)}</span>} />
    );
}
