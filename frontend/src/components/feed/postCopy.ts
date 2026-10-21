import { useCallback } from 'react';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { appLocale } from '../../utils/formatting';

const POST_KA: Record<string, string> = {
    'comment': 'კომენტარი', 'comments': 'კომენტარი', 'share': 'გაზიარება', 'shares': 'გაზიარება',
    'reaction': 'რეაქცია', 'reactions': 'რეაქცია',
    'Safe hands': 'საიმედო ხელები', 'On fire': 'ცეცხლია', 'Dead': 'სიცილით მოვკვდი',
    'Brutal': 'სასტიკია', 'Red card': 'წითელი ბარათი', 'Gutted': 'გულდასაწყვეტია', 'Care': 'თანადგომა',
    'Choose a reaction': 'რეაქციის არჩევა', 'Post reactions': 'პოსტის რეაქციები', 'All': 'ყველა',
    'No reactions to show.': 'რეაქციები ჯერ არ არის.',
    'Video · Open to play': 'ვიდეო · სანახავად გახსენით', 'Post media': 'პოსტის მედია', 'Edited': 'შეცვლილია',
    'Delete post': 'პოსტის წაშლა', 'Deleting…': 'იშლება…',
    'This will remove your post and its comments. Shared copies will show that the original is unavailable.': 'წაიშლება თქვენი პოსტი და მისი კომენტარები. გაზიარებულ ასლებში გამოჩნდება, რომ ორიგინალი მიუწვდომელია.',
    'Cancel': 'გაუქმება', 'Done': 'დასრულება', 'Retry': 'ხელახლა ცდა',
    'Original post': 'ორიგინალი პოსტი', 'Shared post media': 'გაზიარებული პოსტის მედია',
    'Original post is no longer available to you.': 'ორიგინალი პოსტი თქვენთვის აღარ არის ხელმისაწვდომი.',
    'Loading shared post…': 'გაზიარებული პოსტი იტვირთება…',
    'Audience': 'აუდიტორია', 'Public': 'საჯარო', 'Club leadership': 'კლუბის ხელმძღვანელობა', 'Only me': 'მხოლოდ მე',
    'Edit post': 'პოსტის რედაქტირება', 'Post text': 'პოსტის ტექსტი',
    'Attached photos and videos stay with this post.': 'ფოტოები და ვიდეოები პოსტს რჩება.',
    'Could not save changes. Your draft is still here.': 'ცვლილებები ვერ შეინახა. მონახაზი შენახულია.',
    'Saving…': 'ინახება…', 'Save changes': 'ცვლილებების შენახვა',
    'Report post': 'პოსტის შეტყობინება', 'Thank you for letting us know': 'გმადლობთ, რომ შეგვატყობინეთ',
    'Your report is awaiting review. Your identity stays private.': 'შეტყობინება განხილვას ელოდება. თქვენი ვინაობა დამალულია.',
    'View report receipt': 'შეტყობინების ჩანაწერის ნახვა',
    'What’s wrong with this post? Your report goes to the moderation team.': 'რა არის ამ პოსტში არასწორი? შეტყობინებას მოდერაციის გუნდი მიიღებს.',
    'Report reason': 'შეტყობინების მიზეზი', 'Spam or unwanted promotion': 'სპამი ან არასასურველი რეკლამა',
    'Bullying or harassment': 'ბულინგი ან შევიწროება', 'Unsafe or harmful content': 'სახიფათო ან საზიანო შინაარსი',
    'Impersonation': 'სხვისი სახელით მოქმედება', 'Something else': 'სხვა მიზეზი',
    'More detail': 'დამატებითი ინფორმაცია', '(optional)': '(არასავალდებულო)',
    'Help us understand what happened…': 'გვიამბეთ, რა მოხდა…',
    'Reporting does not automatically remove a post. The post text and your description are kept for review for up to 90 days.': 'შეტყობინება პოსტს ავტომატურად არ შლის. პოსტის ტექსტი და თქვენი აღწერა განხილვისთვის 90 დღემდე ინახება.',
    'Could not send your report. Retry to check whether it was received.': 'შეტყობინება ვერ გაიგზავნა. ხელახლა სცადეთ მიღების შესამოწმებლად.',
    'Sending…': 'იგზავნება…', 'Retry report': 'ხელახლა გაგზავნა', 'Send report': 'შეტყობინების გაგზავნა',
    'Recent chats could not load.': 'ბოლო ჩატები ვერ ჩაიტვირთა.',
    'Could not share this post. Your draft is still here; retry is safe.': 'პოსტი ვერ გაზიარდა. მონახაზი შენახულია; შეგიძლიათ ხელახლა სცადოთ.',
    'Post sent to chat.': 'პოსტი ჩატში გაიგზავნა.', 'Could not send to this chat. Retry is safe.': 'ამ ჩატში ვერ გაიგზავნა. შეგიძლიათ ხელახლა სცადოთ.',
    'Post link copied.': 'პოსტის ბმული დაკოპირდა.', 'Copy did not work. Select and copy the link below.': 'ბმული ვერ დაკოპირდა. მონიშნეთ და დააკოპირეთ ქვემოთ.',
    'Post shared': 'პოსტი გაზიარდა', 'Shared to your profile': 'გაზიარდა თქვენს პროფილზე',
    'People who can view your public profile can see this post.': 'პოსტს ნახავს ყველა, ვისაც თქვენი საჯარო პროფილის ნახვა შეუძლია.',
    'Only you can see this shared post.': 'ამ გაზიარებულ პოსტს მხოლოდ თქვენ ხედავთ.',
    'View shared post': 'გაზიარებული პოსტის ნახვა', 'Share post': 'პოსტის გაზიარება', 'You': 'თქვენ', 'Sign in': 'შესვლა',
    'to share to your feed or send to a chat.': 'ლენტაში გასაზიარებლად ან ჩატში გასაგზავნად.',
    'Say something about this post': 'დაწერეთ ამ პოსტზე', 'Say something about this…': 'დაწერეთ ამაზე…',
    'This post has a restricted audience or is unavailable. It cannot be reshared.': 'პოსტის აუდიტორია შეზღუდულია ან პოსტი მიუწვდომელია. მისი გაზიარება შეუძლებელია.',
    'Visible to people who can view your public profile.': 'ჩანს მათთვის, ვისაც თქვენი საჯარო პროფილის ნახვა შეუძლია.',
    'Saved on your profile, visible only to you.': 'ინახება თქვენს პროფილზე და ჩანს მხოლოდ თქვენთვის.',
    'Sharing…': 'ზიარდება…', 'Share now': 'გაზიარება', 'Send in GrassKickZ': 'გაგზავნა GrassKickZ-ში',
    'Loading chats…': 'ჩატები იტვირთება…', 'Your conversations will appear here.': 'თქვენი საუბრები აქ გამოჩნდება.',
    'Open messages': 'მიმოწერის გახსნა', 'Conversation': 'საუბარი', 'Sent': 'გაიგზავნა', 'Message': 'მიწერა', 'Group': 'ჯგუფი',
    'More chats': 'მეტი ჩატი', 'Share to': 'გაზიარების გზა', 'Copy link': 'ბმულის კოპირება', 'Post link': 'პოსტის ბმული',
};

/** Feed copy uses the existing app language subscription; backend messages remain intact unless known here. */
export function usePostCopy() {
    const copy = useJourneyCopy();
    return useCallback((english: string, georgian?: string) => copy(english, georgian ?? POST_KA[english] ?? english), [copy]);
}

export const postNumber = (value: number, compact = false) => new Intl.NumberFormat(appLocale(), compact
    ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(value);

/** Georgian keeps the noun singular after a number; never pluralize translated text with an English suffix. */
export const postCount = (count: number, kind: 'comment' | 'share' | 'reaction', copy: (english: string) => string, compact = false) =>
    `${postNumber(count, compact)} ${copy(count === 1 ? kind : `${kind}s`)}`;
