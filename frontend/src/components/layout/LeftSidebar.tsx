import { Link } from 'react-router-dom';
import { BellRing, Home, Map as MapIcon, Shield, Building2, MessageSquare, User, ShoppingCart, HeartHandshake } from 'lucide-react';

interface LeftSidebarProps {
    user: { id?: number; username?: string; role?: string; fullName?: string } | null;
}

export const LeftSidebar = ({ user }: LeftSidebarProps) => {
    return (
        <aside className="hidden lg:block lg:col-span-3 xl:col-span-3">
            <div className="sticky top-32 flex flex-col gap-6">
                <div className="flex flex-col gap-1.5">
                    {[
                        { path: "/feed", icon: Home, label: "Network Feed" },
                        { path: "/map", icon: MapIcon, label: "Intel Map" },
                        { path: "/clubs", icon: Shield, label: "Club Database" },
                        { path: "/my-club", icon: Building2, label: "My Club" },
                        { path: "/messages", icon: MessageSquare, label: "Communications" },
                        { path: user ? `/profile/${user.id}` : "#", icon: User, label: "My Profile" },
                        { path: "/notifications?scope=personal", icon: BellRing, label: "Notifications" }
                    ].map((item, idx) => (
                        <Link key={idx} to={item.path} onClick={() => !user && item.label === "My Profile" && alert('Please login')}
                              className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-900 px-4 py-3 rounded-sm border-2 border-transparent hover:border-slate-900 hover:shadow-[4px_4px_0px_0px_#020617] transition-all">
                            <item.icon className="w-5 h-5" /> {item.label}
                        </Link>
                    ))}
                </div>

                <div className="flex flex-col gap-4">
                    <Link to="/store" className="block bg-white dark:bg-[#151f28] p-4 rounded-sm border border-slate-300 dark:border-slate-800 shadow-lg hover:-translate-y-1 transition-all group">
                        <div className="flex items-center gap-2 mb-2">
                            <ShoppingCart className="w-5 h-5 text-orange-500" />
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-widest">Armory</h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">Acquire official gear and training equipment.</p>
                        <button className="text-[10px] font-bold text-slate-900 bg-orange-500 hover:bg-orange-400 py-1.5 px-3 rounded-sm w-full uppercase tracking-widest transition-colors">Enter Store</button>
                    </Link>
                    <Link to="/charity" className="block bg-white dark:bg-[#151f28] p-4 rounded-sm border border-slate-300 dark:border-slate-800 shadow-lg hover:-translate-y-1 transition-all group">
                        <div className="flex items-center gap-2 mb-2">
                            <HeartHandshake className="w-5 h-5 text-emerald-500" />
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-widest">Support</h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">Fund local grassroots player campaigns.</p>
                        <button className="text-[10px] font-bold text-slate-900 bg-emerald-500 hover:bg-emerald-400 py-1.5 px-3 rounded-sm w-full uppercase tracking-widest transition-colors">View Campaigns</button>
                    </Link>
                </div>
            </div>
        </aside>
    );
};
