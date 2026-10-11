import { useId, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, type LucideIcon } from 'lucide-react';
import { Skeleton } from '../../../design/primitives';
import { ErrorNote } from '../directory/DirectoryResults';

/**
 * One thing World has for you, folded to a picture, a count and the next item: it says the thing exists
 * without listing it. Opening it shows the list in place, with the way to the full directory at the end.
 */
export function WorldTile({ id, title, summary, count, photo, thumb, icon: Icon, color, preview, open, onToggle, loading, error, onRetry, all, children }: {
    id: string; title: string; summary?: ReactNode; count?: number | null;
    /** A football photo for the thumbnail, or `thumb` for crests or faces instead. */ photo?: string; thumb?: ReactNode;
    icon: LucideIcon; /** The activity colour of the symbol. */ color?: string;
    /** A few crests or faces from inside, beside the count. */ preview?: ReactNode;
    open: boolean; onToggle: () => void; loading?: boolean; error?: string; onRetry?: () => void;
    all?: { label: string; to: string }; children?: ReactNode;
}) {
    const body = useId();
    return (
        <section className="gk-wtile" data-open={open || undefined} id={`world-${id}`} aria-busy={loading || undefined}>
            <button type="button" className="gk-wtile__head" aria-expanded={open} aria-controls={body} onClick={onToggle}>
                <span className="gk-wtile__thumb" style={color ? { '--gk-wtile-color': color } as CSSProperties : undefined}>
                    {photo ? <img src={photo} alt="" loading="lazy" /> : thumb}
                    <span className="gk-wtile__icon"><Icon aria-hidden="true" /></span>
                </span>
                <span className="gk-wtile__text">
                    <strong>{title}</strong>
                    {loading ? <Skeleton height={12} width="70%" /> : summary && <small>{summary}</small>}
                </span>
                {preview && !loading && <span className="gk-wtile__preview" aria-hidden="true">{preview}</span>}
                {count != null && !loading && <span className="gk-wtile__count">{count}</span>}
                <ChevronDown className="gk-wtile__chevron" aria-hidden="true" />
            </button>
            {open && <div id={body} className="gk-wtile__body">
                {error ? <ErrorNote message={error} onRetry={onRetry ?? (() => {})} /> : children}
                {all && <Link className="gk-wtile__all" to={all.to}>{all.label}<ArrowRight aria-hidden="true" /></Link>}
            </div>}
        </section>
    );
}
