import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import type { AgentPortfolioPlayer } from '../agents/domain';
import './professional-career.css';

export function AgentCareer({ id, own }: { id: number; own: boolean }) {
    const [players, setPlayers] = useState<AgentPortfolioPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [unavailable, setUnavailable] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        void apiClient.get<AgentPortfolioPlayer[]>(`/agents/${id}/portfolio`, { signal: controller.signal }).then(response => {
            if (!controller.signal.aborted) { setPlayers(response.data); setError(false); }
        }).catch((reason: { response?: { data?: { code?: string } } }) => {
            if (!controller.signal.aborted) {
                if (reason.response?.data?.code === 'FEATURE_UNAVAILABLE') setUnavailable(true);
                else setError(true);
            }
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [id, attempt]);
    if (unavailable) return null;
    return <section className="career-card" aria-label="Player representation">
        <div className="career-section-heading"><Users size={20} /><div><h2>Player representation</h2><p>Active representations with public player profiles.</p></div></div>
        {loading ? <p role="status">Loading representation…</p> : error ? <p role="alert">Player representation could not load. <button className="career-button" onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Retry</button></p> : !players.length ? <p className="career-meta">No public player representations to show.</p> : players.map(player => <article key={player.playerUserId} className="career-appointment">
            <div className="career-club-identity"><span className="career-club-logo">{player.avatarUrl ? <MediaImage src={resolveMediaUrl(player.avatarUrl)} alt="" /> : <Users size={20} />}</span><div><h3><Link to={`/profile/${player.playerUserId}`}>{player.fullName || player.username || 'Player'}</Link></h3><p className="career-meta">{[player.position?.replaceAll('_', ' '), player.currentClubName].filter(Boolean).join(' · ')}</p></div></div>
        </article>)}
        {own && <p className="career-meta">Only active representations and publicly visible adult players appear here. Private portfolio details stay in your agent workspace.</p>}
    </section>;
}
