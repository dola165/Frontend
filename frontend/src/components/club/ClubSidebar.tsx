import { Trophy, Medal, Users, Calendar, CalendarDays, Camera, PartyPopper, Mail, Heart, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const soccerBallIcon = L.divIcon({
    className: "custom-pin bg-transparent border-0",
    html: `<img src="/markers/ball.png" class="w-8 h-8 drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)]" alt="pin" />`,
    iconSize: [32, 32], iconAnchor: [16, 16]
});

interface ClubSidebarProps { activeTab: string; setActiveTab: (tab: string) => void; club: any; }

export const ClubSidebar = ({ activeTab, setActiveTab, club }: ClubSidebarProps) => {
    const position: [number, number] = [club?.latitude || 41.7151, club?.longitude || 44.8271];

    const sidebarItems = [
        { id: 'our-club', icon: Trophy, label: 'Our Club' }, { id: 'honours', icon: Medal, label: 'Honours' },
        { id: 'teams', icon: Users, label: 'Teams' }, { id: 'training', icon: Calendar, label: 'Training Schedule' },
        { id: 'calendar', icon: CalendarDays, label: 'Calendar' }, { id: 'media', icon: Camera, label: 'Photos / Videos' },
        { id: 'events', icon: PartyPopper, label: 'Events' }, { id: 'contact', icon: Mail, label: 'Contact' },
        { id: 'sponsors', icon: Heart, label: 'Sponsors' },
    ];

    return (
        <aside className="w-full lg:w-[280px] shrink-0 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                {sidebarItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-all group border-2 ${isActive ? 'bg-white dark:bg-[#1e293b] text-emerald-600 dark:text-emerald-500 border-slate-300 dark:border-black shadow-md dark:shadow-[0_4px_10px_rgba(0,0,0,0.4)]' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1e293b] hover:text-emerald-600 dark:hover:text-emerald-500'}`}
                        >
                            <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                            <span className="font-bold text-sm tracking-wide">{item.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-2 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] mt-2">
                <div className="h-48 w-full rounded-md overflow-hidden relative z-0 border border-slate-300 dark:border-slate-700 group">
                    <MapContainer center={position} zoom={14} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} className="w-full h-full">
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={position} icon={soccerBallIcon} />
                    </MapContainer>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none z-[1000] flex items-end p-3">
                        <span className="text-white text-xs font-bold drop-shadow-md flex items-center gap-1.5 group-hover:text-emerald-400 transition-colors">
                            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="truncate">{club?.addressText || "Tbilisi Base"}</span>
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
};