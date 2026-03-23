import { BellRing, Building2, BriefcaseBusiness, CalendarDays, LayoutDashboard, MapPin, Trophy, Users } from 'lucide-react';

interface ClubSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    club: {
        type?: string;
        addressText?: string;
        isOfficial?: boolean;
        statusLabel?: string;
        memberCount?: number;
        followerCount?: number;
    };
    canManageClub: boolean;
    onOpenNotifications?: () => void;
}

export const ClubSidebar = ({ activeTab, setActiveTab, club, canManageClub, onOpenNotifications }: ClubSidebarProps) => {
    const sidebarItems = [
        { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
        { id: 'squads', icon: Users, label: 'Squads' },
        { id: 'honours', icon: Trophy, label: 'Honours' },
        { id: 'opportunities', icon: BriefcaseBusiness, label: 'Opportunities' },
        { id: 'calendar', icon: CalendarDays, label: 'Calendar' }
    ];
    const showNotifications = canManageClub && Boolean(onOpenNotifications);

    return (
        <aside className="w-full lg:w-[280px] xl:w-[320px] shrink-0">
            <div className="lg:sticky lg:top-24 flex flex-col gap-4">
                <div className="theme-surface-strong theme-border-strong rounded-lg border-2 p-3 shadow-lg dark:shadow-[0_12px_28px_rgba(0,0,0,0.55)]">
                    <div className="flex flex-col gap-2">
                        {sidebarItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-all group border-2 ${isActive
                                        ? 'theme-surface-inset text-emerald-600 dark:text-emerald-500 theme-border-strong shadow-md dark:shadow-[0_4px_10px_rgba(0,0,0,0.4)]'
                                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:theme-surface-inset hover:text-emerald-600 dark:hover:text-emerald-500'}`}
                                >
                                    <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                    <span className="font-bold text-sm tracking-wide">{item.label}</span>
                                </button>
                            );
                        })}
                        {showNotifications && (
                            <button
                                type="button"
                                onClick={onOpenNotifications}
                                className="flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-all group border-2 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:theme-surface-inset hover:text-emerald-600 dark:hover:text-emerald-500"
                            >
                                <BellRing className="w-5 h-5 transition-transform group-hover:scale-110" />
                                <span className="font-bold text-sm tracking-wide">Notifications</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="theme-surface theme-border rounded-lg border-2 p-5 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                        <Building2 className="w-3.5 h-3.5" />
                        {canManageClub ? 'Command View' : 'Visitor View'}
                    </div>

                    <div className="mt-4 space-y-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Club Type</p>
                            <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{club?.type || 'Unspecified'}</p>
                        </div>

                        <div className="flex items-start gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                            <MapPin className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                            <span>{club?.addressText || 'Location pending confirmation'}</span>
                        </div>

                        <div className="theme-surface-strong theme-border rounded-lg border p-3">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Verification</p>
                            <p className="mt-2 text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                {club?.statusLabel || (club?.isOfficial ? 'Verified' : 'Unverified')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};
