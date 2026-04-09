import { Link, useLocation } from 'react-router-dom';
import {
    BellRing,
    Building2,
    HeartHandshake,
    Home,
    Map as MapIcon,
    MessageSquare,
    Settings,
    Shield,
    ShieldCheck,
    ShoppingCart,
    User
} from 'lucide-react';
import { resolveNavigationKey } from './navigation';

interface LeftSidebarProps {
    user: { id?: number; username?: string; role?: string; fullName?: string } | null;
    myClubId: number | null;
}

const navGroups = (user: LeftSidebarProps['user']) => {
    const workspace = [
        { id: 'feed', path: '/feed', icon: Home, label: 'Network Feed' },
        { id: 'map', path: '/map', icon: MapIcon, label: 'Intel Map' },
        { id: 'clubs', path: '/clubs', icon: Shield, label: 'Club Directory' },
        { id: 'my-club', path: '/my-club', icon: Building2, label: 'My Club' },
        { id: 'messages', path: '/messages', icon: MessageSquare, label: 'Communications' },
        { id: 'notifications', path: '/notifications?scope=personal', icon: BellRing, label: 'Notifications' }
    ];

    const utility = [
        { id: 'profile', path: user ? `/profile/${user.id}` : '/login', icon: User, label: 'Public Profile' },
        { id: 'account', path: user ? '/account' : '/login', icon: Settings, label: 'Account Center' },
        { id: 'store', path: '/store', icon: ShoppingCart, label: 'Store' },
        { id: 'charity', path: '/charity', icon: HeartHandshake, label: 'Support' }
    ];

    if (user?.role === 'SYSTEM_ADMIN') {
        utility.unshift({ id: 'admin', path: '/admin', icon: ShieldCheck, label: 'Admin' });
    }

    return { workspace, utility };
};

const NavSection = ({
    title,
    items,
    activeKey
}: {
    title: string;
    items: Array<{ id: string; path: string; icon: typeof Home; label: string }>;
    activeKey: string | null;
}) => (
    <section className="bg-surface border border-subtle">
        <div className="border-b border-subtle px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">{title}</p>
        </div>
        <div className="divide-y divide-[color:var(--border-subtle)]">
            {items.map((item) => {
                const active = activeKey === item.id;
                const Icon = item.icon;

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center justify-between gap-3 border-l-2 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] transition-colors ${
                            active
                                ? 'border-accent-muted bg-elevated text-primary'
                                : 'border-transparent text-secondary hover:bg-base hover:text-primary'
                        }`}
                    >
                        <span className="flex items-center gap-3">
                            <Icon className={`h-4 w-4 ${active ? 'accent-primary' : ''}`} />
                            {item.label}
                        </span>
                        {active && <span className="h-px w-5 bg-[color:var(--accent-muted)]" aria-hidden="true" />}
                    </Link>
                );
            })}
        </div>
    </section>
);

export const LeftSidebar = ({ user, myClubId }: LeftSidebarProps) => {
    const location = useLocation();
    const { workspace, utility } = navGroups(user);
    const activeKey = resolveNavigationKey(location.pathname, myClubId);

    return (
        <aside className="hidden lg:block">
            <div className="sticky top-[calc(var(--app-header-height)+24px)] flex flex-col gap-4">
                <NavSection title="Destinations" items={workspace} activeKey={activeKey} />
                <NavSection title="Utilities" items={utility} activeKey={activeKey} />
            </div>
        </aside>
    );
};
