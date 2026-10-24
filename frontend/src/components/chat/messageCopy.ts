import { useCallback } from 'react';
import type { ConversationDto } from '../../api/chat';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';

const MESSAGE_KA: Record<string, string> = {
    'Online': 'ონლაინ', 'Saved': 'შენახულია', 'Participants': 'მონაწილეები',
    'Club enquiry': 'კლუბთან დაკავშირება', 'Match Chat': 'მატჩის ჩატი', 'Team chat': 'გუნდის ჩატი', 'Group': 'ჯგუფი', 'Unknown': 'უცნობი',
    'Message actions': 'შეტყობინების მოქმედებები', 'Write a message': 'დაწერეთ შეტყობინება',
    'Load older messages': 'ძველი შეტყობინებების ჩატვირთვა', 'Loading older messages…': 'ძველი შეტყობინებები იტვირთება…',
    'Could not load older messages. Please try again.': 'ძველი შეტყობინებები ვერ ჩაიტვირთა. სცადეთ ხელახლა.',
    'Could not refresh this conversation. We will retry when the connection returns.': 'საუბარი ვერ განახლდა. კავშირის აღდგენისას ხელახლა ვცდით.',
    'Message was not confirmed. Your draft is kept; press Send to retry.': 'გაგზავნა ვერ დადასტურდა. მონახაზი შენახულია; ხელახლა სცადეთ გაგზავნა.',
    'This conversation is no longer available.': 'ეს საუბარი აღარ არის ხელმისაწვდომი.',
    'Failed to approve suggestion.': 'შეთავაზება ვერ დადასტურდა.', 'Failed to reject suggestion.': 'შეთავაზების უარყოფა ვერ მოხერხდა.',
    'Failed to add participant.': 'მონაწილე ვერ დაემატა.',
    'This user may already be suggested or blocked.': 'ეს ადამიანი შესაძლოა უკვე შეთავაზებული ან დაბლოკილია.',
    'New Chat': 'ახალი ჩატი', 'Searching...': 'იძებნება…', 'Search people': 'ადამიანების ძიება',
    'Search failed. Try again.': 'ძიება ვერ მოხერხდა. სცადეთ ხელახლა.',
    'Could not start the conversation.': 'საუბარი ვერ დაიწყო.', 'Could not create the group.': 'ჯგუფი ვერ შეიქმნა.',
    'Give the group a name.': 'დაარქვით ჯგუფს სახელი.', 'Choose at least one person.': 'აირჩიეთ ერთი ადამიანი მაინც.',
    'Try again': 'ხელახლა ცდა', 'Back': 'უკან', 'Close new chat': 'ახალი ჩატის დახურვა',
    'Group name': 'ჯგუფის სახელი', 'Leaving…': 'ტოვებს…',
    'Could not leave this conversation. Try again.': 'საუბრის დატოვება ვერ მოხერხდა. სცადეთ ხელახლა.',
    'Could not open this conversation. Please try again.': 'საუბარი ვერ გაიხსნა. სცადეთ ხელახლა.',
    'This conversation couldn’t load. Try again, or open another chat.': 'საუბარი ვერ ჩაიტვირთა. სცადეთ ხელახლა ან გახსენით სხვა ჩატი.',
};

/** Translate known client feedback when rendered, preserving drafts and requests across a language change. */
export function useMessageCopy() {
    const copy = useJourneyCopy();
    return useCallback((english: string, georgian?: string) => copy(english, georgian ?? MESSAGE_KA[english] ?? english), [copy]);
}

export function conversationName(conversation: ConversationDto, currentUserId: number, copy: (english: string) => string): string {
    if (conversation.contextType !== 'DIRECT') {
        if (conversation.contextType === 'TEAM') return copy('Team chat');
        if (/^Joining enquiry #\d+$/.test(conversation.name ?? '')) {
            const contacts = conversation.participants.filter(person => person.userId !== currentUserId).map(person => person.displayName).filter(Boolean);
            return [...contacts, copy('Club enquiry')].join(' · ');
        }
        return conversation.name || copy(conversation.contextType === 'MATCH_CHALLENGE' ? 'Match Chat' : 'Group');
    }
    return conversation.participants.find(person => person.userId !== currentUserId)?.displayName || copy('Unknown');
}
