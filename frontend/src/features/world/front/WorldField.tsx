import { useId, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Skeleton } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { ErrorNote } from '../directory/DirectoryResults';
import { fieldInfo, type FieldId } from './fields';

/** Crests or faces overlapping: the picture of a field about clubs or people. */
export const Cluster = ({ children }: { children: ReactNode }) => <span className="gk-wfield__cluster">{children}</span>;

/**
 * One field of World's front page, open: a picture (a football photo, or crests and faces), what it is, a
 * count and the next thing in one line, then the list, and the way to the full directory at the end.
 * Beside the map (`side`) it fills the map's height and scrolls inside.
 */
export function WorldField({ id, side, hint, count, thumb, loading, error, onRetry, all, children }: {
    id: FieldId; side?: boolean; hint?: ReactNode; count?: number | null; thumb?: ReactNode;
    loading?: boolean; error?: string; onRetry?: () => void; all?: { label: string; to: string }; children?: ReactNode;
}) {
    const t = useWorldCopy();
    const heading = useId();
    const info = fieldInfo(id);
    const Icon = info.icon;
    return (
        <section className="gk-wfield" data-side={side || undefined} data-shape={info.shape} id={`world-${id}`} aria-labelledby={heading} aria-busy={loading || undefined}>
            <header className="gk-wfield__head">
                <span className="gk-wfield__thumb" style={info.color ? { '--gk-wfield-color': info.color } as CSSProperties : undefined}>
                    {info.photo && !thumb ? <img src={info.photo} alt="" loading="lazy" /> : thumb}
                    <span className="gk-wfield__icon"><Icon aria-hidden="true" /></span>
                </span>
                <span className="gk-wfield__titles">
                    <h2 id={heading}>{t(info.title)}</h2>
                    {loading ? <Skeleton height={12} width="60%" /> : hint && <small>{hint}</small>}
                </span>
                {count != null && !loading && <span className="gk-wfield__count">{count}</span>}
            </header>
            <div className="gk-wfield__body">
                {error ? <ErrorNote message={error} onRetry={onRetry ?? (() => {})} />
                    : loading ? <div className="gk-wfield__loading" role="status" aria-label={t('Loading')}>{[0, 1, 2].map(i => <Skeleton key={i} height={44} />)}</div>
                    : children}
            </div>
            {all && <Link className="gk-wfield__all" to={all.to}>{all.label}<ArrowRight aria-hidden="true" /></Link>}
        </section>
    );
}
