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
        <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen font-sans selection:bg-blue-100 dark:selection:bg-blue-900">
            {/* HERO SECTION */}
            <section className="relative pt-20 pb-20 overflow-hidden bg-gradient-to-b from-blue-50/50 to-white dark:from-gray-800/20 dark:to-gray-900">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center gap-12">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-sm font-bold mb-6 animate-pulse">
                                <Star className="w-4 h-4 fill-current" />
                                <span>Where Legends Are Born</span>
                            </div>
                            <h1 className="text-5xl lg:text-7xl font-black tracking-tighter mb-6 leading-[1.1]">
                                Your Dream <br />
                                <span className="text-blue-600 dark:text-blue-500">Starts Here.</span>
                            </h1>
                            <p className="text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                                TALANTI isn't just an app. It's the heartbeat of every kid with a ball and a dream. 
                                We don't just find clubs; we find your future. Because every champion was once a local hero.
                            </p>
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                                <Link to="/feed" className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-blue-500/30 transition-all hover:scale-105 flex items-center gap-2 group">
                                    Start Your Journey <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <button onClick={() => alert("Watch Demo coming soon!")} className="px-10 py-5 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl font-bold text-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2">
                                    <PlayCircle className="w-5 h-5" /> The Story
                                </button>
                            </div>
                            
                            <div className="mt-12 flex items-center justify-center lg:justify-start gap-6 text-gray-500 dark:text-gray-400">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="w-12 h-12 rounded-full border-4 border-white dark:border-gray-900 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold">
                                            U{i}
                                        </div>
                                    ))}
                                    <div className="w-12 h-12 rounded-full border-4 border-white dark:border-gray-900 bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                                        +2k
                                    </div>
                                </div>
                                <p className="text-base font-bold text-gray-700 dark:text-gray-300">Join 2,000+ warriors chasing the glory</p>
                            </div>
                        </div>
                        
                        <div className="flex-1 relative">
                            {/* Decorative Elements */}
                            <div className="absolute -top-12 -left-12 w-64 h-64 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl"></div>
                            <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-indigo-400/20 dark:bg-indigo-600/10 rounded-full blur-3xl"></div>
                            
                            <div className="relative bg-white dark:bg-gray-800 p-2 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 rotate-2 hover:rotate-0 transition-transform duration-500">
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-[2rem] overflow-hidden border border-gray-100 dark:border-gray-800">
                                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
                                                <Award className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded-full mb-2"></div>
                                                <div className="h-2 w-16 bg-gray-100 dark:bg-gray-800 rounded-full"></div>
                                            </div>
                                        </div>
                                        <Shield className="text-blue-600 w-6 h-6" />
                                    </div>
                                    <div className="p-6 space-y-4 text-center">
                                        <p className="text-sm font-black italic text-gray-500 uppercase tracking-[0.2em]">Top Talent of the Week</p>
                                        <div className="aspect-video bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex flex-col items-center justify-center text-white p-4 shadow-inner">
                                            <TrendingUp className="w-12 h-12 mb-2" />
                                            <p className="font-black text-xl">THE NEXT NO. 10</p>
                                        </div>
                                        <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Floating Stats */}
                            <div className="absolute -bottom-6 -left-6 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-2xl border-2 border-blue-500/20 animate-bounce-slow">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg">
                                        <Heart className="w-5 h-5 fill-current" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Heart & Soul</div>
                                        <div className="text-lg font-black italic">Passion First</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* MAP SECTION - The World of Football */}
            <section className="py-20 bg-gray-50 dark:bg-gray-800/20 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl lg:text-5xl font-black mb-4">The World is Your Pitch.</h2>
                        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto font-medium">
                            Right now, thousands of scouts are looking for talent. We've mapped out every opportunity, 
                            from the dusty local fields to the grand stadiums. Find where you belong.
                        </p>
                    </div>

                    <div className="relative rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white dark:border-gray-800 h-[500px] group">
                        <MapContainer
                            center={mapCenter}
                            zoom={12}
                            className="h-full w-full z-0"
                            scrollWheelZoom={false}
                        >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <Marker position={mapCenter}>
                                <Popup>
                                    <div className="p-2 text-center">
                                        <p className="font-bold text-blue-600">TALANTI Hub</p>
                                        <p className="text-xs text-gray-500">The center of grassroots football</p>
                                    </div>
                                </Popup>
                            </Marker>
                        </MapContainer>
                        
                        {/* Map Overlay for Inspiring Feel */}
                        <div className="absolute inset-0 bg-blue-900/10 pointer-events-none group-hover:bg-transparent transition-colors duration-700"></div>
                        
                        <div className="absolute bottom-8 left-8 right-8 flex flex-col md:flex-row items-center justify-between gap-6 pointer-events-none">
                            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-6 rounded-[2rem] shadow-xl border border-white/20 pointer-events-auto max-w-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white animate-pulse">
                                        <MapIcon className="w-5 h-5" />
                                    </div>
                                    <p className="font-black text-gray-900 dark:text-white uppercase tracking-wider">Real-time Map</p>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                    "I found my first club on TALANTI. The map showed me a tryout just 2 miles away that I never knew about."
                                </p>
                                <p className="mt-2 text-xs font-bold text-blue-600">— Luka, U17 Striker</p>
                            </div>

                            <Link to="/map" className="pointer-events-auto px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl font-black shadow-2xl hover:bg-blue-600 hover:text-white transition-all transform hover:-translate-y-1 flex items-center gap-3">
                                Explore The Full Map <ChevronRight className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* FEATURES GRID */}
            <section className="py-24 bg-white dark:bg-gray-900">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl lg:text-6xl font-black mb-4 tracking-tighter italic">EVERYTHING YOU NEED TO CONQUER.</h2>
                        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg font-medium">
                            Success isn't given, it's earned. We give you the armor and the weapons. You bring the fire.
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="p-10 rounded-[2.5rem] bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent hover:border-blue-500/20 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
                                <MapIcon className="w-20 h-20" />
                            </div>
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mb-8 group-hover:rotate-6 transition-transform shadow-sm">
                                <MapIcon className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black mb-4 uppercase italic">Live Talent Map</h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                Visualize your destiny. Find local clubs, secret tryouts, and the warriors you'll one day call teammates.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="p-10 rounded-[2.5rem] bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent hover:border-blue-500/20 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
                                <Shield className="w-20 h-20" />
                            </div>
                            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center mb-8 group-hover:rotate-6 transition-transform shadow-sm">
                                <Shield className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black mb-4 uppercase italic">Verified Legacies</h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                Connect with clubs that have soul. View their history, their trophies, and the scouts waiting for your arrival.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="p-10 rounded-[2.5rem] bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent hover:border-blue-500/20 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
                                <MessageSquare className="w-20 h-20" />
                            </div>
                            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-2xl flex items-center justify-center mb-8 group-hover:rotate-6 transition-transform shadow-sm">
                                <MessageSquare className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black mb-4 uppercase italic">The War Room</h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                Direct messaging with the decision-makers. No middlemen. Just you, your talent, and your next big move.
                            </p>
                        </div>

                        {/* Feature 4 */}
                        <div className="p-10 rounded-[2.5rem] bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent hover:border-blue-500/20 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
                                <Globe className="w-20 h-20" />
                            </div>
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl flex items-center justify-center mb-8 group-hover:rotate-6 transition-transform shadow-sm">
                                <Globe className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black mb-4 uppercase italic">Global Feed</h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                The pulse of the pitch. Share your goals, watch your rivals, and get inspired by stories from every corner of the earth.
                            </p>
                        </div>

                        {/* Feature 5 */}
                        <div className="p-10 rounded-[2.5rem] bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent hover:border-blue-500/20 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform">
                                <Sparkles className="w-20 h-20" />
                            </div>
                            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center mb-8 group-hover:rotate-6 transition-transform shadow-sm">
                                <Sparkles className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black mb-4 uppercase italic">AI Scouting</h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                Your digital mentor. Let our AI analyze your path and connect you with the dream club that needs your specific magic.
                            </p>
                        </div>

                        {/* Feature 6 */}
                        <div className="p-10 rounded-[2.5rem] bg-blue-600 text-white shadow-xl shadow-blue-500/30 flex flex-col items-center justify-center text-center transform hover:scale-105 transition-all">
                            <Star className="w-12 h-12 mb-4 text-yellow-300 animate-spin-slow" />
                            <h3 className="text-2xl font-black mb-2 italic">YOUR TIME IS NOW.</h3>
                            <Link to="/feed" className="bg-white text-blue-600 px-6 py-3 rounded-xl font-black mt-4 hover:bg-gray-100 transition-colors">START FREE</Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* CALL TO ACTION */}
            <section className="py-24 bg-blue-600 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
                </div>
                
                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-4xl lg:text-6xl font-black text-white mb-8 tracking-tighter italic">DON'T LET THE DREAM STAY A DREAM.</h2>
                    <p className="text-xl text-blue-10 font-medium mb-12 text-blue-100">
                        The pitch is waiting. The scouts are watching. The world is ready for your story. 
                        Join the brotherhood of TALANTI today and write your name in history.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-6">
                        <Link to="/feed" className="px-12 py-6 bg-white text-blue-600 rounded-2xl font-black text-2xl shadow-2xl hover:scale-110 transition-all">
                            CREATE YOUR LEGACY
                        </Link>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="py-12 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-2xl font-black text-blue-600 tracking-tighter">TALANTI</div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm font-bold italic">© 2026 TALANTI — BEYOND THE GAME.</div>
                    <div className="flex gap-8 text-sm font-medium">
                        <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">Privacy</a>
                        <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">Terms</a>
                        <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">Support</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};
