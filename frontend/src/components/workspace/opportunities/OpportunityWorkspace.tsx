import { useRef, type ReactNode } from 'react';
import { ChevronRight, ImagePlus, MoreHorizontal, Search } from 'lucide-react';
import { MediaImage } from '../../ui/MediaImage';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import './opportunities.css';

export function OpportunityHeader({title, description, icon, action, link}: {title: string; description: string; icon: ReactNode; action: ReactNode; link?: ReactNode}) {
    return <header className="op-page-heading"><div><div className="op-breadcrumb">Workspace <ChevronRight size={12}/> Opportunities</div><h2><span className="op-feature-icon">{icon}</span>{title}</h2><p>{description}</p></div><div className="op-heading-actions">{link}{action}</div></header>;
}
export function OpportunityToolbar({query, onQueryChange, label, filters, filter, onFilterChange, children, count}: {
    query: string; onQueryChange: (value: string) => void; label: string;
    filters: {value: string; label: string; count: number}[]; filter: string; onFilterChange: (value: string) => void; children?: ReactNode; count: string;
}) {
    return <div className="op-list-toolbar"><div className="op-filter-tabs" aria-label={`${label} status filters`}>{filters.map(item => <button key={item.value} aria-pressed={filter === item.value} onClick={() => onFilterChange(item.value)} className={filter === item.value ? 'active' : ''}>{item.label}<span>{item.count}</span></button>)}</div><div className="op-search-row"><label className="op-search"><Search size={17}/><input aria-label={label} placeholder={label} value={query} onChange={event => onQueryChange(event.target.value)}/></label>{children}<span className="op-result-count">{count}</span></div></div>;
}
export function OpportunityBadge({status}: {status: string}) {
    return <span className="op-badge" data-status={status}><i/>{status}</span>;
}
export function OpportunityImage({images, name}: {images?: string[] | null; name: string}) {
    return images?.[0] ? <MediaImage className="op-product-art" src={resolveMediaUrl(images[0])} alt={name}/> : <div className="op-product-art op-art-empty" role="img" aria-label={`No photo for ${name}`}><ImagePlus size={22}/></div>;
}
export function OpportunityMenu({name, disabled, children}: {name: string; disabled?: boolean; children: ReactNode}) {
    const ref = useRef<HTMLDetailsElement>(null);
    return <details className="op-more" ref={ref} onKeyDown={event => {if (event.key === 'Escape' && ref.current) {event.stopPropagation(); ref.current.open = false; ref.current.querySelector('summary')?.focus();}}}>
        <summary aria-label={`More actions for ${name}`} aria-disabled={disabled} onClick={event => {if (disabled) event.preventDefault();}}><MoreHorizontal size={19}/></summary>
        <div className="op-more-menu" onClick={event => {if ((event.target as HTMLElement).closest('button') && ref.current) ref.current.open = false;}}>{children}</div>
    </details>;
}
