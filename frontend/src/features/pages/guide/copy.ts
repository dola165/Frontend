import { useTranslation } from 'react-i18next';
import { appLanguage } from '../../../utils/formatting';

const KA: Record<string, string> = {
  'Next': 'შემდეგი', 'Back': 'უკან', 'Skip': 'გამოტოვება', 'Saving…': 'ინახება…',
  'Hide Dola': 'დოლას დამალვა', 'Show Dola': 'დოლას გამოჩენა', 'Dola': 'დოლა',
  'Not saved. Your answer is still here. Try Next again.': 'ვერ შეინახა. პასუხი აქვეა. ისევ დააჭირეთ „შემდეგს“.',
  'Finish this step, or skip it for now.': 'დაასრულეთ ეს ნაბიჯი ან ჯერ გამოტოვეთ.',
  'Set up your club': 'მოაწყვეთ თქვენი კლუბი', 'Choose your crest': 'აირჩიეთ კლუბის ემბლემა',
  'Pick your colours, or upload your badge.': 'აირჩიეთ ფერები ან ატვირთეთ ემბლემა.',
  'Tell parents about your club': 'მოუყევით მშობლებს კლუბის შესახებ',
  'Keep this suggestion or write your own.': 'დატოვეთ ეს ვარიანტი ან დაწერეთ თქვენი.',
  'Where do you play?': 'სად თამაშობთ?', 'Choose a ground on the map, or type its name.': 'აირჩიეთ მოედანი რუკაზე ან ჩაწერეთ მისი სახელი.',
  'Which teams do you have?': 'რომელი გუნდები გყავთ?', 'Choose birth years and boys or girls. Training comes later on each team’s page.': 'აირჩიეთ დაბადების წლები და ბიჭების ან გოგონების გუნდი. ვარჯიში შემდეგ, გუნდის გვერდზე დაიგეგმება.',
  'How can parents reach you?': 'როგორ დაგიკავშირდნენ მშობლები?', 'Confirm the phone number for your page.': 'დაადასტურეთ გვერდის ტელეფონის ნომერი.',
  'What does a month cost?': 'რა ღირს ერთი თვე?', 'Confirm the range, or choose Free.': 'დაადასტურეთ ფასის დიაპაზონი ან აირჩიეთ „უფასო“.',
  'Invite your players': 'მოიწვიეთ მოთამაშეები', 'Share a team’s join link when you are ready.': 'როცა მზად იქნებით, გააზიარეთ გუნდში გაწევრიანების ბმული.',
  'Ready to go live': 'მზადაა გამოსაქვეყნებლად', 'Only the name is required. You can add the rest later.': 'სავალდებულოა მხოლოდ სახელი. დანარჩენის დამატება მოგვიანებითაც შეიძლება.',
  'Go live': 'გამოქვეყნება', 'Name your club': 'დაარქვით სახელი კლუბს', 'Name': 'სახელი', 'About': 'შესახებ', 'Phone': 'ტელეფონი',
  'From': 'დან', 'To': 'მდე', 'Free': 'უფასო', 'Monthly fee, GEL': 'თვიური საფასური, ₾',
  'Enter a name with at least two letters.': 'შეიყვანეთ სახელი, მინიმუმ ორი ასოთი.',
  'Write one sentence about your club.': 'დაწერეთ ერთი წინადადება კლუბის შესახებ.',
  'Enter a phone number.': 'შეიყვანეთ ტელეფონის ნომერი.',
  'Enter a valid fee range, or choose Free.': 'შეიყვანეთ ფასის სწორი დიაპაზონი ან აირჩიეთ „უფასო“.',
  'Reopen this step': 'ნაბიჯის ხელახლა გახსნა', 'Your ground’s name': 'მოედნის სახელი',
  'Birth years, like 2015, 2016 boys': 'დაბადების წლები, მაგალითად 2015, 2016 ბიჭები',
  'Add': 'დამატება', 'Choose a matching option in the editor.': 'აირჩიეთ შესაბამისი ვარიანტი რედაქტორში.',
  'Your changes are kept in this editor. Next saves them.': 'ცვლილებები რედაქტორშია. „შემდეგი“ მათ შეინახავს.',
  'All steps visited': 'ყველა ნაბიჯი ნანახია', 'You can return to any step.': 'შეგიძლიათ ნებისმიერ ნაბიჯს დაუბრუნდეთ.',
  'Finish': 'დასრულება',
};
export function useGuideCopy() {
  useTranslation();
  return (text: string) => appLanguage() === 'ka' ? KA[text] ?? text : text;
}
