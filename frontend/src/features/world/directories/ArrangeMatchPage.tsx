import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../design/primitives';
import { ListingEditor } from '../../matchExchange/ListingEditor';
import '../../matchExchange/match-exchange.css';

/**
 * Arranging a match is club work that starts from World › Matches. It hosts the existing
 * arrangement form unchanged; the form opens the new match when it is sent.
 */
export default function ArrangeMatchPage() {
    const navigate = useNavigate();
    return (
        <div className="gk-world-directory">
            <PageHeader title="Arrange a match" crumbs={[{ label: 'Matches', to: '/world/matches' }, { label: 'Arrange a match' }]}
                subtitle="Publish a date your squad needs an opponent for. Other squads propose and you choose. To play a club you already know, challenge it from its profile." />
            <div className="gk-world-legacy mx-page"><ListingEditor onClose={() => navigate('/world/matches?tab=mine')} /></div>
        </div>
    );
}
