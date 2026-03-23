import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/axiosConfig';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Activity,
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    LayoutGrid,
    LayoutDashboard,
    List,
    MapPin,
    Maximize,
    Menu,
    Minimize,
    Plus,
    Sparkles,
    Swords,
    Trash2,
    Users,
    X
} from 'lucide-react';
import type { ScheduleItem, ScheduleItemKind } from '../types/schedule';
import { scheduleKindLabel, scheduleStatusLabel } from '../types/schedule';

type ModalMode = 'add' | 'view';

interface EventFormData {
    title: string;
    type: Exclude<ScheduleItemKind, 'MATCH'>;
    location: string;
    targetLocationClubId?: number;
}

const MAP_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const adminRoles = new Set(['OWNER', 'CLUB_ADMIN']);

const soccerBallIcon = L.divIcon({
    className: "custom-pin bg-transparent border-0",
    html: `<img src="/markers/ball.png" class="w-8 h-8 drop-shadow-[0_4px_4px_rgba(0,0,0,0.4)]" alt="pin" />`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

const extractDayKey = (value: string) => value ? value.split('T')[0] : '';
const createDefaultDateTime = (dateStr: string) => `${dateStr}T18:00`;
const toDateTimeInputValue = (value: string) => value ? (value.includes('T') ? value.slice(0, 16) : `${value}T18:00`) : '';
const formatDisplayDate = (value: string) => {
    if (!value) return 'TBD';
    const normalized = value.includes('T') ? value : `${value}T12:00:00`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime())
        ? value
        : parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function MapCenterObserver({ onCenterChange }: { onCenterChange: (lat: number, lng: number) => void }) {
    const map = useMapEvents({
        moveend: () => {
            const center = map.getCenter();
            onCenterChange(center.lat, center.lng);
        }
    });
    return null;
}

function MapSizeFixer({ isExpanded }: { isExpanded: boolean }) {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => map.invalidateSize(), 250);
        return () => clearTimeout(timer);
    }, [map, isExpanded]);
    return null;
}

