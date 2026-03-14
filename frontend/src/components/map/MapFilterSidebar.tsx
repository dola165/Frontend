import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, X, SlidersHorizontal, Search } from 'lucide-react';

// --- STATIC DATA LISTS ---
// You can replace these later with an npm package like 'country-state-city' if needed!
const COUNTRIES = ['Georgia', 'Turkey', 'Armenia', 'Azerbaijan', 'Ukraine', 'Germany', 'Spain', 'France', 'Italy', 'United Kingdom', 'Netherlands', 'Portugal'];
const CITIES = ['Tbilisi', 'Batumi', 'Kutaisi', 'Rustavi', 'Gori', 'Zugdidi', 'Poti', 'Istanbul', 'Ankara', 'Yerevan', 'Baku'];
const AGE_GROUPS = ['U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U21', 'Senior'];

interface MapFilterSidebarProps {
    isVisible: boolean;
    onClose: () => void;
    onFiltersChange: (filters: Record<string, any>) => void;
}

export const MapFilterSidebar = ({ isVisible, onClose, onFiltersChange }: MapFilterSidebarProps) => {
    // Top Level State
    const [entityType, setEntityType] = useState<'CLUB' | 'TRYOUT' | 'FRIENDLY' | 'MATCH'>('CLUB');
    const [distanceKm, setDistanceKm] = useState<number>(15);

    // Arrays for multi-select
    const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
    const [selectedAges, setSelectedAges] = useState<string[]>([]);
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

    // Local Search States for the new dropdowns
    const [countrySearch, setCountrySearch] = useState('');
    const [citySearch, setCitySearch] = useState('');

    // Expand/Collapse state for UI cards
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        entityType: true,
        distance: true,
        location: true,
        squadInfo: true
    });

    const toggleExpand = (section: string) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

    const handleMultiSelect = (val: string, current: string[], setter: (val: string[]) => void) => {
        if (current.includes(val)) setter(current.filter(item => item !== val));
        else setter([...current, val]);
    };

    // Fire updates to the parent MapPage
    useEffect(() => {
        onFiltersChange({
            entityType,
            distance: distanceKm,
            gender: selectedGenders,
            ageGroups: selectedAges,
            cities: selectedCities,
            countries: selectedCountries
        });
    }, [entityType, distanceKm, selectedGenders, selectedAges, selectedCities, selectedCountries]);

    const resetFilters = () => {
        setEntityType('CLUB');
        setDistanceKm(15);
        setSelectedGenders([]);
        setSelectedAges([]);
        setSelectedCities([]);
        setSelectedCountries([]);
        setCountrySearch('');
        setCitySearch('');
    };

    const showSquadFilters = ['TRYOUT', 'FRIENDLY', 'MATCH'].includes(entityType);
    const activeCount = 1 + (distanceKm !== 15 ? 1 : 0) + selectedGenders.length + selectedAges.length + selectedCities.length + selectedCountries.length;

    // Filtered lists based on search input
    const filteredCountries = COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()));
    const filteredCities = CITIES.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()));

    if (!isVisible) return null;

    return (
        <div className="w-[320px] lg:w-[380px] h-full bg-[#fdfaf5] dark:bg-[#0a0f13] border-r-2 border-slate-300 dark:border-black flex flex-col shrink-0 z-10 transition-all duration-300">

            {/* Header */}
            <div className="bg-white dark:bg-[#151f28] border-b-2 border-slate-300 dark:border-black p-5 flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-600 rounded-xl border border-emerald-300 dark:border-emerald-500 shadow-sm">
                        <SlidersHorizontal className="w-5 h-5 text-emerald-700 dark:text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Parameters</h2>
                        <p className="text-xs text-emerald-600 dark:text-emerald-500 font-bold mt-0.5">
                            {activeCount} active filter{activeCount !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all xl:hidden">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {activeCount > 1 && (
                <div className="px-5 pt-4 shrink-0">
                    <button onClick={resetFilters} className="w-full px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-500 rounded-lg text-xs font-black uppercase tracking-wider transition-all border border-rose-200 dark:border-rose-500/30 shadow-sm">
                        Reset All Parameters
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">

                {/* 1. ENTITY TYPE CARD */}
                <div className="bg-white dark:bg-[#151f28] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <button onClick={() => toggleExpand('entityType')} className="w-full flex items-center justify-between text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">Target Intel</span>
                        {expanded.entityType ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    {expanded.entityType && (
                        <div className="px-4 pb-4 space-y-1.5 border-t border-slate-100 dark:border-slate-800/50 pt-3">
                            {['CLUB', 'TRYOUT', 'FRIENDLY', 'MATCH'].map(type => (
                                <label key={type} className="flex items-center gap-3 py-2 cursor-pointer group">
                                    <input
                                        type="radio" name="entityType" checked={entityType === type}
                                        onChange={() => {
                                            setEntityType(type as any);
                                            if (type === 'CLUB') { setSelectedGenders([]); setSelectedAges([]); }
                                        }}
                                        className="w-4 h-4 text-emerald-500 bg-slate-100 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className={`text-sm font-bold transition-colors ${entityType === type ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-300'}`}>
                                        {type === 'CLUB' ? 'Clubs / HQs' : type === 'MATCH' ? 'Competitive Matches' : type === 'FRIENDLY' ? 'Friendlies' : 'Tryouts / Trials'}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. DISTANCE RANGE CARD */}
                <div className="bg-white dark:bg-[#151f28] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <button onClick={() => toggleExpand('distance')} className="w-full flex items-center justify-between text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">Scan Radius</span>
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
                                type="range" min="1" max="100"
                                value={distanceKm} onChange={(e) => setDistanceKm(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>
                    )}
                </div>

                {/* 3. SEARCHABLE LOCATION CARD */}
                <div className="bg-white dark:bg-[#151f28] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <button onClick={() => toggleExpand('location')} className="w-full flex items-center justify-between text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">Location Parameters</span>
                        {expanded.location ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    {expanded.location && (
                        <div className="px-4 pb-4 space-y-5 border-t border-slate-100 dark:border-slate-800/50 pt-4">

                            {/* Country Searchable List */}
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Countries</span>
                                <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 mb-2">
                                    <Search className="w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="text" placeholder="Search countries..."
                                        value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
                                        className="bg-transparent border-none outline-none text-xs font-medium text-slate-900 dark:text-white ml-2 w-full placeholder:text-slate-400"
                                    />
                                </div>
                                <div className="max-h-40 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                                    {filteredCountries.map(country => (
                                        <label key={country} className="flex items-center justify-between py-1.5 cursor-pointer group">
                                            <span className={`text-sm font-bold transition-colors ${selectedCountries.includes(country) ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`}>
                                                {country}
                                            </span>
                                            <input
                                                type="checkbox" checked={selectedCountries.includes(country)}
                                                onChange={() => handleMultiSelect(country, selectedCountries, setSelectedCountries)}
                                                className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 checked:bg-emerald-500 checked:border-emerald-500 appearance-none cursor-pointer relative checked:before:content-['✓'] checked:before:absolute checked:before:text-white checked:before:text-xs checked:before:left-[2px] checked:before:-top-[1px]"
                                            />
                                        </label>
                                    ))}
                                    {filteredCountries.length === 0 && <p className="text-xs text-slate-500 italic py-2">No countries found.</p>}
                                </div>
                            </div>

                            {/* City Searchable List */}
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Cities</span>
                                <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 mb-2">
                                    <Search className="w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="text" placeholder="Search cities..."
                                        value={citySearch} onChange={e => setCitySearch(e.target.value)}
                                        className="bg-transparent border-none outline-none text-xs font-medium text-slate-900 dark:text-white ml-2 w-full placeholder:text-slate-400"
                                    />
                                </div>
                                <div className="max-h-40 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                                    {filteredCities.map(city => (
                                        <label key={city} className="flex items-center justify-between py-1.5 cursor-pointer group">
                                            <span className={`text-sm font-bold transition-colors ${selectedCities.includes(city) ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`}>
                                                {city}
                                            </span>
                                            <input
                                                type="checkbox" checked={selectedCities.includes(city)}
                                                onChange={() => handleMultiSelect(city, selectedCities, setSelectedCities)}
                                                className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 checked:bg-blue-500 checked:border-blue-500 appearance-none cursor-pointer relative checked:before:content-['✓'] checked:before:absolute checked:before:text-white checked:before:text-xs checked:before:left-[2px] checked:before:-top-[1px]"
                                            />
                                        </label>
                                    ))}
                                    {filteredCities.length === 0 && <p className="text-xs text-slate-500 italic py-2">No cities found.</p>}
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {/* 4. CONDITIONAL: SQUAD INFO CARD */}
                {showSquadFilters && (
                    <div className="bg-white dark:bg-[#151f28] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
                        <button onClick={() => toggleExpand('squadInfo')} className="w-full flex items-center justify-between text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">Squad Specs</span>
                            {expanded.squadInfo ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </button>
                        {expanded.squadInfo && (
                            <div className="px-4 pb-5 space-y-5 border-t border-slate-100 dark:border-slate-800/50 pt-4">

                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Gender Division</span>
                                    <div className="flex gap-2">
                                        {['Boys', 'Girls'].map(gender => (
                                            <button key={gender} onClick={() => handleMultiSelect(gender.toUpperCase(), selectedGenders, setSelectedGenders)}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border-2 ${selectedGenders.includes(gender.toUpperCase()) ? 'bg-orange-500 text-white border-orange-600 shadow-md' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-orange-500 hover:text-orange-500'}`}>
                                                {gender}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Age Classification</span>
                                    {/* 2-COLUMN GRID FOR AGES */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {AGE_GROUPS.map(age => (
                                            <button key={age} onClick={() => handleMultiSelect(age, selectedAges, setSelectedAges)}
                                                    className={`py-2 rounded-lg text-xs font-bold transition-all border-2 ${selectedAges.includes(age) ? 'bg-emerald-600 text-white border-emerald-700 shadow-md' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-500'}`}>
                                                {age}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};