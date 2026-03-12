import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { 
    Shield, 
    Map as MapIcon, 
    MessageSquare, 
    Sparkles, 
    TrendingUp,
    Globe,
    ChevronRight,
    PlayCircle,
    Star,
    Award,
    Heart
} from 'lucide-react';
import L from 'leaflet';

const soccerBallSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="22" fill="#ffffff" stroke="#000000" stroke-width="2"/>
  <path d="M24 12 L14 18 L16 30 L32 30 L34 18 Z" fill="#000000"/>
  <path d="M24 2 L24 12 M2 16 L14 18 M8 40 L16 30 M40 40 L32 30 M46 16 L34 18" stroke="#000000" stroke-width="2" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="22" fill="none" stroke="#000000" stroke-width="2"/>
</svg>
`);


const soccerIcon = new L.Icon({
  iconUrl: `data:image/svg+xml,${soccerBallSvg}`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const isLoggedIn = !!localStorage.getItem('accessToken');
// Fix for default marker icons in Leaflet with React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const LandingPage = () => {
    const mapCenter: [number, number] = [41.7151, 44.8271]; // Tbilisi

    return (
        <div className="bg-[#fcf8f2] dark:bg-gray-900 text-[#1a1a1a] dark:text-gray-100 min-h-screen font-sans selection:bg-emerald-100 dark:selection:bg-emerald-900">
            {/* HERO SECTION */}
            <section className="relative pt-20 pb-20 overflow-hidden bg-gradient-to-b from-[#fcf8f2] to-transparent dark:from-emerald-900/10 dark:to-gray-900">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center gap-12">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/50 dark:bg-orange-900/20 text-[#a34e36] dark:text-orange-300 text-sm font-bold mb-6 border-ink">
                                <Star className="w-4 h-4 fill-current" />
                                <span className="manga-title text-xs">Where Legends Are Born</span>
                            </div>
                            <h1 className="text-6xl lg:text-8xl font-serif font-bold tracking-tighter mb-6 leading-[0.9] text-[#1a1a1a] dark:text-white uppercase italic">
                                Your Dream <br />
                                <span className="text-[#2a4d37] dark:text-emerald-500 underline decoration-[#a34e36] decoration-4 underline-offset-8">Starts Here.</span>
                            </h1>
                            <p className="text-xl text-gray-700 dark:text-gray-400 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-serif italic">
                                TALANTI isn't just an app. It's the heartbeat of every kid with a ball and a dream.
                                We don't just find clubs; we find your future. Because every champion was once a local hero.
                            </p>
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                                <Link
                                    to={isLoggedIn ? "/feed" : "/login"}
                                    className="px-10 py-5 bg-[#1a1a1a] hover:bg-[#2d2d2d] text-white rounded-xl manga-title text-xl shadow-etched transition-all hover:-translate-y-1 flex items-center gap-2 group border-ink"
                                >
                                    Start Your Journey <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <button onClick={() => alert("Watch Demo coming soon!")} className="px-10 py-5 bg-white dark:bg-gray-800 border-ink rounded-xl manga-title text-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2">
                                    <PlayCircle className="w-5 h-5 text-[#a34e36]" /> The Story
                                </button>
                            </div>

                            <div className="mt-12 flex items-center justify-center lg:justify-start gap-6 text-gray-500 dark:text-gray-400">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="w-12 h-12 rounded-full border-ink bg-white dark:bg-gray-700 flex items-center justify-center text-[10px] font-black">
                                            U{i}
                                        </div>
                                    ))}
                                    <div className="w-12 h-12 rounded-full border-ink bg-[#a34e36] text-white flex items-center justify-center text-[10px] font-black">
                                        +2k
                                    </div>
                                </div>
                                <p className="text-base font-serif font-bold text-[#1a1a1a] dark:text-gray-300 italic tracking-tight">Join 2,000+ warriors chasing the glory</p>
                            </div>
                        </div>

                        <div className="flex-1 relative">
                            {/* Decorative Elements - Subtle ink wash */}
                            <div className="absolute -top-12 -left-12 w-64 h-64 bg-[#a34e36]/5 dark:bg-orange-600/10 rounded-full blur-3xl"></div>
                            <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-[#2a4d37]/5 dark:bg-emerald-600/10 rounded-full blur-3xl"></div>

                            <div className="relative bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-etched border-ink rotate-1 hover:rotate-0 transition-transform duration-700">
                                <div className="bg-[#fcf8f2] dark:bg-gray-900 rounded-xl overflow-hidden border-ink">
                                    <div className="p-6 border-b border-ink flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#a34e36] rounded-lg flex items-center justify-center text-white border-ink">
                                                <Award className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="h-3 w-24 bg-gray-300 dark:bg-gray-700 rounded-full mb-2"></div>
                                                <div className="h-2 w-16 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
                                            </div>
                                        </div>
                                        <Shield className="text-[#2a4d37] w-6 h-6" />
                                    </div>
                                    <div className="p-6 space-y-4 text-center">
                                        <p className="manga-title text-xs text-[#a34e36]">Top Talent of the Week</p>
                                        <div className="aspect-video bg-gradient-to-br from-[#2d2d2d] to-[#1a1a1a] rounded-xl flex flex-col items-center justify-center text-white p-4 shadow-inner border-ink">
                                            <TrendingUp className="w-12 h-12 mb-2 opacity-50" />
                                            <p className="manga-title text-xl">THE NEXT NO. 10</p>
                                        </div>
                                        <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded-full border border-ink/10"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Floating Stats - Etched card */}
                            <div className="absolute -bottom-6 -left-6 bg-white dark:bg-gray-800 p-5 rounded-xl shadow-etched border-ink animate-bounce-slow">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-50 dark:bg-orange-900/30 text-[#a34e36] rounded-lg border border-[#a34e36]/30">
                                        <Heart className="w-5 h-5 fill-current" />
                                    </div>
                                    <div>
                                        <div className="manga-title text-[10px] text-gray-400">Heart & Soul</div>
                                        <div className="manga-title text-sm">Passion First</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* MAP SECTION - The World of Football */}
            <section className="py-20 bg-[#fcf8f2] dark:bg-gray-800/20 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-5xl lg:text-6xl font-serif font-bold mb-4 italic tracking-tighter uppercase underline decoration-[#2a4d37] decoration-4">The World is Your Pitch.</h2>
                        <p className="text-xl text-gray-700 dark:text-gray-400 max-w-3xl mx-auto font-serif italic">
                            Right now, thousands of scouts are looking for talent. We've mapped out every opportunity,
                            from the dusty local fields to the grand stadiums. Find where you belong.
                        </p>
                    </div>

                    <div className="relative rounded-3xl overflow-hidden shadow-etched border-ink h-[500px] group">
                        <MapContainer
                            center={mapCenter}
                            zoom={12}
                            className="h-full w-full z-0 grayscale-[0.5] contrast-[1.2] sepia-[0.2]"
                            scrollWheelZoom={false}
                            preferCanvas={true}
                        >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <Marker position={mapCenter} icon={soccerIcon}>
                                <Popup>
                                    <div className="p-2 text-center">
                                        <p className="manga-title text-[#a34e36]">TALANTI Hub</p>
                                        <p className="text-xs text-gray-700 font-bold italic">The center of grassroots football</p>
                                    </div>
                                </Popup>
                            </Marker>
                        </MapContainer>

                        {/* Map Overlay for Inspiring Feel */}
                        <div className="absolute inset-0 bg-black/5 pointer-events-none group-hover:bg-transparent transition-colors duration-700"></div>

                        <div className="absolute bottom-8 left-8 right-8 flex flex-col md:flex-row items-center justify-between gap-6 pointer-events-none">
                            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-6 rounded-xl shadow-etched border-ink pointer-events-auto max-w-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-[#a34e36] rounded-lg flex items-center justify-center text-white border-ink">
                                        <MapIcon className="w-5 h-5" />
                                    </div>
                                    <p className="manga-title text-sm">Real-time Map</p>
                                </div>
                                <p className="text-sm text-gray-800 dark:text-gray-400 leading-relaxed font-serif italic">
                                    "I found my first club on TALANTI. The map showed me a tryout just 2 miles away that I never knew about."
                                </p>
                                <p className="mt-2 manga-title text-[10px] text-[#a34e36]">— Luka, U17 Striker</p>
                            </div>

                            <Link to="/map" className="pointer-events-auto px-8 py-4 bg-[#a34e36] text-white rounded-xl manga-title shadow-etched border-ink hover:bg-[#8e442f] transition-all transform hover:-translate-y-1 flex items-center gap-3">
                                Explore The Full Map <ChevronRight className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* FEATURES GRID */}
            <section className="py-24 bg-[#fcf8f2] dark:bg-gray-900">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-5xl lg:text-7xl font-serif font-bold mb-4 tracking-tighter italic uppercase underline decoration-[#a34e36] decoration-4">EVERYTHING YOU NEED TO CONQUER.</h2>
                        <p className="text-gray-800 dark:text-gray-400 max-w-2xl mx-auto text-xl font-serif italic">
                            Success isn't given, it's earned. We give you the armor and the weapons. You bring the fire.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { title: "Live Talent Map", desc: "Visualize your destiny. Find local clubs, secret tryouts, and the warriors you'll one day call teammates.", icon: MapIcon },
                            { title: "Verified Legacies", desc: "Connect with clubs that have soul. View their history, their trophies, and the scouts waiting for your arrival.", icon: Shield },
                            { title: "The War Room", desc: "Direct messaging with the decision-makers. No middlemen. Just you, your talent, and your next big move.", icon: MessageSquare },
                            { title: "Global Feed", desc: "The pulse of the pitch. Share your goals, watch your rivals, and get inspired by stories from every corner of the earth.", icon: Globe },
                            { title: "AI Scouting", desc: "Your digital mentor. Let our AI analyze your path and connect you with the dream club that needs your specific magic.", icon: Sparkles }
                        ].map((feature, idx) => (
                            <div key={idx} className="p-10 rounded-2xl bg-white dark:bg-gray-800/50 border-ink hover:border-[#a34e36] transition-all group relative overflow-hidden shadow-etched">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                    <feature.icon className="w-20 h-20" />
                                </div>
                                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 text-[#2a4d37] rounded-xl flex items-center justify-center mb-8 border-ink">
                                    <feature.icon className="w-8 h-8" />
                                </div>
                                <h3 className="manga-title text-2xl mb-4">{feature.title}</h3>
                                <p className="text-gray-800 dark:text-gray-400 leading-relaxed font-serif italic text-sm">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}

                        {/* Feature 6 - CTA Box */}
                        <div className="p-10 rounded-2xl bg-[#a34e36] text-white shadow-etched border-ink flex flex-col items-center justify-center text-center transform hover:-translate-y-1 transition-all">
                            <Star className="w-12 h-12 mb-4 text-[#fcf8f2] opacity-50" />
                            <h3 className="manga-title text-2xl mb-2">YOUR TIME IS NOW.</h3>
                            <Link to="/feed" className="bg-white text-black px-6 py-3 rounded-lg manga-title mt-4 hover:bg-gray-100 transition-colors border-ink">START FREE</Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* CALL TO ACTION */}
            <section className="py-24 bg-[#a34e36] relative overflow-hidden border-y border-ink shadow-inner">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
                </div>

                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-5xl lg:text-7xl font-serif font-bold text-white mb-8 tracking-tighter italic uppercase underline decoration-white/20 decoration-8">DON'T LET THE DREAM STAY A DREAM.</h2>
                    <p className="text-2xl text-[#fcf8f2] font-serif italic mb-12 uppercase tracking-tighter opacity-90">
                        The pitch is waiting. The scouts are watching. The world is ready for your story.
                        Join the brotherhood of TALANTI today and write your name in history.
                    </p>
                    // Inside LandingPage.tsx, find the "CREATE YOUR LEGACY" button section
                    <div className="flex flex-wrap items-center justify-center gap-6">
                        <Link
                            to="/signup"
                            className="px-12 py-6 bg-white text-black rounded-xl font-black text-2xl hover:scale-105 transition-all shadow-[8px_8px_0px_0px_#10b981]"
                        >
                            CREATE YOUR LEGACY
                        </Link>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="py-12 bg-white dark:bg-gray-950 border-t border-ink/10">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-3xl font-serif font-bold text-[#2a4d37] tracking-tighter italic uppercase">TALANTI</div>
                    <div className="text-gray-400 dark:text-gray-500 text-sm font-serif italic">© 2026 TALANTI — BEYOND THE GAME.</div>
                    <div className="flex gap-8 text-sm font-serif italic">
                        <a href="#" className="text-gray-400 hover:text-[#2a4d37] transition-colors">Privacy</a>
                        <a href="#" className="text-gray-400 hover:text-[#2a4d37] transition-colors">Terms</a>
                        <a href="#" className="text-gray-400 hover:text-[#2a4d37] transition-colors">Support</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};
