import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/axiosConfig';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, LayoutGrid,
    List, Plus, Pen, Swords, Activity, Users, MapPin, X,
    Menu, Sparkles, LayoutDashboard, Trash2, Maximize, Minimize
} from 'lucide-react';

// === MAP PICKER CONFIG ===

// Bright OpenStreetMap Tiles
const MAP_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Custom ball icon for the map pins (Fixed Path)
const soccerBallIcon = L.divIcon({
    className: "custom-pin bg-transparent border-0",
    html: `<img src="/markers/ball.png" class="w-8 h-8 drop-shadow-[0_4px_4px_rgba(0,0,0,0.4)] transition-transform hover:scale-110" alt="pin" />`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

// --- HELPER COMPONENTS ---

// 1. Uber-style Map Center Tracker
function MapCenterObserver({ onCenterChange }: { onCenterChange: (lat: number, lng: number) => void }) {
    const map = useMapEvents({
        moveend: () => {
            const center = map.getCenter();
            onCenterChange(center.lat, center.lng);
        }
    });
    return null;
}

// 2. THE FIX: Forces Leaflet to recalculate its size after the modal animation finishes
function MapSizeFixer({ isExpanded }: { isExpanded: boolean }) {
    const map = useMap();
    useEffect(() => {
        // Wait 300ms for the modal 'zoom-in' or 'expand' CSS transitions to finish
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 300);
        return () => clearTimeout(timer);
    }, [map, isExpanded]);
    return null;
}

// --- TYPES ---
type EventType = 'MATCH' | 'TRYOUT' | 'TRAINING' | 'MEETING';

interface PlannerEvent {
    id: string;
    date: string;
    title: string;
    type: EventType;
    location: string;
    clubName?: string;
}

interface EventFormData {
    title: string;
    type: EventType;
    location: string;
    targetLocationClubId?: number;
}

export const CalendarPage = () => {
    // --- AUTH & CORE STATE ---
    const [userRole, setUserRole] = useState<string>('FAN');
    const [isLoadingRole, setIsLoadingRole] = useState(true);
    const [myClubId, setMyClubId] = useState<number | null>(null);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const timelineRef = useRef<HTMLDivElement>(null);

    const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1));
    const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
    const [events, setEvents] = useState<PlannerEvent[]>([]);

    // --- MODAL & FORM STATE ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [editingEventId, setEditingEventId] = useState<string | null>(null);

    const [formData, setFormData] = useState<EventFormData>({
        title: '', type: 'TRAINING', location: ''
    });

    // --- MAP PICKER STATE ---
    const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
    const [isMapExpanded, setIsMapExpanded] = useState(false);
    const [pickerMarkers, setPickerMarkers] = useState<any[]>([]);
    const [mapCenter, setMapCenter] = useState<{lat: number, lng: number}>({ lat: 41.7151, lng: 44.8271 });
    const [closestClub, setClosestClub] = useState<any>(null);

    // Fetch Schedule
    const fetchCalendar = async (clubId: number) => {
        try {
            const res = await apiClient.get(`/clubs/${clubId}/calendar`);
            const liveEvents = res.data.map((ev: any) => ({
                id: ev.id, date: ev.date, title: ev.title, type: ev.type, location: ev.location, clubName: 'My Club'
            }));
            setEvents(liveEvents);
        } catch (err) { console.error("Failed to load calendar", err); }
    };

    useEffect(() => {
        apiClient.get('/users/me')
            .then(res => setUserRole(res.data.role))
            .catch(() => setUserRole('PLAYER'))
            .finally(() => setIsLoadingRole(false));

        apiClient.get('/clubs/my-club')
            .then(res => {
                if (res.data?.clubId) {
                    setMyClubId(res.data.clubId);
                    fetchCalendar(res.data.clubId);
                }
            })
            .catch(err => console.error("Failed to load club", err));
    }, []);

    const isAdmin = userRole === 'CLUB_ADMIN';

    // --- DATE HELPERS ---
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    // --- ACTIONS ---
    const handleDayClick = (dateStr: string) => {
        if (!isAdmin) return;
        setSelectedDate(dateStr);
        setFormData({ title: '', type: 'TRAINING', location: '', targetLocationClubId: undefined });
        setIsMapPickerOpen(false);
        setIsMapExpanded(false);
        setModalMode('add');
        setIsModalOpen(true);
    };

    const handleEventClick = (event: PlannerEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedDate(event.date);
        setFormData({ title: event.title, type: event.type, location: event.location, targetLocationClubId: undefined });
        setEditingEventId(event.id);
        setIsMapPickerOpen(false);
        setIsMapExpanded(false);
        setModalMode(isAdmin ? 'edit' : 'view');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title) return alert("Title is required");
        const targetClubId = myClubId || 1;

        try {
            const payload = {
                title: formData.title, type: formData.type, date: selectedDate,
                location: formData.location, targetLocationClubId: formData.targetLocationClubId
            };

            if (modalMode === 'add') {
                await apiClient.post(`/clubs/${targetClubId}/calendar`, payload);
            } else if (modalMode === 'edit' && editingEventId) {
                await apiClient.put(`/clubs/${targetClubId}/calendar/${editingEventId}`, payload);
            }
            await fetchCalendar(targetClubId);
            setIsModalOpen(false);
        } catch (error) {
            alert("Network Error: Failed to sync event.");
        }
    };

    const handleDelete = async () => {
        if (!editingEventId) return;
        try {
            await apiClient.delete(`/clubs/${myClubId || 1}/calendar/${editingEventId}`);
            setEvents(events.filter(ev => ev.id !== editingEventId));
            setIsModalOpen(false);
        } catch (error) { alert("Failed to delete event."); }
    };

    // --- UBER MAP LOGIC ---
    const openMapPicker = async (e: React.MouseEvent) => {
        e.preventDefault();
        setIsMapPickerOpen(true);
        try {
            const res = await apiClient.get('/map/nearby?lat=41.7151&lng=44.8271&radius=50&type=CLUB');
            setPickerMarkers(res.data);
        } catch (err) { console.error("Failed to load map points", err); }
    };

    useEffect(() => {
        if (!isMapPickerOpen || pickerMarkers.length === 0) return;
        let closest = null;
        let minD = Infinity;
        pickerMarkers.forEach(m => {
            const d = Math.pow(m.latitude - mapCenter.lat, 2) + Math.pow(m.longitude - mapCenter.lng, 2);
            if (d < minD) { minD = d; closest = m; }
        });
        setClosestClub(closest);
    }, [mapCenter, pickerMarkers, isMapPickerOpen]);

    const confirmMapSelection = (e: React.MouseEvent) => {
        e.preventDefault();
        if (closestClub) {
            setFormData({
                ...formData,
                location: closestClub.title,
                targetLocationClubId: closestClub.entityId
            });
        }
        setIsMapPickerOpen(false);
        setIsMapExpanded(false);
    };

    // --- RENDER HELPERS ---
    const scrollTimeline = (direction: 'left' | 'right') => {
        if (timelineRef.current) timelineRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
    };

    const getEventConfig = (type: EventType) => {
        switch (type) {
            case 'MATCH': return { color: 'bg-blue-500', text: 'text-blue-900', icon: Swords };
            case 'TRYOUT': return { color: 'bg-orange-500', text: 'text-orange-900', icon: CalendarIcon };
            case 'TRAINING': return { color: 'bg-emerald-500', text: 'text-emerald-900', icon: Activity };
            case 'MEETING': return { color: 'bg-purple-500', text: 'text-purple-900', icon: Users };
        }
    };

    const renderEventPill = (event: PlannerEvent) => {
        const config = getEventConfig(event.type);
        const Icon = config.icon;
        return (
            <div key={event.id} onClick={(e) => handleEventClick(event, e)}
                 className={`${config.color} p-2 rounded-sm border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] cursor-pointer hover:-translate-y-0.5 transition-transform mb-2`}>
                <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${config.text}`} />
                    <span className={`text-[10px] font-black uppercase tracking-wider truncate ${config.text}`}>{event.title}</span>
                </div>
            </div>
        );
    };

    if (isLoadingRole) return <div className="h-[calc(100vh-56px)] bg-[#0f172a] flex items-center justify-center text-emerald-500 font-bold tracking-widest uppercase animate-pulse">Syncing Grid...</div>;

    return (
        <div className="flex w-full h-[calc(100vh-56px)] bg-[#0f172a] font-sans text-slate-300 overflow-hidden relative">

            {/* === 1. SLIDING LEFT SIDEBAR === */}
            <aside className={`bg-white dark:bg-[#1e293b] border-r-2 border-slate-300 dark:border-slate-800 transition-all duration-300 ease-in-out flex flex-col z-20 ${isSidebarOpen ? 'w-64' : 'w-0 border-r-0'}`}>
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

            {/* === MAIN CONTENT AREA === */}
            <main className="flex-1 flex flex-col relative overflow-hidden h-full">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 md:p-6 shrink-0 border-b border-slate-800 bg-[#0f172a]/95 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 bg-slate-800 hover:bg-emerald-600 text-white rounded-sm border-2 border-slate-700 hover:border-emerald-500 transition-all shadow-[2px_2px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none">
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="flex items-center bg-white dark:bg-[#1e293b] p-1.5 rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm text-slate-500 hover:text-emerald-500 transition-colors">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest w-40 text-center select-none">
                                {monthName} {year}
                            </h1>
                            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm text-slate-500 hover:text-emerald-500 transition-colors">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {isAdmin && (
                            <button className="bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border-2 border-pink-500/50 px-4 py-2.5 rounded-sm font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-colors shadow-[2px_2px_0px_0px_rgba(236,72,153,0.2)]">
                                <Sparkles className="w-4 h-4" /> Customize
                            </button>
                        )}
                        <div className="flex bg-white dark:bg-[#1e293b] p-1 rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_#020617]">
                            <button onClick={() => setViewMode('timeline')} className={`p-2 rounded-sm transition-all ${viewMode === 'timeline' ? 'bg-slate-100 dark:bg-slate-800 text-emerald-500 shadow-sm' : 'text-slate-400'}`}>
                                <List className="w-4 h-4" />
                            </button>
                            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-sm transition-all ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-800 text-emerald-500 shadow-sm' : 'text-slate-400'}`}>
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pb-32 pt-4 px-4 md:px-6 custom-scrollbar">
                    {viewMode === 'timeline' && (
                        <div className="relative w-full group/timeline">
                            <button onClick={() => scrollTimeline('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-900/90 hover:bg-emerald-600 text-white p-3 rounded-r-sm shadow-[4px_0px_0px_0px_#020617] border-y-2 border-r-2 border-slate-700 opacity-0 group-hover/timeline:opacity-100"><ChevronLeft className="w-6 h-6" /></button>
                            <div ref={timelineRef} onWheel={(e) => { if(timelineRef.current) timelineRef.current.scrollLeft += e.deltaY; }} className="flex overflow-x-auto gap-4 py-6 px-2 scrollbar-hide items-center min-h-[400px]">
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const dayEvents = events.filter(e => e.date === dateStr);
                                    const isToday = day === 15;

                                    return (
                                        <div key={day} onClick={() => handleDayClick(dateStr)} className={`shrink-0 w-56 h-80 rounded-sm border-2 p-4 flex flex-col transition-all hover:-translate-y-2 group ${isAdmin ? 'cursor-pointer' : ''} ${isToday ? 'bg-slate-800 border-emerald-500 shadow-[6px_6px_0px_0px_#10b981]' : 'bg-white dark:bg-[#1e293b] border-slate-300 dark:border-slate-800 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[6px_6px_0px_0px_#020617]'}`}>
                                            <div className="flex justify-between items-start mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                                                <span className={`text-5xl font-black ${isToday ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-400 group-hover:text-emerald-500'}`}>{day}</span>
                                                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mt-1">{new Date(year, currentDate.getMonth(), day).toLocaleString('default', { weekday: 'short' })}</span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1">
                                                {dayEvents.map(renderEventPill)}
                                                {dayEvents.length === 0 && isAdmin && (
                                                    <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1"><Plus className="w-3 h-3"/> Click to Assign</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <button onClick={() => scrollTimeline('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-slate-900/90 hover:bg-emerald-600 text-white p-3 rounded-l-sm shadow-[-4px_0px_0px_0px_#020617] border-y-2 border-l-2 border-slate-700 opacity-0 group-hover/timeline:opacity-100"><ChevronRight className="w-6 h-6" /></button>
                        </div>
                    )}

                    {viewMode === 'grid' && (
                        <div className="bg-white dark:bg-[#1e293b] rounded-sm border-2 border-slate-300 dark:border-slate-700 shadow-[8px_8px_0px_0px_#020617] overflow-hidden mt-6">
                            <div className="grid grid-cols-7 border-b-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="p-3 text-center text-xs font-black uppercase tracking-widest text-slate-500 border-r-2 border-slate-300 dark:border-slate-700 last:border-r-0">{day}</div>)}
                            </div>
                            <div className="grid grid-cols-7 auto-rows-fr bg-slate-300 dark:bg-slate-700 gap-[2px]">
                                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="min-h-[140px] bg-slate-50/50 dark:bg-[#0f172a]/50"></div>)}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const dayEvents = events.filter(e => e.date === dateStr);

                                    return (
                                        <div key={day} onClick={() => handleDayClick(dateStr)} className={`min-h-[140px] p-2 bg-white dark:bg-[#1e293b] transition-colors group ${isAdmin ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : ''}`}>
                                            <div className="text-right mb-2"><span className={`text-sm font-black text-slate-500 transition-colors ${isAdmin ? 'group-hover:text-emerald-500' : ''}`}>{day}</span></div>
                                            <div className="flex flex-col gap-1">{dayEvents.map(renderEventPill)}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {isAdmin && (
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 z-10 pointer-events-none">
                        <button onClick={() => handleDayClick(`${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`)} className="pointer-events-auto bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 md:px-12 md:py-5 rounded-sm font-black uppercase text-sm md:text-base tracking-widest shadow-[6px_6px_0px_0px_#020617] hover:shadow-[8px_8px_0px_0px_#020617] active:translate-y-1 active:shadow-none transition-all flex items-center gap-3 border-2 border-emerald-900"><Plus className="w-6 h-6" /> Add Plans</button>
                    </div>
                )}
            </main>

            {/* === NEO-BRUTALIST MODAL === */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className={`bg-white dark:bg-[#1e293b] w-full ${isMapExpanded ? 'max-w-4xl' : 'max-w-md'} rounded-sm border-4 border-slate-900 dark:border-slate-700 shadow-[12px_12px_0px_0px_#020617] animate-in zoom-in-95 overflow-hidden transition-all duration-300`}>

                        {/* --- THE UBER MAP OVERLAY --- */}
                        {isMapPickerOpen ? (
                            <div className="flex flex-col">
                                <div className="flex justify-between items-center p-4 border-b-2 border-slate-700 bg-slate-900">
                                    <h2 className="font-black text-white uppercase tracking-widest text-sm flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-emerald-500" /> Target Coordinates
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        {/* EXPAND/COLLAPSE TOGGLE */}
                                        <button onClick={() => setIsMapExpanded(!isMapExpanded)} className="text-slate-400 hover:text-emerald-500 transition-colors" title={isMapExpanded ? "Minimize Map" : "Expand Map"}>
                                            {isMapExpanded ? <Minimize className="w-5 h-5"/> : <Maximize className="w-5 h-5"/>}
                                        </button>
                                        <button onClick={() => { setIsMapPickerOpen(false); setIsMapExpanded(false); }} className="text-slate-400 hover:text-rose-500 transition-colors">
                                            <X className="w-5 h-5"/>
                                        </button>
                                    </div>
                                </div>

                                <div className="p-1 bg-slate-100 dark:bg-[#0f172a] border-b-2 border-slate-300 dark:border-slate-700">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 py-2">Pan map to center fixed pin over desired club, or click a ball.</p>
                                </div>

                                {/* ADJUSTABLE BRUTALIST MAP CONTAINER */}
                                <div className={`relative bg-slate-800 border-2 border-slate-900 m-2 mt-3 shadow-[6px_6px_0px_0px_#020617] transition-all duration-300 ${isMapExpanded ? 'h-[500px] md:h-[600px]' : 'h-[300px]'}`}>
                                    <MapContainer center={[41.7151, 44.8271]} zoom={13} className="w-full h-full" zoomControl={false}>
                                        <MapSizeFixer isExpanded={isMapExpanded} />
                                        <TileLayer url={MAP_TILES} attribution={MAP_ATTRIBUTION} />
                                        <MapCenterObserver onCenterChange={(lat, lng) => setMapCenter({lat, lng})} />

                                        {pickerMarkers.map(m => (
                                            <Marker key={`club-${m.entityId}`} position={[m.latitude, m.longitude]} icon={soccerBallIcon}
                                                    eventHandlers={{
                                                        click: () => {
                                                            setFormData({...formData, location: m.title, targetLocationClubId: m.entityId});
                                                            setIsMapPickerOpen(false);
                                                            setIsMapExpanded(false);
                                                        }
                                                    }}
                                            />
                                        ))}
                                    </MapContainer>

                                    {/* The Fixed Center Pin (Bouncing Ball Overlay) */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none flex flex-col items-center justify-center -mt-6">
                                        <img src="/markers/ball.png" className="w-12 h-12 drop-shadow-[0_8px_8px_rgba(0,0,0,0.6)] animate-bounce" alt="selected" />
                                        <div className="w-6 h-1.5 bg-black/40 blur-[2px] rounded-[100%] absolute -bottom-1"></div>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-900 border-t-2 border-slate-700 flex flex-col gap-3 mt-2">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nearest Detected Organization:</p>
                                        <p className="font-black text-white text-lg truncate">{closestClub ? closestClub.title : "Scanning..."}</p>
                                    </div>
                                    <button
                                        onClick={confirmMapSelection}
                                        disabled={!closestClub}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-black uppercase text-xs tracking-widest py-3 rounded-sm transition-all shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none"
                                    >
                                        Lock Coordinates
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* --- THE STANDARD FORM --- */
                            <>
                                <div className="flex justify-between items-center p-5 border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                    <h2 className="font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2 text-lg">
                                        {modalMode === 'add' && <><Plus className="w-6 h-6 text-emerald-500" /> Log New Directive</>}
                                        {modalMode === 'edit' && <><Pen className="w-6 h-6 text-orange-500" /> Edit Directive</>}
                                        {modalMode === 'view' && <><MapPin className="w-6 h-6 text-blue-500" /> Event Logistics</>}
                                    </h2>
                                    <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors"><X className="w-6 h-6" /></button>
                                </div>

                                <div className="p-6 flex flex-col gap-5">
                                    {modalMode !== 'view' ? (
                                        <>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Date</label>
                                                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                                                       className="w-full bg-slate-100 dark:bg-[#0f172a] border-2 border-slate-300 dark:border-slate-700 rounded-sm px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-bold" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Event Designation</label>
                                                <input type="text" placeholder="e.g., Tactical Briefing" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})}
                                                       className="w-full bg-slate-100 dark:bg-[#0f172a] border-2 border-slate-300 dark:border-slate-700 rounded-sm px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-bold" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Classification</label>
                                                    <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value as EventType})}
                                                            className="w-full bg-slate-100 dark:bg-[#0f172a] border-2 border-slate-300 dark:border-slate-700 rounded-sm px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-bold appearance-none">
                                                        <option value="TRAINING">Training</option>
                                                        <option value="MATCH">Match</option>
                                                        <option value="TRYOUT">Tryout</option>
                                                        <option value="MEETING">Meeting</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Location Grid</label>
                                                    <div className="flex flex-col gap-2">
                                                        <input type="text" placeholder="e.g., Pitch 2" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value, targetLocationClubId: undefined})}
                                                               className="w-full bg-slate-100 dark:bg-[#0f172a] border-2 border-slate-300 dark:border-slate-700 rounded-sm px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-bold" />
                                                        <button onClick={openMapPicker} className="text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 py-2.5 rounded-sm border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-colors">
                                                            <MapPin className="w-3.5 h-3.5" /> Choose on Map
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-sm border-2 border-slate-200 dark:border-slate-700 text-center">
                                                <span className={`inline-block px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest mb-3 border border-current ${getEventConfig(formData.type).color} ${getEventConfig(formData.type).text}`}>{formData.type}</span>
                                                <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{formData.title}</h3>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mt-2">
                                                <div className="bg-white dark:bg-[#0f172a] p-4 border-2 border-slate-200 dark:border-slate-700 rounded-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#020617]">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Date</p>
                                                    <p className="font-black text-slate-900 dark:text-white text-base">{selectedDate}</p>
                                                </div>
                                                <div className="bg-white dark:bg-[#0f172a] p-4 border-2 border-slate-200 dark:border-slate-700 rounded-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0px_0px_#020617]">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Sector</p>
                                                    <p className="font-black text-slate-900 dark:text-white text-base truncate">{formData.location}</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="p-5 border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between gap-4">
                                    {modalMode === 'edit' ? (
                                        <button onClick={handleDelete} className="px-4 py-3 rounded-sm font-bold uppercase text-[11px] tracking-widest text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/10 transition-colors flex items-center gap-2"><Trash2 className="w-4 h-4" /> Discard</button>
                                    ) : <div></div>}
                                    <div className="flex gap-4">
                                        <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-sm font-bold uppercase text-[11px] tracking-widest text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">{modalMode === 'view' ? 'Close' : 'Cancel'}</button>
                                        {modalMode !== 'view' && (
                                            <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-sm font-black uppercase text-[11px] tracking-widest shadow-[4px_4px_0px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all border-2 border-emerald-900">Commit Directive</button>
                                        )}
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