import { MediaImage } from '../ui/MediaImage';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Loader2, Users, Check, ArrowLeft, UserPlus, MessageCircle } from 'lucide-react';
import { chatApi, type UserSearchResult } from '../../api/chat';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { usePanelMotion } from '../ui/usePanelMotion';
import { getStoredUserId, isCurrentAuthSession } from '../../utils/authStorage';
import { useAuth } from '../../context/AuthContext';
import { useMessageCopy } from './messageCopy';
import { useChatPeopleSearch } from './useChatPeopleSearch';
import { PeopleSearchStatus } from './PeopleSearchStatus';

interface NewChatModalProps {
    open: boolean;
    onClose: () => void;
    onConversationCreated: (conversationId: number) => void;
    recentContacts: UserSearchResult[];
}

type ChatMode = 'DIRECT' | 'GROUP';
type GroupStep = 'select' | 'name';

export function NewChatModal(props: NewChatModalProps) {
    const { sessionId } = useAuth();
    return props.open ? <NewChatContent key={sessionId} {...props} /> : null;
}
function NewChatContent({ open, onClose: finishClose, onConversationCreated, recentContacts }: NewChatModalProps) {
    const copy = useMessageCopy();
    const { sessionId } = useAuth();
    const mounted = useRef(true);
    const createPending = useRef(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const motion = usePanelMotion(finishClose);
    const onClose = motion.close;
    const [mode, setMode] = useState<ChatMode>('DIRECT');
    const [groupStep, setGroupStep] = useState<GroupStep>('select');
    const [groupName, setGroupName] = useState('');
    const [query, setQuery] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useDialogFocus(open, dialogRef, onClose, inputRef);

    const currentUserId = Number(getStoredUserId() || 0);
    const peopleSearch = useChatPeopleSearch(query, [currentUserId, ...selectedUsers.map(person => person.id)]);
    const { results, loading } = peopleSearch;

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
            setSelectedUsers([]);
            setError(null);
        }
    }, [open]);

    const handleSelectUser = (user: UserSearchResult) => {
        if (mode === 'DIRECT') {
            createDirectChat(user);
            return;
        }
        setSelectedUsers((prev) => [...prev, user]);
        setQuery('');
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
        if (createPending.current) return;
        createPending.current = true;
        setCreating(true);
        setError(null);
        try {
            const res = await chatApi.createConversation({
                contextType: 'DIRECT',
                participantIds: [user.id],
            });
            if (!mounted.current || !isCurrentAuthSession(sessionId)) return;
            onConversationCreated(res.data.id);
            onClose();
        } catch {
            if (mounted.current && isCurrentAuthSession(sessionId)) setError('Could not start the conversation.');
        } finally {
            createPending.current = false;
            if (mounted.current) setCreating(false);
        }
    };

    const handleCreateGroup = async () => {
        if (createPending.current) return;
        if (!groupName.trim()) {
            setError('Give the group a name.');
            return;
        }
        if (selectedUsers.length === 0) {
            setError('Choose at least one person.');
            return;
        }

        createPending.current = true;
        setCreating(true);
        setError(null);
        try {
            const res = await chatApi.createConversation({
                contextType: 'GROUP',
                name: groupName.trim(),
                participantIds: selectedUsers.map((u) => u.id),
            });
            if (!mounted.current || !isCurrentAuthSession(sessionId)) return;
            onConversationCreated(res.data.id);
            onClose();
        } catch {
            if (mounted.current && isCurrentAuthSession(sessionId)) setError('Could not create the group.');
        } finally {
            createPending.current = false;
            if (mounted.current) setCreating(false);
        }
    };

    const switchMode = (m: ChatMode) => {
        setMode(m);
        setGroupStep('select');
        setSelectedUsers([]);
        setGroupName('');
        setError(null);
        setQuery('');
    };

    if (!open) return null;

    const isGroup = mode === 'GROUP';
    const isNameStep = isGroup && groupStep === 'name';
    const showSearchResults = query.trim().length >= 2;
    const showRecentContacts = !showSearchResults && visibleRecents.length > 0 && !isNameStep;

    return (
        <div className="app-motion-portal app-motion-backdrop theme-overlay-strong fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] backdrop-blur-sm" data-closing={motion.closing}>
            <div
                className="absolute inset-0"
                onClick={onClose}
            />

            <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={copy('New Chat')} className="app-motion-dialog theme-surface theme-border relative z-10 w-full max-w-[420px] overflow-hidden rounded-xl border shadow-2xl" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd}>

                {/* ── Header ──────────────────────────────────────── */}
                <div className="flex items-center gap-3 bg-[var(--color-accent)] px-5 h-14">
                    {isNameStep ? (
                        <button
                            onClick={() => setGroupStep('select')}
                            aria-label={copy('Back')}
                            className="p-1 -ml-1 rounded-full text-[color:var(--color-on-accent)]/80 hover:text-[color:var(--color-on-accent)] hover:bg-[color:var(--color-ink)]/10 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={onClose}
                            aria-label={copy('Close new chat')}
                            className="p-1 -ml-1 rounded-full text-[color:var(--color-on-accent)]/80 hover:text-[color:var(--color-on-accent)] hover:bg-[color:var(--color-ink)]/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                    <h2 className="font-semibold text-[color:var(--color-on-accent)] text-base flex-1">
                        {isNameStep ? copy('New group', 'ახალი ჯგუფი') : copy('New chat', 'ახალი ჩატი')}
                    </h2>

                    {/* Next button (group mode with selections) */}
                    {isGroup && !isNameStep && selectedUsers.length > 0 && (
                        <button
                            onClick={goToNameStep}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[color:var(--color-ink)]/20 text-[color:var(--color-on-accent)] text-sm font-semibold hover:bg-[color:var(--color-ink)]/30 transition-colors"
                        >
                            {copy('Next', 'შემდეგი')}
                            <ArrowLeft className="w-4 h-4 rotate-180" />
                        </button>
                    )}
                </div>

                {/* ── Name step (GROUP mode) ──────────────────────── */}
                {isNameStep && (
                    <div className="px-5 py-6">
                        <div className="flex justify-center mb-6">
                            <div className="w-24 h-24 rounded-full flex items-center justify-center bg-[var(--color-surface)]">
                                <Users className="w-8 h-8 text-muted" />
                            </div>
                        </div>

                        <input
                            ref={nameInputRef}
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder={copy('Group name', 'ჯგუფის სახელი')}
                            aria-label={copy('Group name')}
                            maxLength={100}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                            className="w-full py-3 text-base font-semibold text-center bg-transparent text-[var(--color-text)] border-b-2 outline-none transition-colors focus:border-[var(--color-accent)]"
                            style={{
                                borderColor: groupName.trim()
                                    ? 'var(--color-accent)'
                                    : 'color-mix(in srgb, var(--color-text) 5.1%, transparent)',
                            }}
                        />

                        {selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-5">
                                {selectedUsers.map((user) => (
                                    <span
                                        key={user.id}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-[var(--color-accent)]-soft text-[var(--color-accent)]"
                                    >
                                        {(user.fullName || user.username)}
                                        <button
                                            onClick={() => handleRemoveSelected(user.id)}
                                            aria-label={copy(`Remove ${user.fullName || user.username}`, `ამოშლა: ${user.fullName || user.username}`)}
                                            className="p-0.5 rounded-full hover:bg-[color:var(--color-elevated)]/50 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {error && (
                            <p role="alert" className="text-sm font-semibold text-[color:var(--state-danger)] text-center mt-4">{copy(error)}</p>
                        )}

                        <button
                            onClick={handleCreateGroup}
                            disabled={creating || !groupName.trim() || selectedUsers.length === 0}
                            className="w-full mt-6 py-3 rounded-full text-[var(--color-on-accent)] text-sm font-bold tracking-wide transition-all hover:opacity-90 disabled:opacity-30 bg-[var(--color-accent)]"
                        >
                            {creating ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {copy('Creating…', 'იქმნება…')}
                                </span>
                            ) : (
                                copy(`Create group with ${selectedUsers.length} ${selectedUsers.length === 1 ? 'person' : 'people'}`, `ჯგუფის შექმნა (${selectedUsers.length})`)
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
                                        ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                                        : 'text-[var(--color-secondary)] hover:bg-elevated border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]'
                                }`}
                            >
                                <UserPlus className="w-4 h-4" />
                                {copy('New contact', 'ახალი კონტაქტი')}
                            </button>
                            <button
                                onClick={() => switchMode('GROUP')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                                    mode === 'GROUP'
                                        ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                                        : 'text-[var(--color-secondary)] hover:bg-elevated border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]'
                                }`}
                            >
                                <Users className="w-4 h-4" />
                                {copy('New group', 'ახალი ჯგუფი')}
                            </button>
                        </div>

                        {/* Selected chips (GROUP mode) */}
                        {isGroup && selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-5 pt-3 pb-1">
                                {selectedUsers.map((user) => (
                                    <span
                                        key={user.id}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-[var(--color-accent)]-soft text-[var(--color-accent)]"
                                    >
                                        {(user.fullName || user.username)}
                                        <button
                                            onClick={() => handleRemoveSelected(user.id)}
                                            aria-label={copy(`Remove ${user.fullName || user.username}`, `ამოშლა: ${user.fullName || user.username}`)}
                                            className="p-0.5 rounded-full hover:bg-[color:var(--color-elevated)]/50 transition-colors"
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
                                    onChange={(e) => { setQuery(e.target.value); setError(null); }}
                                    aria-label={copy('Search people')}
                                    placeholder={
                                        isGroup
                                            ? copy('Search people to add…', 'მოძებნეთ დასამატებელი ადამიანები…')
                                            : copy('Search a name…', 'მოძებნეთ სახელი…')
                                    }
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-secondary)]"
                                />
                            </div>
                        </div>

                        {/* Content area */}
                        <div className="max-h-72 overflow-y-auto border-t border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]">

                            {error && (
                                <p role="alert" className="px-5 py-6 text-sm font-semibold text-[color:var(--state-danger)] text-center">{copy(error)}</p>
                            )}

                            <PeopleSearchStatus loading={loading} failed={peopleSearch.failed} onRetry={peopleSearch.retry} />

                            {/* Search results */}
                            {showSearchResults && !loading && results.length === 0 && !error && !peopleSearch.failed && (
                                <p className="px-5 py-10 text-sm text-muted text-center">
                                    {copy('Nobody found.', 'ვერავინ მოიძებნა.')}
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
                                        <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 bg-[var(--color-accent)]-soft text-[var(--color-accent)]">
                                            {user.avatarUrl ? (
                                                <MediaImage
                                                    src={user.avatarUrl}
                                                    alt=""
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                (user.fullName || user.username).charAt(0).toUpperCase()
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate text-[var(--color-text)]">
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
                                                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                                                    : 'border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]'
                                            }`}>
                                                {isSelected && <Check className="w-3 h-3 text-[color:var(--color-text)]" strokeWidth={3} />}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}

                            {/* Recent / frequent contacts (when not searching) */}
                            {showRecentContacts && (
                                <div className="pb-1">
                                    <p className="px-5 py-3 text-xs font-semibold  text-muted">
                                        {copy('Recent contacts', 'ბოლო კონტაქტები')}
                                    </p>
                                    {visibleRecents.map((user) => (
                                        <button
                                            key={user.id}
                                            onClick={() => handleSelectUser(user)}
                                            disabled={creating && mode === 'DIRECT'}
                                            className="w-full flex items-center gap-3 px-5 py-2.5 transition-colors disabled:opacity-50 text-left hover:bg-elevated"
                                        >
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-[var(--color-accent)]-soft text-[var(--color-accent)]">
                                                {user.avatarUrl ? (
                                                    <MediaImage
                                                        src={user.avatarUrl}
                                                        alt=""
                                                        className="w-full h-full rounded-full object-cover"
                                                    />
                                                ) : (
                                                    (user.fullName || user.username).charAt(0).toUpperCase()
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate text-[var(--color-text)]">
                                                    {user.fullName || user.username}
                                                </p>
                                                <p className="text-xs text-muted">
                                                    @{user.username}
                                                </p>
                                            </div>

                                            {isGroup ? (
                                                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]">
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
                                    {copy('Search for someone to start a conversation.', 'მოძებნეთ ადამიანი საუბრის დასაწყებად.')}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
