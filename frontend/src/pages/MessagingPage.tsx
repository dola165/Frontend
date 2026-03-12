import { useEffect, useState, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import {
     Users, CircleDot,
     Info, X,
} from 'lucide-react';

// --- CUSTOM ICON ---
const StrikingBootIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M5 4v4c0 2.2 1.3 4.1 3.3 5.1l4 2.2c1.8 1 3.9 1.1 5.8.3l2.4-.9c1.3-.5 1.8-2.1 1.2-3.3l-.5-.9C20.5 9.4 19.3 8.9 18 9h-3c-1.5 0-2.8-1-3.2-2.4L11 4H5z" />
        <path d="M9 17v2" /><path d="M13 18.5v2" /><path d="M17 19.5v2" /><path d="M2 10h2" /><path d="M1 14h3" />
    </svg>
);

// MUST MATCH BACKEND: ChatMessageResponse.java
interface ChatMessageResponse {
    id: number;
    conversationId: number;
    senderId: number;
    senderName: string;
    content: string;
    createdAt: string;
}

export const MessagingPage = () => {
    const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
    const [input, setInput] = useState('');
    const [connected, setConnected] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const clientRef = useRef<Client | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Hardcoded for MVP to match backend assumption
    const currentUserId = 1;
    const currentConversationId = 1; // "Global Grassroots"

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const client = new Client({
            brokerURL: 'ws://localhost:8080/ws-chat',
            reconnectDelay: 5000,
            onConnect: () => {
                console.log("Connected to WebSocket!");
                setConnected(true);

                // 1. Subscribe to the exact conversation room frequency
                client.subscribe(`/topic/chat.${currentConversationId}`, (msg) => {
                    const newMsg = JSON.parse(msg.body) as ChatMessageResponse;
                    setMessages((prev) => [...prev, newMsg]);
                });
            },
            onDisconnect: () => {
                console.log("Disconnected from WebSocket!");
                setConnected(false);
            }
        });

        client.activate();
        clientRef.current = client;

        return () => {
            client.deactivate();
        };
    }, []);

    const sendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (input.trim() && clientRef.current?.connected) {

            // 2. Payload must match ChatMessageRequest.java
            const payload = {
                conversationId: currentConversationId,
                content: input.trim()
            };

            // 3. Send to the exact @MessageMapping endpoint
            clientRef.current.publish({
                destination: '/app/chat.send',
                body: JSON.stringify(payload)
            });
            setInput('');
        }
    };

    return (
        <div className="h-full w-full bg-white dark:bg-gray-800 flex overflow-hidden">

            {/* LEFT SIDEBAR */}
            <div className="w-1/3 min-w-[300px] max-w-[400px] border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col relative">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3 h-16 shrink-0">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold shadow-inner">RD</div>
                    <h2 className="font-bold text-gray-900 dark:text-white">Chats</h2>
                </div>

                <div className="overflow-y-auto flex-1 p-3 pb-24">
                    {/* Active Global Room */}
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-emerald-500 cursor-pointer transition-colors">
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
                            <p className="text-sm text-emerald-600 dark:text-emerald-500 truncate mt-0.5 font-medium">
                                {connected ? "Connection established." : "Connecting..."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* MIDDLE (Chat Window) */}
            <div className="flex-1 flex flex-col bg-[#e5ddd5] dark:bg-[#0b141a] relative transition-all duration-300">

                <div className="h-16 px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10 shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <h2 className="font-bold text-gray-900 dark:text-white text-lg">Global Grassroots</h2>
                        {connected && <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wide">CONNECTED</span>}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                        <button onClick={() => setShowDetails(!showDetails)} className={`p-2 rounded-full transition-colors ${showDetails ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            <Info className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scrollbar-hide">
                    {messages.map((msg) => {
                        const isMe = msg.senderId === currentUserId;
                        return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                {!isMe && <span className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1 mb-1">{msg.senderName}</span>}
                                <div className={`px-4 py-2.5 rounded-2xl max-w-[70%] shadow-sm ${
                                    isMe
                                        ? 'bg-blue-600 text-white rounded-br-sm'
                                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm border border-gray-100 dark:border-gray-700'
                                }`}>
                                    <p className="text-[15px] leading-relaxed">{msg.content}</p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shrink-0">
                    <form onSubmit={sendMessage} className="flex gap-3 items-center">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={!connected}
                            placeholder={connected ? "Type a message..." : "Connecting to chat..."}
                            className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                        />
                        <button type="submit" disabled={!input.trim() || !connected} className="w-12 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-full flex items-center justify-center transition-colors shadow-sm flex-shrink-0">
                            <StrikingBootIcon className="w-6 h-6 mr-0.5 mt-0.5" />
                        </button>
                    </form>
                </div>
            </div>

            {/* RIGHT DRAWER */}
            {showDetails && (
                <div className="w-80 min-w-[320px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col shrink-0 animate-in slide-in-from-right-10 duration-300">
                    <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shrink-0">
                        <button onClick={() => setShowDetails(false)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="font-bold text-gray-900 dark:text-white">Group Info</h2>
                    </div>
                </div>
            )}
        </div>
    );
};