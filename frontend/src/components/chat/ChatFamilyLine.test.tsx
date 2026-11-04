import '../../i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { chatApi, type ChatFamily } from '../../api/chat';
import { ChatFamilyLine } from './ChatFamilyLine';
import { chatRefusalCode, chatRefusalWords } from './chatRefusal';

vi.mock('../auth/AddMyParent', () => ({ AddMyParent: () => <p>Add my parent link</p> }));

const family = (extra: Partial<ChatFamily> = {}): ChatFamily => ({ parents: [], parentHeld: false, muted: false, awaitingParent: false, playerName: null, youAreThePlayer: false, mayWrite: true, teenChat: false, ...extra });
const maia = { userId: 2, displayName: 'Maia', childName: 'Teo' };
const show = (value: ChatFamily, onChanged = vi.fn()) => render(<ChatFamilyLine family={value} currentUserId={2} conversationId={9} onChanged={onChanged} />);

beforeEach(() => vi.restoreAllMocks());

it('tells the coach and the teen who else is in the chat', () => {
    render(<ChatFamilyLine family={family({ parents: [maia], teenChat: true })} currentUserId={1} conversationId={9} onChanged={vi.fn()} />);
    expect(screen.getByText('Maia is in this chat too.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mute' })).not.toBeInTheDocument();
});

it('tells a parent why they are here and lets them mute it', async () => {
    const save = vi.spyOn(chatApi, 'setMuted').mockResolvedValue({} as never), changed = vi.fn();
    show(family({ parents: [maia], parentHeld: true, teenChat: true }), changed);
    expect(screen.getByText('You’re in this chat as Teo’s parent.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mute' }));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith(9, true);
});

it('asks the teen for a parent and tells the club when it can reply', () => {
    const { unmount } = show(family({ awaitingParent: true, playerName: 'Nika', youAreThePlayer: true }));
    expect(screen.getByText('Add your parent: the club will reply when a parent is in this chat.')).toBeInTheDocument();
    expect(screen.getByText('Add my parent link')).toBeInTheDocument();
    unmount();
    show(family({ awaitingParent: true, playerName: 'Nika', mayWrite: false }));
    expect(screen.getByText('You can reply when Nika’s parent is in this chat.')).toBeInTheDocument();
});

it('says nothing in a chat with no teen in it', () => {
    const { container } = show(family());
    expect(container).toBeEmptyDOMElement();
});

it('says who can talk to teens instead of try again, and only for those refusals', () => {
    const refused = (code: string, personName?: string) => ({ response: { status: 403, data: { code, personName, message: 'x' } } });
    expect(chatRefusalWords(refused('TEEN_CHAT_STRANGER'))).toBe('Only a player’s parents and coaches can message players under 18.');
    expect(chatRefusalWords(refused('TEEN_CHAT_NO_PARENT', 'Nika'))).toBe('Nika has no parent here yet. Write in the squad’s players’ room.');
    expect(chatRefusalWords(refused('TEEN_CHAT_ADD_PARENT'))).toBe('Add your parent so coaches can message you.');
    expect(chatRefusalWords(refused('TEEN_CHAT_TEAMMATE', 'Teo'))).toBe('Write to Teo in the squad’s players’ room.');
    expect(chatRefusalCode(refused('TEEN_CHAT_STRANGER'))).toBe('TEEN_CHAT_STRANGER');
    expect(chatRefusalWords(refused('SOMETHING_ELSE'))).toBeNull();
    expect(chatRefusalWords(new Error('offline'))).toBeNull();
});
