import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Search, Shield, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../api/axiosConfig';
import { squadLabel } from '../../squads/squadLabels';
import '../../squads/squad-design.css';
import '../../squads/squad-public.css';

interface SquadDto {
    id: number;
    clubId: number;
    name: string;
    category: string;
    gender: string;
}

export const TabTeams = ({ clubId, refreshKey = 0 }: { clubId: number; refreshKey?: number }) => {
    const { t } = useTranslation();
    const [result, setResult] = useState<{ scope: string; squads: SquadDto[]; failed: boolean } | null>(null);
    const [search, setSearch] = useState('');
    const [retry, setRetry] = useState(0);
    const scope = `${clubId}:${refreshKey}:${retry}`;
    const loading = result?.scope !== scope;
    const failed = !loading && result?.failed;
    const squads = useMemo(() => (result?.scope === scope ? result.squads : []), [result, scope]);
    useEffect(() => {
        let cancelled = false;
        apiClient
            .get(`/clubs/${clubId}/squads`)
            .then((response) => {
                if (!cancelled) setResult({ scope, squads: response.data || [], failed: false });
            })
            .catch(() => {
                if (!cancelled) {
                    setResult({ scope, squads: [], failed: true });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [clubId, scope]);
    const filtered = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return squads.filter((squad) =>
            `${squad.name} ${squadLabel(squad.category, t)} ${squadLabel(squad.gender, t)}`
                .toLocaleLowerCase()
                .includes(query),
        );
    }, [squads, search, t]);
    return (
        <section className="squad-design squad-design-public sp-directory">
            <header className="sp-directory-heading">
                <div>
                    <p className="sd-eyebrow">{t('squadDesign.public.ourTeams', { defaultValue: 'Our teams' })}</p>
                    <h2 className="sp-title">
                        {t('squadDesign.public.squads', { defaultValue: 'Squads' })}
                        <span className="sp-dot">.</span>
                    </h2>
                    <p className="sd-muted">
                        {t('squadDesign.public.directoryDescription', {
                            defaultValue: 'Find your team. Meet the players behind it.',
                        })}
                    </p>
                </div>
                {!loading && !failed && (
                    <span className="sp-directory-count">
                        <Users size={15} />
                        {t('squadDesign.public.squadCount', { defaultValue: '{{count}} squads', count: squads.length })}
                    </span>
                )}
            </header>
            {squads.length > 4 && (
                <label className="sd-search sp-directory-search">
                    <Search size={16} />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('squadDesign.public.searchSquads', { defaultValue: 'Find a squad' })}
                        aria-label={t('squadDesign.public.searchSquads', { defaultValue: 'Find a squad' })}
                    />
                </label>
            )}
            {loading ? (
                <div className="sd-empty" role="status">
                    <Loader2 size={24} className="animate-spin" />
                    <span>{t('squadDesign.public.loading', { defaultValue: 'Loading squads…' })}</span>
                </div>
            ) : failed ? (
                <div className="sd-empty" role="alert">
                    <p>{t('squadDesign.public.loadFailed', { defaultValue: 'Could not load the squads.' })}</p>
                    <button type="button" className="sd-button" onClick={() => setRetry((value) => value + 1)}>
                        {t('squadDesign.public.retry', { defaultValue: 'Try again' })}
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="sd-empty">
                    <Shield size={26} />
                    <h3>
                        {search
                            ? t('squadDesign.public.noMatches', { defaultValue: 'No matching squads' })
                            : t('squadDesign.public.noSquads', { defaultValue: 'The team starts here' })}
                    </h3>
                    <p>
                        {search
                            ? t('squadDesign.public.searchHint', { defaultValue: 'Try another name or age group.' })
                            : t('squadDesign.public.emptyDescription', {
                                  defaultValue: 'This club has not shared any squads yet.',
                              })}
                    </p>
                </div>
            ) : (
                <div className="sp-squad-cards">
                    {filtered.map((squad) => (
                        <Link to={`/clubs/${clubId}/squads?squad=${squad.id}`} className="sp-squad-card" key={squad.id}>
                            <div className="sp-squad-card-top">
                                <span className="sp-category-mark">{squadLabel(squad.category, t)}</span>
                                <Shield size={21} strokeWidth={1.5} />
                            </div>
                            <h3>{squad.name}</h3>
                            <p>{squadLabel(squad.gender, t)}</p>
                            <span className="sp-card-link">
                                {t('squadDesign.public.viewSquad', { defaultValue: 'View squad' })}
                                <ArrowRight size={16} />
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
};
