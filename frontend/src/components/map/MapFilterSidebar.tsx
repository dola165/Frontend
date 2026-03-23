import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, X, SlidersHorizontal } from 'lucide-react';

const AGE_GROUPS = ['U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U21', 'Senior'];

export type MapEntityType = 'CLUB' | 'TRYOUT' | 'FRIENDLY' | 'MATCH';

export interface MapFilters {
    entityType: MapEntityType;
    distance: number;
    ageGroups: string[];
}

interface MapFilterSidebarProps {
    isVisible: boolean;
    onClose: () => void;
    onFiltersChange: (filters: MapFilters) => void;
}

export const MapFilterSidebar = ({ isVisible, onClose, onFiltersChange }: MapFilterSidebarProps) => {
    const [entityType, setEntityType] = useState<MapEntityType>('CLUB');
    const [distanceKm, setDistanceKm] = useState<number>(15);
    const [selectedAges, setSelectedAges] = useState<string[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        entityType: true,
        distance: true,
        tryoutSpecs: true,
    });

    useEffect(() => {
        onFiltersChange({
            entityType,
            distance: distanceKm,
            ageGroups: selectedAges,
        });
    }, [distanceKm, entityType, onFiltersChange, selectedAges]);

    const toggleExpand = (section: string) => setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));

    const toggleAge = (age: string) => {
        setSelectedAges((current) =>
            current.includes(age) ? current.filter((value) => value !== age) : [...current, age]
        );
    };

    const resetFilters = () => {
        setEntityType('CLUB');
        setDistanceKm(15);
        setSelectedAges([]);
    };

    const showTryoutFilters = entityType === 'TRYOUT';
    const activeCount = (entityType !== 'CLUB' ? 1 : 0) + (distanceKm !== 15 ? 1 : 0) + selectedAges.length;

    if (!isVisible) return null;

    return (
        <aside className="theme-page w-[300px] lg:w-[340px] xl:w-[360px] h-full border-r-2 theme-border-strong flex flex-col shrink-0 z-10">
            <div className="theme-surface border-b-2 theme-border-strong p-5 flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-600 rounded-xl border border-emerald-300 dark:border-emerald-500 shadow-sm">
                        <SlidersHorizontal className="w-5 h-5 text-emerald-700 dark:text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Map Filters</h2>
                        <p className="text-xs text-emerald-600 dark:text-emerald-500 font-bold mt-0.5">
                            {activeCount === 0 ? 'Showing default discovery view' : `${activeCount} active filter${activeCount !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all xl:hidden">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {activeCount > 0 && (
                <div className="px-5 pt-4 shrink-0">
                    <button
                        onClick={resetFilters}
                        className="w-full px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-500 rounded-lg text-xs font-black uppercase tracking-wider transition-all border border-rose-200 dark:border-rose-500/30 shadow-sm"
                    >
                        Reset Active Filters
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="theme-surface rounded-xl border theme-border shadow-sm overflow-hidden">
                    <button onClick={() => toggleExpand('entityType')} className="w-full flex items-center justify-between text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">Entity Type</span>
                        {expanded.entityType ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    {expanded.entityType && (
                        <div className="px-4 pb-4 space-y-1.5 border-t border-slate-100 dark:border-slate-800/50 pt-3">
                            {[
                                { type: 'CLUB', label: 'Clubs / HQs' },
                                { type: 'TRYOUT', label: 'Tryouts / Trials' },
                                { type: 'FRIENDLY', label: 'Friendlies' },
                                { type: 'MATCH', label: 'Competitive Matches' },
                            ].map((option) => (
                                <label key={option.type} className="flex items-center gap-3 py-2 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="entityType"
                                        checked={entityType === option.type}
                                        onChange={() => {
                                            setEntityType(option.type as MapEntityType);
                                            if (option.type !== 'TRYOUT') {
                                                setSelectedAges([]);
                                            }
                                        }}
                                        className="w-4 h-4 text-emerald-500 bg-slate-100 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className={`text-sm font-bold transition-colors ${entityType === option.type ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-300'}`}>
                                        {option.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="theme-surface rounded-xl border theme-border shadow-sm overflow-hidden">
                    <button onClick={() => toggleExpand('distance')} className="w-full flex items-center justify-between text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">Radius</span>
                        {expanded.distance ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    {expanded.distance && (
                        <div className="px-4 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                            <div className="flex items-center justify-between text-xs mb-3">
                                <span className="text-slate-500 font-bold">1 km</span>
                                <span className="text-emerald-600 dark:text-emerald-500 font-black text-sm bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full">{distanceKm} km</span>
                                <span className="text-slate-500 font-bold">100 km</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={distanceKm}
                                onChange={(e) => setDistanceKm(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>
                    )}
                </div>

                {showTryoutFilters && (
                    <div className="theme-surface rounded-xl border theme-border shadow-sm overflow-hidden">
                        <button onClick={() => toggleExpand('tryoutSpecs')} className="w-full flex items-center justify-between text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">Tryout Ages</span>
                            {expanded.tryoutSpecs ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </button>
                        {expanded.tryoutSpecs && (
                            <div className="px-4 pb-5 space-y-5 border-t border-slate-100 dark:border-slate-800/50 pt-4">
                                <div className="grid grid-cols-2 gap-2">
                                    {AGE_GROUPS.map((age) => (
                                        <button
                                            key={age}
                                            onClick={() => toggleAge(age)}
                                            className={`py-2 rounded-lg text-xs font-bold transition-all border-2 ${selectedAges.includes(age) ? 'bg-emerald-600 text-white border-emerald-700 shadow-md' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-500'}`}
                                        >
                                            {age}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="theme-surface rounded-xl border theme-border px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Search Behavior</p>
                    <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                        Search matches entity names and saved location text inside the current radius.
                    </p>
                </div>
            </div>
        </aside>
    );
};
