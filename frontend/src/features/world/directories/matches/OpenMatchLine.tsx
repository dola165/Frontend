import { formats } from '../../../matchExchange/api';
import { useWorldCopy } from '../../copy';
import { useMapCounterpart } from '../../directory/selection';
import { codeLabel, fixtureTime } from '../../format';
import { useWorldRole } from '../../front/useWorldRole';
import { peekOf } from '../../peek/usePeek';
import { MatchLine } from '../../scoreboard/Scoreboard';
import { useClubCrests } from '../../scoreboard/useClubCrests';
import { HOSTING } from './matchBrowse';
import type { OpenMatch } from './openMatches';

/**
 * An open match as a score line: the host's crest and squad, and in the empty opponent's place my squad that suits it
 * (its crest faint in a dashed ring, "Your U14 Boys?") or "Opponent wanted"; the format and who hosts, "You play that
 * day" when my squad already does, "Referee wanted" for referees; the age group at the end.
 */
export function OpenMatchLine({ item: o }: { item: OpenMatch }) {
    const t = useWorldCopy();
    const crestOf = useClubCrests();
    const linked = useMapCounterpart();
    const role = useWorldRole();
    const { m, fit } = o;
    const away = fit
        ? { name: t('Your {squad}?', { squad: fit.name }), logo: crestOf(fit.clubId), ghost: true }
        : { name: t('Opponent wanted'), muted: true };
    const hosting = HOSTING[m.venue_preference];
    const facts = [t(formats[m.format] ?? codeLabel(m.format)), hosting && t(hosting)].filter(Boolean).join(' · ');
    const refereeWanted = role === 'referee' && m.referee_required && m.referee_status === 'NEEDED';
    const tag = <>
        {o.busy ? <span data-tone="warning">{t('You play that day')}</span> : refereeWanted ? <span data-tone="warning">{t('Referee wanted')}</span> : facts}
    </>;
    return (
        <MatchLine to={`/match-exchange/${m.event_id}`} peek={peekOf('match', o.code)} linked={linked} title={[m.title, m.location_name].filter(Boolean).join(' · ')}
            time={fixtureTime(m.starts_at_iso, m.timezone)} home={{ name: `${m.club_name} ${m.squad_name}`, logo: m.club_logo_url }} away={away} tag={tag}
            aside={<span className="gk-sb__age">{codeLabel(m.age_group)}</span>} />
    );
}
