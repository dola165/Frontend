import type { ReactNode } from 'react';
import { Button, GkRoot } from '../../../../design/primitives';
import { useWorldCopy } from '../../copy';
import { TournamentAction } from './TournamentAction';
import { tournamentChanged, type TournamentPaneData } from './tournamentPane';
import { useTournamentGate, useTournamentPane } from './useTournamentGate';

function Entry({ data, reload, otherwise }: { data: TournamentPaneData; reload: () => void; otherwise: ReactNode }) {
    const entry = useTournamentGate(data);
    if (entry.gate.kind === 'none' && entry.player.status !== 'error') return <>{otherwise}</>;
    return <TournamentAction data={data} reload={reload} entry={entry} />;
}

/**
 * Entering a tournament on its full page: the same decision (`entryGate`) and the same steps as World's pane, so an
 * invitation opened from the pane is still that invitation here, with its squad, fee and deadline. `otherwise` is
 * what the page says when there is nothing to do (the club a person needs, a tournament no longer taking entries).
 */
export function TournamentEntry({ tournamentId, onChanged, otherwise }: { tournamentId: number; /** After a step changed the tournament. */ onChanged: () => void; otherwise: ReactNode }) {
    const t = useWorldCopy();
    const pane = useTournamentPane(tournamentId);
    const reload = () => { tournamentChanged(tournamentId); pane.retry(); onChanged(); };
    return (
        <GkRoot className="gk-tentry">
            {pane.data ? <Entry data={pane.data} reload={reload} otherwise={otherwise} />
                : pane.loading ? <p className="gk-step-line" data-tone="quiet" role="status"><span>{t('Loading…')}</span></p>
                : <p className="gk-step-line" role="alert"><span>{pane.error}</span><Button size="sm" onClick={pane.retry}>{t('Try again')}</Button></p>}
        </GkRoot>
    );
}
