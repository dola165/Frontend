import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { MiniMap } from '../MiniMap';

interface RightSidebarProps {
    mockContacts: { id: number; name: string; role: string; online: boolean }[];
    activeQuickChat: { id: number } | null;
    setActiveQuickChat: (contact: any) => void;
}

export const RightSidebar = ({ mockContacts, activeQuickChat, setActiveQuickChat }: RightSidebarProps) => {
    return (
        <aside className="hidden lg:block lg:col-span-3 xl:col-span-3 relative">
            <div className="sticky top-32 flex flex-col gap-6">
                <div className="rounded-sm overflow-hidden border-2 border-slate-300 dark:border-slate-800 shadow-lg bg-[#f4fbf9] dark:bg-[#151f28]">
                    <MiniMap />
                </div>

                <div className="bg-[#f4fbf9] dark:bg-[#151f28] p-4 rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-lg">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-emerald-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-xs flex items-center gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> Active Comms
                        </h3>
                        <Link to="/messages" className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-emerald-500">See All</Link>
                    </div>
                    <div className="flex flex-col gap-1">
                        {mockContacts.map(contact => (
                            <button
                                key={contact.id}
                                onClick={() => setActiveQuickChat(contact)}
                                className={`flex items-center gap-3 p-2 rounded-sm transition-colors w-full text-left border-l-2 ${
                                    activeQuickChat?.id === contact.id
                                        ? 'bg-emerald-50 dark:bg-[#0f172a] border-emerald-500'
                                        : 'border-transparent hover:bg-sky-50 dark:hover:bg-[#0f172a] hover:border-sky-500'
                                }`}
                            >
                                <div className="relative shrink-0">
                                    <div className="w-8 h-8 rounded-sm bg-sky-100 dark:bg-slate-800 text-sky-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold">
                                        {contact.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    {contact.online && <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border border-white dark:border-[#151f28] rounded-full"></div>}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{contact.name}</p>
                                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider truncate">{contact.role}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-[#eef8ff] dark:bg-[#151f28] p-4 rounded-sm border-2 border-slate-300 dark:border-slate-800 shadow-lg">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-widest text-xs pb-2 border-b border-sky-100 dark:border-slate-800">Database Wisdom</h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                        {[
                            { quote: "He who does not work, neither shall he eat.", author: "Vladimir Lenin" },
                            { quote: "Better to die on your feet than to live on your knees.", author: "Emiliano Zapata" },
                        ].map((q, idx) => (
                            <div key={idx} className="border-l-2 border-emerald-500 pl-3">
                                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">"{q.quote}"</p>
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">- {q.author}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
};
