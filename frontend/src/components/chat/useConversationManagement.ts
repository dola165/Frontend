import { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi, type InviteSuggestion } from '../../api/chat';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { useChatPeopleSearch } from './useChatPeopleSearch';
import type { Messenger } from './useMessenger';

/** Participants, invite suggestions and leaving for the selected conversation. Late answers never touch another room or account. */
export function useConversationManagement({ activeConv, activeConvId, activeConvRef, currentUserId, sessionId, showInfo, copy,
    setConversations, loadConversations, setManagementError, setActiveConvId, setShowInfo, setSearchParams }: Messenger) {
    const [suggestions, setSuggestions] = useState<InviteSuggestion[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [suggestionsFailed, setSuggestionsFailed] = useState(false);
    const [showAddPeople, setShowAddPeople] = useState(false);
    const [showSuggestUser, setShowSuggestUser] = useState(false);
    const [peopleSearchQuery, setPeopleSearchQuery] = useState('');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [leaving, setLeaving] = useState(false);
    const leavePending = useRef(false);

    const peopleSearch = useChatPeopleSearch(showAddPeople || showSuggestUser ? peopleSearchQuery : '',
        [currentUserId, ...(activeConv?.participants.map(person => person.userId) ?? [])]);

    const isCreator = activeConv?.contextType === 'GROUP'
        && activeConv.participants.some((p) => p.userId === currentUserId && p.role === 'CREATOR');

    const loadSuggestions = useCallback(async () => {
        if (!activeConvId || activeConv?.contextType !== 'GROUP') return;
        setSuggestionsLoading(true);
        setSuggestionsFailed(false);
        try {
            const res = await chatApi.getPendingSuggestions(activeConvId);
            if (activeConvRef.current === activeConvId && isCurrentAuthSession(sessionId)) setSuggestions(res.data);
        } catch {
            if (activeConvRef.current === activeConvId && isCurrentAuthSession(sessionId)) setSuggestionsFailed(true);
        } finally {
            if (activeConvRef.current === activeConvId && isCurrentAuthSession(sessionId)) setSuggestionsLoading(false);
        }
    }, [activeConvId, activeConv?.contextType, sessionId, activeConvRef]);

    useEffect(() => {
        if (showInfo && activeConvId) {
            void loadSuggestions();
        }
    }, [showInfo, activeConvId, loadSuggestions]);

    const removeParticipant = (userId: number) => setConversations((prev) =>
        prev.map((c) =>
            c.id === activeConvId
                ? { ...c, participants: c.participants.filter((p) => p.userId !== userId), participantCount: c.participants.filter((p) => p.userId !== userId).length }
                : c,
        ),
    );

    const handleKickUser = async (userId: number, displayName: string) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.removeParticipant(activeConvId, userId);
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            removeParticipant(userId);
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError(copy(`Failed to remove ${displayName}.`, `ვერ ამოიშალა: ${displayName}.`));
        }
    };

    const handleBlockUser = async (userId: number, displayName: string) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.blockUser(activeConvId, userId);
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            removeParticipant(userId);
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError(copy(`Failed to block ${displayName}.`, `ვერ დაიბლოკა: ${displayName}.`));
        }
    };

    const handleApproveSuggestion = async (suggestionId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.decideSuggestion(activeConvId, suggestionId, 'APPROVE');
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
            await loadConversations();
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError('Failed to approve suggestion.');
        }
    };

    const handleRejectSuggestion = async (suggestionId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.decideSuggestion(activeConvId, suggestionId, 'REJECT');
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError('Failed to reject suggestion.');
        }
    };

    const handleAddPeople = async (userId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.addParticipants(activeConvId, [userId]);
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            setPeopleSearchQuery('');
            await loadConversations();
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError('Failed to add participant.');
        }
    };

    const handleSuggestUser = async (userId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.suggestInvite(activeConvId, userId);
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            setPeopleSearchQuery('');
            setShowSuggestUser(false);
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError('This user may already be suggested or blocked.');
        }
    };

    const leaveConversation = async () => {
        if (!activeConv || leavePending.current) return;
        leavePending.current = true; setLeaving(true); setManagementError(null);
        try {
            await chatApi.leaveConversation(activeConv.id);
            if (!isCurrentAuthSession(sessionId)) return;
            if (activeConvRef.current === activeConv.id) {
                activeConvRef.current = null;
                setActiveConvId(null); setShowInfo(false); setShowAddPeople(false); setShowSuggestUser(false);
                setSearchParams({});
            }
            setConversations(previous => previous.filter(conversation => conversation.id !== activeConv.id));
            await loadConversations();
        } catch {
            if (isCurrentAuthSession(sessionId)) setManagementError('Could not leave this conversation. Try again.');
        } finally { leavePending.current = false; setLeaving(false); }
    };

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };
    const closeInfo = () => {
        setShowInfo(false);
        setShowAddPeople(false);
        setShowSuggestUser(false);
    };
    const toggleAddPeople = () => {
        setShowAddPeople(!showAddPeople);
        setShowSuggestUser(false);
        setPeopleSearchQuery('');
    };
    const toggleSuggestUser = () => {
        setShowSuggestUser(!showSuggestUser);
        setShowAddPeople(false);
        setPeopleSearchQuery('');
    };

    return {
        isCreator, suggestions, suggestionsLoading, suggestionsFailed, loadSuggestions, showAddPeople, showSuggestUser,
        peopleSearchQuery, setPeopleSearchQuery, peopleSearch, expandedSections, toggleSection, leaving, leaveConversation,
        closeInfo, toggleAddPeople, toggleSuggestUser, handleKickUser, handleBlockUser, handleApproveSuggestion,
        handleRejectSuggestion, handleAddPeople, handleSuggestUser,
    };
}

export type ConversationManagement = ReturnType<typeof useConversationManagement>;
