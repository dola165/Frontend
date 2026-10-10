import { Megaphone, Send } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink, PageHeader } from '../../../design/primitives';
import { ArrangeMatchForm } from '../../matchExchange/arrange/ArrangeMatchForm';

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
            <PageHeader
                title={mode === 'direct' ? 'Arrange a match' : 'Post an open match'}
                crumbs={[{ label: 'Matches', to: '/world/matches' }, { label: mode === 'direct' ? 'Arrange a match' : 'Post an open match' }]}
                subtitle={mode === 'direct'
                    ? 'Invite a club you want to play. Nothing is agreed until they accept.'
                    : 'Publish a date and let squads propose. You choose the opponent.'}
                actions={mode === 'direct'
                    ? <ButtonLink to={switchTo}><Megaphone aria-hidden="true" />Post an open match</ButtonLink>
                    : <ButtonLink to={switchTo}><Send aria-hidden="true" />Invite a club instead</ButtonLink>} />
            <ArrangeMatchForm key={`${mode}:${opponentId ?? ''}:${squadId ?? ''}`} mode={mode} opponentId={opponentId} squadId={squadId} />
        </div>
    );
}
