import { appLanguage } from '../../utils/formatting';

const name = (fields: Record<string, unknown>) => (typeof fields.personName === 'string' ? fields.personName : '');

/** Who can talk to a player under 18, and what to do next, in the reader's language. Never "try again": it won't help. */
const WORDS: Record<string, { en: (fields: Record<string, unknown>) => string; ka: (fields: Record<string, unknown>) => string }> = {
    TEEN_CHAT_STRANGER: {
        en: () => 'Only a player’s parents and coaches can message players under 18.',
        ka: () => '18 წლამდე მოთამაშეს მხოლოდ მისი მშობლები და მწვრთნელები სწერენ.',
    },
    TEEN_CHAT_NO_PARENT: {
        en: fields => `${name(fields)} has no parent here yet. Write in the squad’s players’ room.`,
        ka: fields => `${name(fields)}: მშობელი აქ ჯერ არ არის. მისწერეთ გუნდის მოთამაშეების ოთახში.`,
    },
    TEEN_CHAT_ADD_PARENT: {
        en: () => 'Add your parent so coaches can message you.',
        ka: () => 'დაამატეთ მშობელი, რომ მწვრთნელებმა შეძლონ თქვენთვის მიწერა.',
    },
    TEEN_CHAT_TEAMMATE: {
        en: fields => `Write to ${name(fields)} in the squad’s players’ room.`,
        ka: fields => `${name(fields)}: მისწერეთ გუნდის მოთამაშეების ოთახში.`,
    },
    TEEN_CHAT_GROUP: {
        en: () => 'This group can’t hold players under 18 with these people. Write in the squad’s players’ room.',
        ka: () => 'ამ ჯგუფში 18 წლამდე მოთამაშეები ამ ადამიანებთან ერთად ვერ იქნებიან. მისწერეთ გუნდის მოთამაშეების ოთახში.',
    },
    PARENT_STAYS: {
        en: () => 'Parents stay in a player’s chat. They can mute it instead.',
        ka: () => 'მშობლები მოთამაშის ჩატში რჩებიან. მათ შეუძლიათ ხმის გამორთვა.',
    },
    TEEN_CHAT_STAYS: {
        en: () => 'A player’s chat with their parents stays as it is.',
        ka: () => 'მოთამაშის ჩატი მშობლებთან ისე რჩება, როგორც არის.',
    },
};

const fieldsOf = (error: unknown) => {
    const data = (error as { response?: { data?: unknown } } | null | undefined)?.response?.data;
    return data && typeof data === 'object' ? data as Record<string, unknown> : null;
};

/** The server's code for a refused chat with a player under 18, or null for any other failure. */
export const chatRefusalCode = (error: unknown) => {
    const code = fieldsOf(error)?.code;
    return typeof code === 'string' && code in WORDS ? code : null;
};

/** The words for a refused chat, or null when it failed for another reason and trying again may help. */
export const chatRefusalWords = (error: unknown) => {
    const fields = fieldsOf(error), code = chatRefusalCode(error);
    return fields && code ? WORDS[code][appLanguage() === 'ka' ? 'ka' : 'en'](fields) : null;
};
