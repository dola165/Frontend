import { Megaphone, Send } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '../../../design/primitives';
import { ArrangeMatchForm } from '../../matchExchange/arrange/ArrangeMatchForm';
import { StageHead } from '../stage/WorldStage';

const positive = (value: string | null) => { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : undefined; };

/**
 * Two separate ways to find a match, one short form each. Arranging invites a club you already
 * know (`?opponent=<clubId>` comes from a club's "Propose a match"); posting an open match lets
 * any squad propose (`?mode=open`). `?squad=<id>` starts from one of your squads.
 */
export default function ArrangeMatchPage() {
    const [params] = useSearchParams();
    const mode = params.get('mode') === 'open' ? 'open' : 'direct';
    const opponentId = mode === 'direct' ? positive(params.get('opponent')) : undefined;
    const squadId = positive(params.get('squad'));
    const other = new URLSearchParams();
    if (mode === 'direct') other.set('mode', 'open');
    if (squadId) other.set('squad', String(squadId));
    const switchTo = `/world/matches/arrange${other.size ? `?${other}` : ''}`;
    return (
        <div className="gk-world-directory gk-arrange-page">
            <StageHead>
                <header className="gk-world-head">
                    <div className="gk-world-head__titles">
                        <h1>{mode === 'direct' ? 'Arrange a match' : 'Post an open match'}</h1>
                        <p>{mode === 'direct' ? 'Nothing is agreed until they accept' : 'Squads propose, you choose'}</p>
                    </div>
                    <div className="gk-world-head__actions">
                        <ButtonLink variant="ghost" to="/world/matches">Back to matches</ButtonLink>
                        {mode === 'direct'
                            ? <ButtonLink to={switchTo}><Megaphone aria-hidden="true" />Post an open match</ButtonLink>
                            : <ButtonLink to={switchTo}><Send aria-hidden="true" />Invite a club instead</ButtonLink>}
                    </div>
                </header>
            </StageHead>
            <ArrangeMatchForm key={`${mode}:${opponentId ?? ''}:${squadId ?? ''}`} mode={mode} opponentId={opponentId} squadId={squadId} />
        </div>
    );
}
