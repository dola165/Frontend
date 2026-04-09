import { Link } from 'react-router-dom';
import { MessageSquare, Radar } from 'lucide-react';
import { MiniMap } from '../MiniMap';

interface RightSidebarProps {
    mockContacts: { id: number; name: string; role: string; online: boolean }[];
    activeQuickChat: { id: number } | null;
    setActiveQuickChat: (contact: { id: number; name: string; role: string; online: boolean }) => void;
}

export const RightSidebar = ({ mockContacts, activeQuickChat, setActiveQuickChat }: RightSidebarProps) => (
    <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--app-header-height)+24px)] flex flex-col gap-4">
            <section className="bg-surface border border-subtle">
                <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Map Utility</p>
                        <p className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-primary">Local Scan</p>
                    </div>
                    <Radar className="h-4 w-4 accent-primary" />
                </div>
                <div className="overflow-hidden border-t border-[color:var(--accent-muted)]">
                    <MiniMap />
                </div>
            </section>

            <section className="bg-surface border border-subtle">
                <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Communication Panel</p>
                        <p className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-primary">Active Contacts</p>
                    </div>
                    <Link to="/messages" className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary transition-colors hover:text-primary">
                        Open
                    </Link>
                </div>

                <div className="divide-y divide-[color:var(--border-subtle)]">
                    {mockContacts.map((contact) => {
                        const active = activeQuickChat?.id === contact.id;

                        return (
                            <button
                                key={contact.id}
                                type="button"
                                onClick={() => setActiveQuickChat(contact)}
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                                    active ? 'bg-elevated' : 'hover:bg-base'
                                }`}
                            >
                                <div className="relative shrink-0">
                                    <div className="flex h-9 w-9 items-center justify-center border border-subtle bg-base text-xs font-black uppercase text-primary">
                                        {contact.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span
                                        className={`absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border border-[color:var(--bg-surface)] ${
                                            contact.online ? 'bg-[color:var(--accent-primary)]' : 'bg-[color:var(--text-muted)]'
                                        }`}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-primary">{contact.name}</p>
                                    <div className="mt-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-secondary">
                                        <span>{contact.role}</span>
                                        <span className="h-1 w-1 rounded-full bg-[color:var(--accent-muted)]" />
                                        <span className={contact.online ? 'accent-primary' : ''}>{contact.online ? 'Online' : 'Offline'}</span>
                                    </div>
                                </div>
                                <MessageSquare className={`h-4 w-4 ${active ? 'accent-primary' : 'text-secondary'}`} />
                            </button>
                        );
                    })}
                </div>
            </section>
        </div>
    </aside>
);
