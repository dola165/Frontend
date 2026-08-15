import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Loader2, Users, Check, ArrowLeft, UserPlus, MessageCircle } from 'lucide-react';
import { chatApi, type UserSearchResult } from '../../api/chat';
import { getStoredUserId } from '../../utils/authStorage';

interface NewChatModalProps {
    open: boolean;
    onClose: () => void;
    onConversationCreated: (conversationId: number) => void;
    recentContacts: UserSearchResult[];
}

type ChatMode = 'DIRECT' | 'GROUP';
type GroupStep = 'select' | 'name';

export function NewChatModal({ open, onClose, onConversationCreated, recentContacts }: NewChatModalProps) {
    const [mode, setMode] = useState<ChatMode>('DIRECT');
    const [groupStep, setGroupStep] = useState<GroupStep>('select');
    const [groupName, setGroupName] = useState('');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentUserId = Number(getStoredUserId() || 0);

    // Deduplicate recent contacts against selected users; hide minors
    // (belt-and-braces — the server already filters the allowlist).
    const visibleRecents = useMemo(
        () => recentContacts.filter(
            (c) => c.id !== currentUserId && !c.isMinor && !selectedUsers.some((s) => s.id === c.id),
        ).slice(0, 8),
        [recentContacts, currentUserId, selectedUsers],
    );

    useEffect(() => {
        if (open) {
            setMode('DIRECT');
            setGroupStep('select');
            setGroupName('');
            setQuery('');
            setResults([]);
            setSelectedUsers([]);
            setError(null);
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [open]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (query.trim().length < 2) {
            setResults([]);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await chatApi.searchUsers(query.trim());
                setResults(
                    res.data.content.filter(
                        (u) => u.id !== currentUserId && !u.isMinor && !selectedUsers.some((s) => s.id === u.id),
                    ),
                );
            } catch {
                setError('Search failed. Try again.');
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, currentUserId, selectedUsers]);

    const handleSelectUser = (user: UserSearchResult) => {
        if (mode === 'DIRECT') {
            createDirectChat(user);
            return;
        }
        setSelectedUsers((prev) => [...prev, user]);
        setQuery('');
        setResults([]);
    };

    const handleRemoveSelected = (userId: number) => {
        setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
    };

    const goToNameStep = () => {
        if (selectedUsers.length === 0) return;
        setGroupStep('name');
        setTimeout(() => nameInputRef.current?.focus(), 150);
    };

    const createDirectChat = async (user: UserSearchResult) => {
        setCreating(true);
        setError(null);
        try {
            const res = await chatApi.createConversation({
                contextType: 'DIRECT',
                participantIds: [user.id],
            });
            onConversationCreated(res.data.id);
            onClose();
        } catch {
            setError('Failed to create conversation.');
        } finally {
            setCreating(false);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            setError('Please enter a group name.');
            return;
        }
        if (selectedUsers.length === 0) {
            setError('Select at least one participant.');
            return;
        }

        setCreating(true);
        setError(null);
        try {
            const res = await chatApi.createConversation({
                contextType: 'GROUP',
                name: groupName.trim(),
                participantIds: selectedUsers.map((u) => u.id),
            });
            onConversationCreated(res.data.id);
            onClose();
        } catch {
            setError('Failed to create group.');
        } finally {
            setCreating(false);
        }
    };

    const switchMode = (m: ChatMode) => {
        setMode(m);
        setGroupStep('select');
        setSelectedUsers([]);
        setGroupName('');
        setError(null);
        setQuery('');
        setResults([]);
    };

    if (!open) return null;

    const isGroup = mode === 'GROUP';
    const isNameStep = isGroup && groupStep === 'name';
    const showSearchResults = query.trim().length >= 2;
    const showRecentContacts = !showSearchResults && visibleRecents.length > 0 && !isNameStep;

    return (
        <div className="theme-overlay-strong fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] backdrop-blur-sm">
            <div
                className="absolute inset-0"
                onClick={onClose}
            />

            <div className="theme-surface theme-border relative z-10 w-full max-w-[420px] overflow-hidden rounded-xl border shadow-2xl">

                {/* ── Header ──────────────────────────────────────── */}
                <div className="flex items-center gap-3 bg-[#16a34a] px-5 h-14">
                    {isNameStep ? (
                        <button
                            onClick={() => setGroupStep('select')}
                            className="p-1 -ml-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={onClose}
                            className="p-1 -ml-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                    <h2 className="font-semibold text-white text-base flex-1">
                        {isNameStep ? 'New Group' : 'New Chat'}
                    </h2>

                    {/* Next button (group mode with selections) */}
                    {isGroup && !isNameStep && selectedUsers.length > 0 && (
                        <button
                            onClick={goToNameStep}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/20 text-white text-sm font-semibold hover:bg-white/30 transition-colors"
                        >
                            Next
                            <ArrowLeft className="w-4 h-4 rotate-180" />
                        </button>
                    )}
                </div>

                {/* ── Name step (GROUP mode) ──────────────────────── */}
                {isNameStep && (
                    <div className="px-5 py-6">
                        <div className="flex justify-center mb-6">
                            <div className="w-24 h-24 rounded-full flex items-center justify-center bg-[#0f1117]">
                                <Users className="w-8 h-8 text-muted" />
                            </div>
                        </div>

                        <input
                            ref={nameInputRef}
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Group name"
                            maxLength={100}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                            className="w-full py-3 text-base font-semibold text-center bg-transparent text-[#f4f4f5] border-b-2 outline-none transition-colors focus:border-[#16a34a]"
                            style={{
                                borderColor: groupName.trim()
                                    ? '#16a34a'
                                    : '#ffffff0d',
                            }}
                        />

                        {selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-5">
                                {selectedUsers.map((user) => (
                                    <span
                                        key={user.id}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-[#16a34a]-soft text-[#16a34a]"
                                    >
                                        {(user.fullName || user.username)}
                                        <button
                                            onClick={() => handleRemoveSelected(user.id)}
                                            className="p-0.5 rounded-full hover:bg-white/50 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {error && (
                            <p className="text-sm font-semibold text-[color:var(--state-danger)] text-center mt-4">{error}</p>
                        )}

                        <button
                            onClick={handleCreateGroup}
                            disabled={creating || !groupName.trim() || selectedUsers.length === 0}
                            className="w-full mt-6 py-3 rounded-full text-white text-sm font-bold tracking-wide transition-all hover:opacity-90 disabled:opacity-30 bg-[#16a34a]"
                        >
                            {creating ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Creating...
                                </span>
                            ) : (
                                `Create group with ${selectedUsers.length} ${selectedUsers.length === 1 ? 'person' : 'people'}`
                            )}
                        </button>
                    </div>
                )}

                {/* ── Select participants step ────────────────────── */}
                {!isNameStep && (
                    <>
                        {/* Mode action buttons */}
                        <div className="flex gap-3 px-5 pt-4 pb-2">
                            <button
                                onClick={() => switchMode('DIRECT')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                                    mode === 'DIRECT'
                                        ? 'bg-[#16a34a] text-white'
                                        : 'text-[#a1a1aa] hover:bg-elevated border border-[#ffffff0d]'
                                }`}
                            >
                                <UserPlus className="w-4 h-4" />
                                New Contact
                            </button>
                            <button
                                onClick={() => switchMode('GROUP')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                                    mode === 'GROUP'
                                        ? 'bg-[#16a34a] text-white'
                                        : 'text-[#a1a1aa] hover:bg-elevated border border-[#ffffff0d]'
                                }`}
                            >
                                <Users className="w-4 h-4" />
                                New Group
                            </button>
                        </div>

                        {/* Selected chips (GROUP mode) */}
                        {isGroup && selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-5 pt-3 pb-1">
                                {selectedUsers.map((user) => (
                                    <span
                                        key={user.id}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-[#16a34a]-soft text-[#16a34a]"
                                    >
                                        {(user.fullName || user.username)}
                                        <button
                                            onClick={() => handleRemoveSelected(user.id)}
                                            className="p-0.5 rounded-full hover:bg-white/50 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Search bar */}
                        <div className="px-5 py-3">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={
                                        isGroup
                                            ? 'Search people to add...'
                                            : 'Search name or username...'
                                    }
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none bg-[#0f1117] text-[#f4f4f5] placeholder:text-[#a1a1aa]"
                                />
                            </div>
                        </div>

                        {/* Content area */}
                        <div className="max-h-72 overflow-y-auto border-t border-[#ffffff0d]">

                            {error && (
                                <p className="px-5 py-6 text-sm font-semibold text-[color:var(--state-danger)] text-center">{error}</p>
                            )}

                            {loading && (
                                <div className="flex items-center justify-center py-10 gap-2 text-muted">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Searching...</span>
                                </div>
                            )}

                            {/* Search results */}
                            {showSearchResults && !loading && results.length === 0 && !error && (
                                <p className="px-5 py-10 text-sm text-muted text-center">
                                    No users found.
                                </p>
                            )}

                            {results.map((user) => {
                                const isSelected = selectedUsers.some((s) => s.id === user.id);
                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => handleSelectUser(user)}
                                        disabled={creating && mode === 'DIRECT'}
                                        className="w-full flex items-center gap-3 px-5 py-3 transition-colors disabled:opacity-50 text-left hover:bg-elevated"
                                    >
                                        <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 bg-[#16a34a]-soft text-[#16a34a]">
                                            {user.avatarUrl ? (
                                                <img
                                                    src={user.avatarUrl}
                                                    alt=""
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                (user.fullName || user.username).charAt(0).toUpperCase()
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate text-[#f4f4f5]">
                                                {user.fullName || user.username}
                                            </p>
                                            <p className="text-xs text-muted">
                                                @{user.username}
                                                {user.position ? `  ·  ${user.position}` : ''}
                                            </p>
                                        </div>

                                        {isGroup && (
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                                isSelected
                                                    ? 'border-[#16a34a] bg-[#16a34a]'
                                                    : 'border-[#ffffff0d]'
                                            }`}>
                                                {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}

                            {/* Recent / frequent contacts (when not searching) */}
                            {showRecentContacts && (
                                <div className="pb-1">
                                    <p className="px-5 py-3 text-xs font-semibold  text-muted">
                                        Recent Contacts
                                    </p>
                                    {visibleRecents.map((user) => (
                                        <button
                                            key={user.id}
                                            onClick={() => handleSelectUser(user)}
                                            disabled={creating && mode === 'DIRECT'}
                                            className="w-full flex items-center gap-3 px-5 py-2.5 transition-colors disabled:opacity-50 text-left hover:bg-elevated"
                                        >
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-[#16a34a]-soft text-[#16a34a]">
                                                {user.avatarUrl ? (
                                                    <img
                                                        src={user.avatarUrl}
                                                        alt=""
                                                        className="w-full h-full rounded-full object-cover"
                                                    />
                                                ) : (
                                                    (user.fullName || user.username).charAt(0).toUpperCase()
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate text-[#f4f4f5]">
                                                    {user.fullName || user.username}
                                                </p>
                                                <p className="text-xs text-muted">
                                                    @{user.username}
                                                </p>
                                            </div>

                                            {isGroup ? (
                                                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 border-[#ffffff0d]">
                                                </div>
                                            ) : (
                                                <MessageCircle className="w-4 h-4 text-muted" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Empty state — no recents, no search */}
                            {!showSearchResults && !showRecentContacts && !loading && (
                                <p className="px-5 py-10 text-sm text-muted text-center">
                                    Search for people to start a conversation.
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
