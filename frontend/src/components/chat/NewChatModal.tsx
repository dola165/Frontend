import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Users, Check, ArrowRight, ArrowLeft, Camera, MessageCircle } from 'lucide-react';
import { chatApi, type UserSearchResult } from '../../api/chat';
import { getStoredUserId } from '../../utils/authStorage';

interface NewChatModalProps {
    open: boolean;
    onClose: () => void;
    onConversationCreated: (conversationId: number) => void;
}

type ChatMode = 'DIRECT' | 'GROUP';
type GroupStep = 'select' | 'name';

export function NewChatModal({ open, onClose, onConversationCreated }: NewChatModalProps) {
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
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    const currentUserId = Number(getStoredUserId() || 0);

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
                        (u) => u.id !== currentUserId && !selectedUsers.some((s) => s.id === u.id),
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

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-[420px] rounded-2xl overflow-hidden shadow-2xl"
                style={{ backgroundColor: 'var(--chat-card, #ffffff)' }}>

                {/* ── Header bar (WhatsApp-style green) ─────────────── */}
                <div className="flex items-center gap-3 px-5 h-14"
                    style={{ backgroundColor: 'var(--chat-header-bg, #075e54)' }}>
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
                        {isNameStep ? 'New group' : 'New chat'}
                    </h2>

                    {/* Next / Create in header */}
                    {isGroup && !isNameStep && selectedUsers.length > 0 && (
                        <button
                            onClick={goToNameStep}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/20 text-white text-sm font-semibold hover:bg-white/30 transition-colors"
                        >
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* ── Mode tabs ─────────────────────────────────────── */}
                {!isNameStep && (
                    <div className="flex border-b"
                        style={{ borderColor: 'var(--chat-card-border, rgba(0,0,0,0.08))' }}>
                        {([
                            { key: 'DIRECT' as ChatMode, label: 'Message', icon: MessageCircle },
                            { key: 'GROUP' as ChatMode, label: 'Group', icon: Users },
                        ]).map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => switchMode(key)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all relative"
                                style={{
                                    color: mode === key
                                        ? 'var(--chat-header-bg, #075e54)'
                                        : 'var(--chat-text-muted, #9ca3af)',
                                }}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                                {mode === key && (
                                    <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full"
                                        style={{ backgroundColor: 'var(--chat-header-bg, #075e54)' }} />
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Name step (GROUP mode) ────────────────────────── */}
                {isNameStep && (
                    <div className="px-5 py-6">
                        {/* Group icon placeholder */}
                        <div className="flex justify-center mb-6">
                            <div className="w-24 h-24 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: 'var(--chat-surface, #f0ede7)' }}>
                                <Camera className="w-8 h-8" style={{ color: 'var(--chat-text-muted, #9ca93f)' }} />
                            </div>
                        </div>

                        {/* Group name input */}
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Group name"
                            maxLength={100}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                            className="w-full py-3 text-base font-medium text-center border-b-2 outline-none transition-colors"
                            style={{
                                backgroundColor: 'transparent',
                                color: 'var(--chat-text-primary)',
                                borderColor: groupName.trim()
                                    ? 'var(--chat-header-bg, #075e54)'
                                    : 'var(--chat-card-border, rgba(0,0,0,0.08))',
                            }}
                        />

                        {/* Selected users chips */}
                        {selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-5">
                                {selectedUsers.map((user) => (
                                    <span
                                        key={user.id}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                                        style={{
                                            backgroundColor: 'rgba(7,94,84,0.08)',
                                            color: 'var(--chat-header-bg, #075e54)',
                                        }}
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
                            <p className="text-sm text-red-500 text-center mt-4">{error}</p>
                        )}

                        {/* Create button */}
                        <button
                            onClick={handleCreateGroup}
                            disabled={creating || !groupName.trim() || selectedUsers.length === 0}
                            className="w-full mt-6 py-3 rounded-full text-white text-sm font-bold tracking-wide transition-all hover:opacity-90 disabled:opacity-30"
                            style={{ backgroundColor: 'var(--chat-header-bg, #075e54)' }}
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

                {/* ── Select participants step ──────────────────────── */}
                {!isNameStep && (
                    <>
                        {/* Selected chips */}
                        {isGroup && selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-5 pt-3 pb-1">
                                {selectedUsers.map((user) => (
                                    <span
                                        key={user.id}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                                        style={{
                                            backgroundColor: 'rgba(7,94,84,0.08)',
                                            color: 'var(--chat-header-bg, #075e54)',
                                        }}
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

                        {/* Search */}
                        <div className="px-5 py-3">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--chat-text-muted)]" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={
                                        isGroup ? 'Type a name to add people...' : 'Search name or username...'
                                    }
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                                    style={{
                                        backgroundColor: 'var(--chat-input-bg, #f5f2eb)',
                                        color: 'var(--chat-text-primary)',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Results */}
                        <div className="max-h-72 overflow-y-auto border-t"
                            style={{ borderColor: 'var(--chat-card-border, rgba(0,0,0,0.06))' }}>
                            {error && (
                                <p className="px-5 py-6 text-sm text-red-500 text-center">{error}</p>
                            )}

                            {loading && (
                                <div className="flex items-center justify-center py-10 gap-2 text-[var(--chat-text-muted)]">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Searching...</span>
                                </div>
                            )}

                            {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
                                <p className="px-5 py-10 text-sm text-[var(--chat-text-muted)] text-center">
                                    No users found.
                                </p>
                            )}

                            {!loading && query.trim().length < 2 && results.length === 0 && (
                                <p className="px-5 py-10 text-sm text-[var(--chat-text-muted)] text-center">
                                    Type a name to find users.
                                </p>
                            )}

                            {results.map((user) => {
                                const isSelected = selectedUsers.some((s) => s.id === user.id);
                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => handleSelectUser(user)}
                                        disabled={creating && mode === 'DIRECT'}
                                        className="w-full flex items-center gap-3 px-5 py-3 transition-colors disabled:opacity-50 text-left hover:bg-[var(--chat-card-hover)]"
                                    >
                                        {/* Avatar */}
                                        <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                                            style={{
                                                backgroundColor: 'rgba(7,94,84,0.12)',
                                                color: 'var(--chat-header-bg, #075e54)',
                                            }}>
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

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate"
                                                style={{ color: 'var(--chat-text-primary)' }}>
                                                {user.fullName || user.username}
                                            </p>
                                            <p className="text-xs text-[var(--chat-text-muted)]">
                                                @{user.username}
                                                {user.position ? `  ·  ${user.position}` : ''}
                                            </p>
                                        </div>

                                        {/* Checkbox (GROUP mode) */}
                                        {isGroup && (
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                                isSelected ? '' : ''
                                            }`}
                                            style={
                                                isSelected
                                                    ? { backgroundColor: 'var(--chat-header-bg, #075e54)', borderColor: 'var(--chat-header-bg, #075e54)' }
                                                    : { borderColor: 'var(--chat-card-border, rgba(0,0,0,0.15))' }
                                            }>
                                                {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
