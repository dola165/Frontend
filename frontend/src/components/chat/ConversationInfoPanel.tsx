import { Ban, ChevronDown, ChevronUp, Crown, Loader2, Plus, Search, UserMinus, UserPlus, X } from 'lucide-react';
import type { ConversationDto } from '../../api/chat';
import { MediaImage } from '../ui/MediaImage';
import { PeopleSearchStatus } from './PeopleSearchStatus';
import { useMessageCopy } from './messageCopy';
import type { ConversationManagement } from './useConversationManagement';

type InfoPanelProps = {
    conversation: ConversationDto; currentUserId: number; showInfo: boolean; managementError: string | null;
    onDismissError: () => void; manage: ConversationManagement;
};

/** Info / management drawer: participants, adding or suggesting people, invite suggestions and leaving. */
export const ConversationInfoPanel = ({ conversation: activeConv, currentUserId, showInfo, managementError, onDismissError, manage }: InfoPanelProps) => {
    const copy = useMessageCopy();
    const { isCreator, expandedSections, toggleSection } = manage;
    return (
        <aside aria-hidden={!showInfo} inert={!showInfo} className={`shrink-0 bg-[var(--chat-card)] border-l border-[var(--chat-card-border)] flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
            showInfo ? 'w-[300px] opacity-100' : 'w-0 opacity-0 border-l-0'
        }`}>
            {/* Header */}
            <div className="h-14 px-4 border-b border-[var(--chat-card-border)] flex items-center gap-3 shrink-0">
                <button
                    onClick={manage.closeInfo}
                    aria-label={copy('Close conversation info', 'საუბრის ინფორმაციის დახურვა')}
                    className="p-1.5 rounded-full text-[var(--chat-text-muted)] hover:bg-[var(--chat-card-hover)] transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
                <h2 className="font-semibold text-[var(--chat-text-primary)] text-sm">
                    {activeConv.contextType === 'GROUP'
                        ? copy('Group settings', 'ჯგუფის პარამეტრები')
                        : activeConv.contextType === 'MATCH_CHALLENGE'
                            ? copy('Match chat', 'მატჩის ჩატი')
                            : copy('Conversation', 'საუბარი')}
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Error */}
                {managementError && (
                    <div role="alert" className="mx-4 mt-3 px-3 py-2 rounded-lg border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)] text-xs">
                        {copy(managementError)}
                        <button onClick={onDismissError} className="ml-2 app-text-action">{copy('Dismiss', 'დახურვა')}</button>
                    </div>
                )}

                {/* ── Participants ────────────────────── */}
                <div className="p-4">
                    <button
                        onClick={() => toggleSection('participants')}
                        className="w-full flex items-center justify-between mb-3"
                    >
                        <h3 className="text-xs font-semibold uppercase text-[var(--chat-text-muted)] tracking-wide">
                            {copy('Participants')} · {activeConv.participantCount}
                        </h3>
                        {expandedSections['participants'] ? (
                            <ChevronUp className="w-4 h-4 text-[var(--chat-text-muted)]" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--chat-text-muted)]" />
                        )}
                    </button>

                    {(expandedSections['participants'] ?? true) && (
                        <div className="flex flex-col gap-1">
                            {activeConv.participants.map((p) => {
                                const isMe = p.userId === currentUserId;
                                const isParticipantCreator = p.role === 'CREATOR';

                                return (
                                    <div
                                        key={p.userId}
                                        className="flex items-center gap-3 px-2 py-1.5 rounded-lg group hover:bg-[var(--chat-card-hover)]"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-xs shrink-0">
                                            {p.profilePictureUrl ? (
                                                <MediaImage
                                                    src={p.profilePictureUrl}
                                                    alt=""
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                p.displayName.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-sm font-medium text-[var(--chat-text-primary)] truncate">
                                                    {p.displayName}
                                                </p>
                                                {isParticipantCreator && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)] text-[9px] font-bold uppercase tracking-wider">
                                                        <Crown className="w-2.5 h-2.5" />
                                                        {copy('Admin', 'ადმინი')}
                                                    </span>
                                                )}
                                            </div>
                                            {isMe && (
                                                <p className="text-[10px] text-[var(--chat-text-muted)]">{copy('You', 'თქვენ')}</p>
                                            )}
                                        </div>

                                        {/* Creator actions for non-self, non-creator participants */}
                                        {isCreator && !isMe && !isParticipantCreator && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => manage.handleKickUser(p.userId, p.displayName)}
                                                    title={copy('Remove', 'წაშლა')}
                                                    className="p-1 rounded text-[var(--chat-text-muted)] hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 transition-colors"
                                                >
                                                    <UserMinus className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => manage.handleBlockUser(p.userId, p.displayName)}
                                                    title={copy('Block', 'დაბლოკვა')}
                                                    className="p-1 rounded text-[var(--chat-text-muted)] hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 transition-colors"
                                                >
                                                    <Ban className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Add People / Suggest (GROUP only) ── */}
                {activeConv.contextType === 'GROUP' && (
                    <div className="px-4 pb-3 border-b border-[var(--chat-card-border)]">
                        {isCreator ? (
                            <>
                                <button
                                    onClick={manage.toggleAddPeople}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-full border border-[var(--chat-card-border)] text-[var(--chat-text-secondary)] text-xs font-semibold hover:bg-[var(--chat-card-hover)] transition-colors"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    {copy('Add people', 'ადამიანების დამატება')}
                                </button>
                                {manage.showAddPeople && <PeoplePicker manage={manage} onPick={manage.handleAddPeople} />}
                            </>
                        ) : (
                            <button
                                onClick={manage.toggleSuggestUser}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-full border border-[var(--chat-card-border)] text-[var(--chat-text-secondary)] text-xs font-semibold hover:bg-[var(--chat-card-hover)] transition-colors"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                {copy('Suggest someone', 'ვინმეს შეთავაზება')}
                            </button>
                        )}

                        {/* Shared search for Suggest Someone */}
                        {manage.showSuggestUser && !isCreator && <PeoplePicker manage={manage} onPick={manage.handleSuggestUser} />}
                    </div>
                )}

                {/* ── Pending Suggestions (creator only) ── */}
                {activeConv.contextType === 'GROUP' && isCreator && <InviteSuggestions manage={manage} />}
            </div>

            {/* Leave button */}
            <div className="p-4 border-t border-[var(--chat-card-border)]">
                <button
                    onClick={() => void manage.leaveConversation()}
                    disabled={manage.leaving}
                    aria-busy={manage.leaving}
                    className="w-full py-2 px-4 rounded-full border border-[color:var(--color-danger)]/30 text-[color:var(--color-danger)] text-sm font-semibold hover:bg-[color:var(--color-danger)]/10 transition-colors"
                >
                    {manage.leaving ? copy('Leaving…') : activeConv.contextType === 'GROUP'
                        ? copy('Leave group', 'ჯგუფის დატოვება')
                        : activeConv.contextType === 'MATCH_CHALLENGE'
                            ? copy('Leave match chat', 'მატჩის ჩატის დატოვება')
                            : copy('Leave conversation', 'საუბრის დატოვება')}
                </button>
            </div>
        </aside>
    );
};

/** People search shared by "Add people" (creator) and "Suggest someone" (member). */
const PeoplePicker = ({ manage, onPick }: { manage: ConversationManagement; onPick: (userId: number) => Promise<void> }) => {
    const copy = useMessageCopy();
    const { peopleSearch } = manage;
    return (
        <div className="mt-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--chat-text-muted)]" />
                <input
                    type="text"
                    value={manage.peopleSearchQuery}
                    onChange={(e) => manage.setPeopleSearchQuery(e.target.value)}
                    aria-label={copy('Search people')}
                    placeholder={copy('Search people…', 'მოძებნეთ ადამიანები…')}
                    className="w-full pl-8 pr-3 py-1.5 rounded-full border border-[var(--chat-card-border)] bg-[var(--chat-input-bg)] text-[var(--chat-text-primary)] text-xs placeholder:text-[var(--chat-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--chat-accent)]/40"
                />
            </div>
            <PeopleSearchStatus loading={peopleSearch.loading} failed={peopleSearch.failed} onRetry={peopleSearch.retry} />
            <div className="max-h-32 overflow-y-auto mt-1">
                {peopleSearch.results.map((u) => (
                    <button
                        key={u.id}
                        onClick={() => onPick(u.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--chat-card-hover)] text-left transition-colors"
                    >
                        <div className="w-7 h-7 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-[10px] shrink-0">
                            {(u.fullName || u.username).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-[var(--chat-text-primary)] truncate">
                                {u.fullName || u.username}
                            </p>
                            <p className="text-[10px] text-[var(--chat-text-muted)]">@{u.username}</p>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-[var(--chat-text-muted)]" />
                    </button>
                ))}
            </div>
        </div>
    );
};

const InviteSuggestions = ({ manage }: { manage: ConversationManagement }) => {
    const copy = useMessageCopy();
    const { suggestions, expandedSections } = manage;
    return (
        <div className="p-4 border-b border-[var(--chat-card-border)]">
            <button
                onClick={() => manage.toggleSection('suggestions')}
                className="w-full flex items-center justify-between"
            >
                <h3 className="text-xs font-semibold uppercase text-[var(--chat-text-muted)] tracking-wide">
                    {copy('Invite suggestions', 'შეთავაზებული მოწვევები')}
                    {suggestions.length > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)] text-[9px] font-bold">
                            {suggestions.length}
                        </span>
                    )}
                </h3>
                {expandedSections['suggestions'] ? (
                    <ChevronUp className="w-4 h-4 text-[var(--chat-text-muted)]" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--chat-text-muted)]" />
                )}
            </button>

            {(expandedSections['suggestions'] ?? true) && (
                <>
                    {manage.suggestionsLoading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-[var(--chat-text-muted)]" />
                        </div>
                    ) : manage.suggestionsFailed ? (
                        <p role="alert" className="text-xs mt-2">{copy('Invite suggestions couldn’t load.', 'მოწვევის შეთავაზებები ვერ ჩაიტვირთა.')} <button className="app-text-action" onClick={() => void manage.loadSuggestions()}>{copy('Try again')}</button></p>
                    ) : suggestions.length === 0 ? (
                        <p className="text-xs text-[var(--chat-text-muted)] mt-2 py-2 text-center">
                            {copy('No suggestions waiting.', 'შეთავაზებები არ არის.')}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2 mt-2">
                            {suggestions.map((s) => (
                                <div
                                    key={s.id}
                                    className="flex items-center gap-2 px-2 py-2 rounded-lg bg-[var(--chat-surface)] border border-[var(--chat-card-border)]"
                                >
                                    <div className="w-8 h-8 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-[10px] shrink-0">
                                        {(s.suggestedUserDisplayName || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-[var(--chat-text-primary)] truncate">
                                            {s.suggestedUserDisplayName}
                                        </p>
                                        <p className="text-[10px] text-[var(--chat-text-muted)]">
                                            {copy(`Suggested by ${s.suggestedByDisplayName}`, `შემოთავაზებულია: ${s.suggestedByDisplayName}`)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => manage.handleApproveSuggestion(s.id)}
                                            className="p-1 rounded-full text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10 transition-colors"
                                            title={copy('Approve', 'დადასტურება')}
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        </button>
                                        <button
                                            onClick={() => manage.handleRejectSuggestion(s.id)}
                                            className="p-1 rounded-full text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 transition-colors"
                                            title={copy('Decline', 'უარყოფა')}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
