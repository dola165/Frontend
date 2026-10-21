import { useCallback } from 'react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

const KA: Record<string, string> = {
    'Reports & safety': 'საჩივრები და უსაფრთხოება', 'Report message': 'შეტყობინებაზე ჩივილი', 'Report account': 'ანგარიშზე ჩივილი',
    'Report or block account': 'ანგარიშზე ჩივილი ან დაბლოკვა', 'Report': 'ჩივილი', 'Report / block': 'ჩივილი / დაბლოკვა',
    'Close report': 'საჩივრის დახურვა', 'Close': 'დახურვა',
    'A human moderator will review your concern. Reporting does not automatically restrict anyone. The reported person cannot see who reported them.': 'თქვენს საჩივარს მოდერატორი განიხილავს. ჩივილი ადამიანს ავტომატურად არ ზღუდავს. ის ვერ დაინახავს, ვინ იჩივლა.',
    'This receipt also appears if you already reported this item.': 'ეს დასტური მაშინაც გამოჩნდება, თუ ამაზე უკვე იჩივლეთ.',
    'Open private receipt': 'პირადი დასტურის გახსნა', 'Reason': 'მიზეზი', 'What happened? (optional)': 'რა მოხდა? (არასავალდებულო)',
    'Describe this incident. Avoid unrelated private information.': 'აღწერეთ შემთხვევა. ნუ მიუთითებთ შეუსაბამო პირად ინფორმაციას.',
    'Only this message and your description are kept for review, for up to 90 days. Other conversations and restricted profile details are not copied.': 'განხილვისთვის მხოლოდ ეს შეტყობინება და თქვენი აღწერა ინახება, მაქსიმუმ 90 დღით. სხვა საუბრები და პროფილის შეზღუდული ინფორმაცია არ კოპირდება.',
    'Only this account’s public bio, when available, and your description are kept for review, for up to 90 days. Other conversations and restricted profile details are not copied.': 'განხილვისთვის მხოლოდ ამ ანგარიშის საჯარო ბიოგრაფია, თუ ხელმისაწვდომია, და თქვენი აღწერა ინახება, მაქსიმუმ 90 დღით. სხვა საუბრები და პროფილის შეზღუდული ინფორმაცია არ კოპირდება.',
    'Could not send the report. Retry to check whether it was received.': 'საჩივრის გაგზავნა ვერ დადასტურდა. ხელახლა სცადეთ, რომ მიღება შემოწმდეს.',
    'Sending…': 'იგზავნება…', 'Retry report': 'ხელახლა გაგზავნა', 'Send report': 'საჩივრის გაგზავნა',
    'Personal blocking': 'პირადი დაბლოკვა',
    'Stops personal messages in either direction. Required shared squad or club conversations remain available.': 'წყვეტს პირად მიმოწერას ორივე მიმართულებით. გუნდის ან კლუბის აუცილებელი საერთო საუბრები ხელმისაწვდომი რჩება.',
    'Loading block setting…': 'დაბლოკვის პარამეტრი იტვირთება…', 'This person is blocked by you.': 'ეს ადამიანი დაბლოკილი გყავთ.', 'This person is not blocked by you.': 'ეს ადამიანი დაბლოკილი არ გყავთ.',
    'Could not load your block setting.': 'დაბლოკვის პარამეტრი ვერ ჩაიტვირთა.', 'Could not update your block setting. Retry is safe.': 'დაბლოკვის პარამეტრი ვერ განახლდა. ხელახლა ცდა უსაფრთხოა.',
    'Refresh setting': 'პარამეტრის განახლება', 'Saving…': 'ინახება…', 'Unblock person': 'დაბლოკვის მოხსნა', 'Block person': 'ადამიანის დაბლოკვა',
    'If someone is in immediate danger, contact local emergency services or a trusted adult. Reports are not an emergency service.': 'თუ ვინმეს უშუალო საფრთხე ემუქრება, მიმართეთ ადგილობრივ გადაუდებელ დახმარებას ან სანდო ზრდასრულს. საჩივრები გადაუდებელი დახმარების სერვისი არ არის.',
    'Spam': 'სპამი', 'Harassment': 'შევიწროება', 'Safety concern': 'უსაფრთხოების პრობლემა', 'Impersonation': 'სხვისი სახელით მოქმედება', 'Something else': 'სხვა მიზეზი',
    'Awaiting review': 'ელოდება განხილვას', 'Reviewed': 'განხილულია', 'Dismissed': 'უარყოფილია',
};

export function useReportingCopy() {
    const copy = useJourneyCopy();
    return useCallback((en: string, ka?: string) => copy(en, ka ?? KA[en] ?? en), [copy]);
}
