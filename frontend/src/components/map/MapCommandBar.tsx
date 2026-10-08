import { ArrowLeft, ArrowUpRight, Building2, Crosshair, Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
interface Suggestion { id: string; label: string; meta: string }
export function MapCommandBar<T extends Suggestion>({ search, onSearch, onSubmit, onClear, suggestions, onSuggestion,
    filtersOpen, onFilters, resultsOpen, onResults, count, loading, onBack, external, filterOffset, chips }: {
    search: string; onSearch: (value: string) => void; onSubmit: () => void; onClear: () => void;
    suggestions: T[]; onSuggestion: (suggestion: T) => void; filtersOpen: boolean; onFilters: () => void;
    resultsOpen: boolean; onResults: () => void; count: number; loading: boolean; onBack?: () => void;
    external: boolean; filterOffset: boolean; chips: string[];
}) {
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    return <div className={`atlas-command ${filterOffset ? 'atlas-command--offset' : ''} ${external ? 'atlas-command--external' : ''}`}>
        <div className="atlas-command-bar">
            {onBack && <button onClick={onBack} aria-label="Back" className="atlas-command-icon"><ArrowLeft size={18} /></button>}
            {!external && <form onSubmit={e => { e.preventDefault(); setSuggestionsOpen(false); onSubmit(); }} className="atlas-command-search">
                <Search size={18} /><input aria-label="Search map" placeholder="Search clubs, stadiums, streets…" value={search} maxLength={100} onFocus={() => setSuggestionsOpen(true)} onKeyDown={e => { if (e.key === 'Escape') setSuggestionsOpen(false); }} onChange={e => { onSearch(e.target.value); setSuggestionsOpen(true); }} />
                {search && <button type="button" onClick={onClear} aria-label="Clear map search"><X size={15} /></button>}
                <button type="submit" aria-label="Search places" className="atlas-search-submit"><ArrowUpRight size={18} /></button>
            </form>}
            {!external && <button aria-label="Toggle filters" aria-expanded={filtersOpen} className={`atlas-filter-toggle ${filtersOpen ? 'is-active' : ''}`} onClick={onFilters}><SlidersHorizontal size={17} /><span>Filters</span>{chips.length > 0 && <b>{chips.length}</b>}</button>}
            <button aria-label="Toggle nearby results" aria-expanded={resultsOpen} className={`atlas-browse-toggle ${resultsOpen ? 'is-active' : ''}`} onClick={onResults}><Building2 size={17} /><span>Browse results</span><b>{loading ? '…' : count}</b></button>
        </div>
        {suggestionsOpen && suggestions.length > 0 && search && <div className="atlas-command-suggestions">{suggestions.map(suggestion => <button key={suggestion.id} onClick={() => { onSuggestion(suggestion); setSuggestionsOpen(false); }}><Crosshair size={17} /><span><strong>{suggestion.label}</strong><small>{suggestion.meta}</small></span><ArrowUpRight size={16} /></button>)}</div>}
        {chips.length > 0 && <div className="atlas-active-filters" aria-label="Applied filters">{chips.map((chip, i) => <span key={i}>{chip}</span>)}</div>}
    </div>;
}