export const CalendarPage = () => {
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const [myClubRole, setMyClubRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
    const [events, setEvents] = useState<ScheduleItem[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const timelineRef = useRef<HTMLDivElement>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<ModalMode>('add');
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [formData, setFormData] = useState<EventFormData>({ title: '', type: 'TRYOUT', location: '' });

    const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
    const [isMapExpanded, setIsMapExpanded] = useState(false);
    const [pickerMarkers, setPickerMarkers] = useState<any[]>([]);
    const [mapCenter, setMapCenter] = useState({ lat: 41.7151, lng: 44.8271 });
    const [closestClub, setClosestClub] = useState<any>(null);

    const isAdmin = Boolean(myClubRole && adminRoles.has(myClubRole));
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    const fetchSchedule = async (clubId: number) => {
        try {
            const res = await apiClient.get<ScheduleItem[]>(`/clubs/${clubId}/calendar`);
            setEvents(res.data || []);
        } catch (error) {
            console.error('Failed to load calendar', error);
            setEvents([]);
        }
    };

    useEffect(() => {
        apiClient.get('/clubs/my-club')
            .then(async (res) => {
                const clubId = res.data?.clubId ?? null;
                const role = res.data?.myRole ?? null;
                setMyClubId(clubId);
                setMyClubRole(role);
                if (clubId && role && adminRoles.has(role)) {
                    await fetchSchedule(clubId);
                }
            })
            .catch((error) => {
                console.error('Failed to load my club', error);
                setMyClubId(null);
                setMyClubRole(null);
            })
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        if (!isMapPickerOpen || pickerMarkers.length === 0) return;
        let closest = null;
        let minD = Infinity;
        pickerMarkers.forEach((marker) => {
            const d = Math.pow(marker.latitude - mapCenter.lat, 2) + Math.pow(marker.longitude - mapCenter.lng, 2);
            if (d < minD) {
                minD = d;
                closest = marker;
            }
        });
        setClosestClub(closest);
    }, [isMapPickerOpen, mapCenter, pickerMarkers]);

    const eventConfig = useMemo<Record<ScheduleItemKind, { color: string; text: string; icon: typeof Swords }>>(() => ({
        MATCH: { color: 'bg-blue-500', text: 'text-blue-900', icon: Swords },
        TRYOUT: { color: 'bg-orange-500', text: 'text-orange-900', icon: CalendarIcon },
        AVAILABILITY: { color: 'bg-emerald-500', text: 'text-emerald-900', icon: Activity }
    }), []);

    const openDayModal = (dateStr: string) => {
        if (!isAdmin) return;
        setSelectedDate(createDefaultDateTime(dateStr));
        setEditingEventId(null);
        setFormData({ title: '', type: 'TRYOUT', location: '' });
        setModalMode('add');
        setIsMapPickerOpen(false);
        setIsMapExpanded(false);
        setClosestClub(null);
        setIsModalOpen(true);
    };

    const openEventModal = (event: ScheduleItem, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingEventId(event.id);
        setSelectedDate(toDateTimeInputValue(event.startsAt));
        setFormData({
            title: event.title,
            type: event.kind === 'MATCH' ? 'TRYOUT' : event.kind,
            location: event.locationText || ''
        });
        setModalMode('view');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!myClubId) return;
        if (!formData.location.trim()) {
            alert('Location is required.');
            return;
        }
        if (formData.type === 'TRYOUT' && !formData.title.trim()) {
            alert('Title is required for tryouts.');
            return;
        }
        try {
            await apiClient.post(`/clubs/${myClubId}/calendar`, {
                title: formData.type === 'AVAILABILITY' ? (formData.title.trim() || 'Open Match Availability') : formData.title.trim(),
                type: formData.type,
                date: selectedDate,
                location: formData.location.trim(),
                targetLocationClubId: formData.targetLocationClubId,
                ageGroup: formData.type === 'TRYOUT' ? 'OPEN' : undefined,
                gender: formData.type === 'AVAILABILITY' ? 'MIXED' : undefined,
                willingToTravel: formData.type === 'AVAILABILITY' ? Boolean(formData.targetLocationClubId) : undefined
            });
            await fetchSchedule(myClubId);
            setIsModalOpen(false);
        } catch (error) {
            alert('Failed to create schedule item.');
        }
    };

    const handleDelete = async () => {
        if (!editingEventId || !myClubId) return;
        try {
            await apiClient.delete(`/clubs/${myClubId}/calendar/${editingEventId}`);
            setEvents((current) => current.filter((event) => event.id !== editingEventId));
            setIsModalOpen(false);
        } catch (error) {
            alert('Failed to delete event.');
        }
    };

    const openMapPicker = async () => {
        setIsMapPickerOpen(true);
        try {
            const res = await apiClient.get('/map/nearby?lat=41.7151&lng=44.8271&radius=50&type=CLUB');
            setPickerMarkers(res.data);
        } catch (error) {
            console.error('Failed to load map points', error);
        }
    };

    if (isLoading) {
        return <div className="theme-surface-muted h-[calc(100vh-56px)] flex items-center justify-center text-emerald-500 font-bold tracking-widest uppercase animate-pulse">Syncing Grid...</div>;
    }

    return (
        <div className="theme-page flex w-full h-full font-sans text-slate-300 overflow-hidden relative">
            <aside className={`theme-surface border-r-2 theme-border transition-all duration-300 ease-in-out flex flex-col z-20 ${isSidebarOpen ? 'w-64' : 'w-0 border-r-0'}`}>
                <div className="p-6 whitespace-nowrap overflow-hidden">
                    <h2 className="font-black uppercase tracking-widest text-slate-400 text-xs mb-6">Logistics Menu</h2>
                    <nav className="flex flex-col gap-2">
                        <button className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-500 p-2 rounded-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full text-left">
                            <LayoutDashboard className="w-4 h-4" /> Command Center
                        </button>
                        <button className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-500 p-2 rounded-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full text-left">
                            <Users className="w-4 h-4" /> Manage Roster
                        </button>
                    </nav>
                </div>
            </aside>

            <main className="flex-1 flex flex-col relative overflow-hidden h-full">
                <div className="theme-surface-muted flex items-center justify-between gap-4 p-4 md:p-6 shrink-0 border-b theme-border backdrop-blur-sm z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen((open) => !open)} className="p-2.5 bg-slate-800 hover:bg-emerald-600 text-white rounded-sm border-2 border-slate-700 hover:border-emerald-500 transition-all shadow-[2px_2px_0px_0px_#020617]">
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="flex items-center bg-white dark:bg-[#1e293b] p-1.5 rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                            <button onClick={() => setCurrentDate(new Date(year, currentDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm text-slate-500 hover:text-emerald-500 transition-colors">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest w-40 text-center select-none">{monthName} {year}</h1>
                            <button onClick={() => setCurrentDate(new Date(year, currentDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm text-slate-500 hover:text-emerald-500 transition-colors">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {isAdmin && (
                            <button className="bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border-2 border-pink-500/50 px-4 py-2.5 rounded-sm font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-colors">
                                <Sparkles className="w-4 h-4" /> Customize
                            </button>
                        )}
                        <div className="flex bg-white dark:bg-[#1e293b] p-1 rounded-sm border-2 border-slate-300 dark:border-slate-800">
                            <button onClick={() => setViewMode('timeline')} className={`p-2 rounded-sm transition-all ${viewMode === 'timeline' ? 'bg-slate-100 dark:bg-slate-800 text-emerald-500 shadow-sm' : 'text-slate-400'}`}><List className="w-4 h-4" /></button>
                            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-sm transition-all ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-800 text-emerald-500 shadow-sm' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>

                {!myClubId ? (
                    <div className="flex-1 flex items-center justify-center px-6 text-center">
                        <div className="theme-surface theme-border max-w-xl border-2 rounded-sm p-10 shadow-[8px_8px_0px_0px_#020617]">
                            <h2 className="font-black uppercase tracking-widest text-slate-900 dark:text-white text-lg mb-3">No Club Linked</h2>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">This planner works once your account is attached to a club.</p>
                        </div>
                    </div>
                ) : !isAdmin ? (
                    <div className="flex-1 flex items-center justify-center px-6 text-center">
                        <div className="theme-surface theme-border max-w-xl border-2 rounded-sm p-10 shadow-[8px_8px_0px_0px_#020617]">
                            <h2 className="font-black uppercase tracking-widest text-slate-900 dark:text-white text-lg mb-3">Planner Access Restricted</h2>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">This planner currently opens the club-admin calendar workspace for OWNER and CLUB_ADMIN memberships.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto overscroll-contain pb-32 pt-4 px-4 md:px-6 custom-scrollbar">
                            {viewMode === 'timeline' && (
                                <div className="relative w-full group/timeline">
                                    <button onClick={() => timelineRef.current?.scrollBy({ left: -300, behavior: 'smooth' })} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-900/90 hover:bg-emerald-600 text-white p-3 rounded-r-sm shadow-[4px_0px_0px_0px_#020617] border-y-2 border-r-2 border-slate-700 opacity-0 group-hover/timeline:opacity-100"><ChevronLeft className="w-6 h-6" /></button>
                                    <div ref={timelineRef} onWheel={(e) => { if (timelineRef.current) { e.preventDefault(); timelineRef.current.scrollLeft += e.deltaY; } }} className="flex overflow-x-auto gap-4 py-6 px-2 scrollbar-hide items-center min-h-[420px]">
                                        {Array.from({ length: daysInMonth }).map((_, i) => {
                                            const day = i + 1;
                                            const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                            const dayEvents = events.filter((event) => extractDayKey(event.startsAt) === dateStr);
                                            const today = new Date();
                                            const isToday = day === today.getDate() && currentDate.getMonth() === today.getMonth() && year === today.getFullYear();

                                            return (
                                                <div key={day} onClick={() => openDayModal(dateStr)} className={`shrink-0 w-60 h-[22rem] rounded-sm border-2 p-4 flex flex-col transition-all hover:-translate-y-2 group ${isAdmin ? 'cursor-pointer' : ''} ${isToday ? 'bg-slate-800 border-emerald-500 shadow-[6px_6px_0px_0px_#10b981]' : 'bg-white dark:bg-[#151f28] border-slate-300 dark:border-slate-800 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[6px_6px_0px_0px_#020617]'}`}>
                                                    <div className="flex justify-between items-start mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                                                        <span className={`text-5xl font-black ${isToday ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-400 group-hover:text-emerald-500'}`}>{day}</span>
                                                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mt-1">{new Date(year, currentDate.getMonth(), day).toLocaleString('default', { weekday: 'short' })}</span>
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1">
                                                        {dayEvents.map((event) => {
                                                            const config = eventConfig[event.kind];
                                                            const Icon = config.icon;
                                                            return (
                                                                <div key={event.id} onClick={(e) => openEventModal(event, e)} className={`${config.color} p-2 rounded-sm border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] cursor-pointer hover:-translate-y-0.5 transition-transform mb-2`}>
                                                                    <div className="flex items-center gap-2">
                                                                        <Icon className={`w-3.5 h-3.5 ${config.text}`} />
                                                                        <span className={`text-[10px] font-black uppercase tracking-wider truncate ${config.text}`}>{event.title}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {dayEvents.length === 0 && (
                                                            <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1"><Plus className="w-3 h-3" /> Click to Assign</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <button onClick={() => timelineRef.current?.scrollBy({ left: 300, behavior: 'smooth' })} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-slate-900/90 hover:bg-emerald-600 text-white p-3 rounded-l-sm shadow-[-4px_0px_0px_0px_#020617] border-y-2 border-l-2 border-slate-700 opacity-0 group-hover/timeline:opacity-100"><ChevronRight className="w-6 h-6" /></button>
                                </div>
                            )}

                            {viewMode === 'grid' && (
                            <div className="theme-surface theme-border rounded-sm border-2 shadow-[8px_8px_0px_0px_#020617] overflow-hidden mt-6">
                                    <div className="theme-surface-strong grid grid-cols-7 border-b-2 theme-border">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="p-3 text-center text-xs font-black uppercase tracking-widest text-slate-500 border-r-2 border-slate-300 dark:border-slate-700 last:border-r-0">{day}</div>)}
                                    </div>
                                        <div className="theme-border grid grid-cols-7 auto-rows-fr bg-slate-300 dark:bg-slate-700 gap-[2px]">
                                        {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="theme-surface-strong min-h-[140px] opacity-60"></div>)}
                                        {Array.from({ length: daysInMonth }).map((_, i) => {
                                            const day = i + 1;
                                            const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                            const dayEvents = events.filter((event) => extractDayKey(event.startsAt) === dateStr);
                                            return (
                                                <div key={day} onClick={() => openDayModal(dateStr)} className="theme-surface min-h-[160px] p-3 transition-colors group hover:bg-slate-50 dark:hover:theme-surface-inset cursor-pointer">
                                                    <div className="text-right mb-2"><span className="text-sm font-black text-slate-500 transition-colors group-hover:text-emerald-500">{day}</span></div>
                                                    <div className="flex flex-col gap-1">
                                                        {dayEvents.map((event) => {
                                                            const config = eventConfig[event.kind];
                                                            const Icon = config.icon;
                                                            return (
                                                                <div key={event.id} onClick={(e) => openEventModal(event, e)} className={`${config.color} p-2 rounded-sm border border-slate-900 cursor-pointer`}>
                                                                    <div className="flex items-center gap-2">
                                                                        <Icon className={`w-3 h-3 ${config.text}`} />
                                                                        <span className={`text-[10px] font-black uppercase tracking-wider truncate ${config.text}`}>{event.title}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 z-10 pointer-events-none">
                            <button onClick={() => openDayModal(`${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`)} className="pointer-events-auto bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 md:px-12 md:py-5 rounded-sm font-black uppercase text-sm md:text-base tracking-widest shadow-[6px_6px_0px_0px_#020617] transition-all flex items-center gap-3 border-2 border-emerald-900">
                                <Plus className="w-6 h-6" /> Add Plans
                            </button>
                        </div>
                    </>
                )}
            </main>

            {isModalOpen && (
                <div className="theme-overlay fixed inset-0 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className={`theme-surface w-full ${isMapExpanded ? 'max-w-4xl' : 'max-w-md'} rounded-sm border-4 theme-border-strong shadow-[12px_12px_0px_0px_#020617] overflow-hidden transition-all duration-300`}>
                        {isMapPickerOpen ? (
                            <div className="flex flex-col">
                                <div className="flex justify-between items-center p-4 border-b-2 border-slate-700 bg-slate-900">
                                    <h2 className="font-black text-white uppercase tracking-widest text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-500" /> Target Coordinates</h2>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setIsMapExpanded((expanded) => !expanded)} className="text-slate-400 hover:text-emerald-500 transition-colors">{isMapExpanded ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}</button>
                                        <button onClick={() => { setIsMapPickerOpen(false); setIsMapExpanded(false); }} className="text-slate-400 hover:text-rose-500 transition-colors"><X className="w-5 h-5" /></button>
                                    </div>
                                </div>
                                <div className={`relative bg-slate-800 border-2 border-slate-900 m-2 mt-3 shadow-[6px_6px_0px_0px_#020617] transition-all duration-300 ${isMapExpanded ? 'h-[500px] md:h-[600px]' : 'h-[300px]'}`}>
                                    <MapContainer center={[41.7151, 44.8271]} zoom={13} className="w-full h-full" zoomControl={false}>
                                        <MapSizeFixer isExpanded={isMapExpanded} />
                                        <TileLayer url={MAP_TILES} attribution={MAP_ATTRIBUTION} />
                                        <MapCenterObserver onCenterChange={(lat, lng) => setMapCenter({ lat, lng })} />
                                        {pickerMarkers.map((marker) => (
                                            <Marker key={`club-${marker.entityId}`} position={[marker.latitude, marker.longitude]} icon={soccerBallIcon} eventHandlers={{ click: () => {
                                                setFormData((current) => ({ ...current, location: marker.title, targetLocationClubId: marker.entityId }));
                                                setIsMapPickerOpen(false);
                                                setIsMapExpanded(false);
                                            } }} />
                                        ))}
                                    </MapContainer>
                                </div>
                                <div className="p-4 bg-slate-900 border-t-2 border-slate-700 flex flex-col gap-3 mt-2">
                                    <p className="font-black text-white text-lg truncate">{closestClub ? closestClub.title : 'Scanning...'}</p>
                                    <button onClick={() => {
                                        if (closestClub) {
                                            setFormData((current) => ({ ...current, location: closestClub.title, targetLocationClubId: closestClub.entityId }));
                                        }
                                        setIsMapPickerOpen(false);
                                        setIsMapExpanded(false);
                                    }} disabled={!closestClub} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-black uppercase text-xs tracking-widest py-3 rounded-sm transition-all">
                                        Lock Coordinates
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center p-5 border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                    <h2 className="font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2 text-lg">{modalMode === 'add' ? <><Plus className="w-6 h-6 text-emerald-500" /> Log New Directive</> : <><MapPin className="w-6 h-6 text-blue-500" /> Event Logistics</>}</h2>
                                    <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors"><X className="w-6 h-6" /></button>
                                </div>
                                <div className="p-6 flex flex-col gap-5">
                                    {modalMode === 'add' ? (
                                        <>
                                            <input type="datetime-local" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-slate-100 dark:bg-[#0f172a] border-2 border-slate-300 dark:border-slate-700 rounded-sm px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-bold" />
                                            <input type="text" placeholder={formData.type === 'AVAILABILITY' ? 'Optional label for your availability window' : 'e.g., Open Senior Tryout'} value={formData.title} onChange={(e) => setFormData((current) => ({ ...current, title: e.target.value }))} className="w-full bg-slate-100 dark:bg-[#0f172a] border-2 border-slate-300 dark:border-slate-700 rounded-sm px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-bold" />
                                            <div className="grid grid-cols-2 gap-4">
                                                <select value={formData.type} onChange={(e) => setFormData((current) => ({ ...current, type: e.target.value as EventFormData['type'] }))} className="w-full bg-slate-100 dark:bg-[#0f172a] border-2 border-slate-300 dark:border-slate-700 rounded-sm px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-bold appearance-none">
                                                    <option value="TRYOUT">Tryout</option>
                                                    <option value="AVAILABILITY">Open Availability</option>
                                                </select>
                                                <input type="text" placeholder="e.g., Pitch 2" value={formData.location} onChange={(e) => setFormData((current) => ({ ...current, location: e.target.value, targetLocationClubId: undefined }))} className="w-full bg-slate-100 dark:bg-[#0f172a] border-2 border-slate-300 dark:border-slate-700 rounded-sm px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-bold" />
                                            </div>
                                            <button onClick={openMapPicker} className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 py-3 rounded-sm border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-colors"><MapPin className="w-3.5 h-3.5" /> Choose on Map</button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-sm border-2 border-slate-200 dark:border-slate-700 text-center">
                                                <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{formData.title}</h3>
                                                {editingEventId && (
                                                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                        {scheduleKindLabel[events.find((event) => event.id === editingEventId)?.kind || 'TRYOUT']}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="bg-white dark:bg-[#0f172a] p-4 border-2 border-slate-200 dark:border-slate-700 rounded-sm">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Date</p>
                                                    <p className="font-black text-slate-900 dark:text-white text-base">{formatDisplayDate(selectedDate)}</p>
                                                </div>
                                                <div className="bg-white dark:bg-[#0f172a] p-4 border-2 border-slate-200 dark:border-slate-700 rounded-sm">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Location</p>
                                                    <p className="font-black text-slate-900 dark:text-white text-base truncate">{formData.location || 'No location recorded'}</p>
                                                </div>
                                                <div className="bg-white dark:bg-[#0f172a] p-4 border-2 border-slate-200 dark:border-slate-700 rounded-sm">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Status</p>
                                                    <p className="font-black text-slate-900 dark:text-white text-base">
                                                        {editingEventId ? scheduleStatusLabel[events.find((event) => event.id === editingEventId)?.status || 'SCHEDULED'] : 'Scheduled'}
                                                    </p>
                                                </div>
                                                {editingEventId && events.find((event) => event.id === editingEventId)?.subtitle && (
                                                    <div className="bg-white dark:bg-[#0f172a] p-4 border-2 border-slate-200 dark:border-slate-700 rounded-sm">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Context</p>
                                                        <p className="font-black text-slate-900 dark:text-white text-base truncate">
                                                            {events.find((event) => event.id === editingEventId)?.subtitle}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="p-5 border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between gap-4">
                                    {modalMode === 'view' ? <button onClick={handleDelete} className="px-4 py-3 rounded-sm font-bold uppercase text-[11px] tracking-widest text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/10 transition-colors flex items-center gap-2"><Trash2 className="w-4 h-4" /> Discard</button> : <div></div>}
                                    <div className="flex gap-4">
                                        <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-sm font-bold uppercase text-[11px] tracking-widest text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">{modalMode === 'view' ? 'Close' : 'Cancel'}</button>
                                        {modalMode === 'add' && <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-sm font-black uppercase text-[11px] tracking-widest shadow-[4px_4px_0px_0px_#020617] transition-all border-2 border-emerald-900">Commit Directive</button>}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
