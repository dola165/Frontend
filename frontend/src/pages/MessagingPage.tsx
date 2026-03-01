import { useEffect, useState, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import {
    User as UserIcon, Users, CircleDot, Plus,
    Search, UserPlus, Info, X, Image as ImageIcon,
    ExternalLink, HeartHandshake, ShoppingCart
} from 'lucide-react';

// --- CUSTOM ICON: Football Boot Striking (No ball, no leg) ---
const StrikingBootIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M5 4v4c0 2.2 1.3 4.1 3.3 5.1l4 2.2c1.8 1 3.9 1.1 5.8.3l2.4-.9c1.3-.5 1.8-2.1 1.2-3.3l-.5-.9C20.5 9.4 19.3 8.9 18 9h-3c-1.5 0-2.8-1-3.2-2.4L11 4H5z" />
        <path d="M9 17v2" />
        <path d="M13 18.5v2" />
        <path d="M17 19.5v2" />
        <path d="M2 10h2" />
        <path d="M1 14h3" />
    </svg>
);

interface ChatMessage {
    user: string;
    message: string;
}

export const MessagingPage = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [connected, setConnected] = useState(false);
    const [activeUsers, setActiveUsers] = useState<string[]>([]);

    // NEW: State to toggle the right-hand Media/Links drawer
    const [showDetails, setShowDetails] = useState(false);

    const clientRef = useRef<Client | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentUser = "react_dev";

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const client = new Client({
            brokerURL: 'ws://localhost:8080/ws-chat',
            reconnectDelay: 5000,
            onConnect: () => {
                setConnected(true);

                client.subscribe('/topic/messages', (msg) => {
                    const newMsg = JSON.parse(msg.body) as ChatMessage;
                    setMessages((prev) => [...prev, newMsg]);
                });

                client.subscribe('/topic/users', (msg) => {
                    const usersList = JSON.parse(msg.body) as string[];
                    setActiveUsers(usersList);
                });

                client.publish({ destination: '/app/connect', body: currentUser });
                client.publish({ destination: '/app/request-users' });
            },
            onDisconnect: () => {
                setConnected(false);
            }
        });

        client.activate();
        clientRef.current = client;

        return () => {
            if (client.connected) {
                client.publish({ destination: '/app/disconnect', body: currentUser });
            }
            client.deactivate();
        };
    }, []);

    const sendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (input.trim() && clientRef.current?.connected) {
            const payload = { user: currentUser, message: input.trim() };
            clientRef.current.publish({
                destination: '/app/message',
                body: JSON.stringify(payload)
            });
            setInput('');
        }
    };

    return (
        <div className="h-full w-full bg-white dark:bg-gray-800 flex overflow-hidden">

            {/* LEFT SIDEBAR (Contacts/Rooms) */}
            <div className="w-1/3 min-w-[300px] max-w-[400px] border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col relative">

                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3 h-16 shrink-0">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold shadow-inner">
                        RD
                    </div>
                    <h2 className="font-bold text-gray-900 dark:text-white">Chats</h2>
                </div>

                <div className="overflow-y-auto flex-1 p-3 pb-24">
                    {/* Active Global Room */}
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div className="w-12 h-12 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white shadow-inner flex-shrink-0">
                            <Users className="w-6 h-6" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-gray-900 dark:text-white truncate">Global Grassroots</h3>
                                <span className="text-[10px] uppercase text-emerald-500 flex items-center gap-1 font-bold">
                                    <CircleDot className="w-2.5 h-2.5" /> Live
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {connected ? "Connected to server" : "Connecting..."}
                            </p>
                        </div>
                    </div>

                    {/* Active Users List */}
                    <div className="mt-8 px-2">
                        <h4 className="text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Online Now</h4>
                        {activeUsers.length === 0 && <p className="text-sm text-gray-500 ml-1">Just you.</p>}
                        {activeUsers.map(u => (
                            <div key={u} className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg cursor-pointer transition-colors">
                                <div className="relative">
                                    <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300">
                                        <UserIcon className="w-5 h-5" />
                                    </div>
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-gray-50 dark:border-gray-900 rounded-full"></div>
                                </div>
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{u}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* LEFT SIDEBAR BOTTOM: Create/Invite Button */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent dark:from-gray-900/50 dark:via-gray-900/50 pt-10">
                    <button
                        onClick={() => alert("Create Group / Invite feature coming soon!")}
                        className="w-full flex items-center justify-center gap-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-400 py-3 rounded-xl font-extrabold text-sm transition-colors border border-blue-200 dark:border-blue-800/50 shadow-sm"
                    >
                        <Plus className="w-5 h-5" /> New Chat / Invite
                    </button>
                </div>
            </div>

            {/* MIDDLE (Chat Window) */}
            <div className="flex-1 flex flex-col bg-[#e5ddd5] dark:bg-[#0b141a] relative transition-all duration-300">

                {/* Chat Header */}
                <div className="h-16 px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10 shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <h2 className="font-bold text-gray-900 dark:text-white text-lg">Global Grassroots</h2>
                        {connected && <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wide">CONNECTED</span>}
                    </div>

                    {/* Chat Header Bonus Options */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        <button className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" title="Search in chat">
                            <Search className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" title="Invite User">
                            <UserPlus className="w-5 h-5" />
                        </button>
                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

                        {/* Toggle Details Panel Button */}
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className={`p-2 rounded-full transition-colors ${
                                showDetails
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                            title="Media, Links, and Docs"
                        >
                            <Info className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scrollbar-hide">
                    {messages.map((msg, index) => {
                        const isMe = msg.user === currentUser;
                        return (
                            <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                {!isMe && <span className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1 mb-1">{msg.user}</span>}
                                <div className={`px-4 py-2.5 rounded-2xl max-w-[70%] shadow-sm ${
                                    isMe
                                        ? 'bg-blue-600 text-white rounded-br-sm'
                                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm border border-gray-100 dark:border-gray-700'
                                }`}>
                                    <p className="text-[15px] leading-relaxed">{msg.message}</p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shrink-0">
                    <form onSubmit={sendMessage} className="flex gap-3 items-center">
                        <button type="button" className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title="Attach Media">
                            <Plus className="w-6 h-6" />
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={!connected}
                            placeholder={connected ? "Type a message..." : "Connecting to chat..."}
                            className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || !connected}
                            className="w-12 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-full flex items-center justify-center transition-colors shadow-sm flex-shrink-0"
                            title="Kick Message"
                        >
                            <StrikingBootIcon className="w-6 h-6 mr-0.5 mt-0.5" />
                        </button>
                    </form>
                </div>
            </div>

            {/* RIGHT DRAWER: Chat Details (Media, Links, Docs) */}
            {showDetails && (
                <div className="w-80 min-w-[320px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col animate-in slide-in-from-right-10 duration-300 shrink-0">

                    {/* Drawer Header */}
                    <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shrink-0">
                        <button onClick={() => setShowDetails(false)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="font-bold text-gray-900 dark:text-white">Group Info</h2>
                    </div>

                    {/* Drawer Content */}
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-hide">

                        {/* Media Section */}
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Media</h3>
                                <button className="text-xs font-bold text-blue-600 dark:text-blue-400">View All</button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                                    <ImageIcon className="w-6 h-6 text-gray-400" />
                                </div>
                                <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                                    <ImageIcon className="w-6 h-6 text-gray-400" />
                                </div>
                                <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                                    <span className="text-xs font-bold text-gray-500">+12</span>
                                </div>
                            </div>
                        </section>

                        <hr className="border-gray-100 dark:border-gray-700" />

                        {/* Links Section */}
                        <section>
                            <h3 className="text-sm font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Pinned Links</h3>
                            <div className="flex flex-col gap-3">
                                {/* Store Link */}
                                <a href="#" className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors group">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400 mt-0.5 group-hover:scale-110 transition-transform">
                                        <ShoppingCart className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1">
                                            Talanti Official Store <ExternalLink className="w-3 h-3 text-gray-400" />
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">store.talanti.ge/gear</p>
                                    </div>
                                </a>

                                {/* GoFundMe Link */}
                                <a href="#" className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors group">
                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-600 dark:text-emerald-400 mt-0.5 group-hover:scale-110 transition-transform">
                                        <HeartHandshake className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1">
                                            Grassroots Pitch Fund <ExternalLink className="w-3 h-3 text-gray-400" />
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">gofundme.com/f/tbilisi-pitch</p>
                                    </div>
                                </a>
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
};