import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

export function useResultCopy() {
  const { i18n } = useTranslation();
  const language = i18n.language?.startsWith('ka') ? 'ka' : 'en';
  return { language, copy: (en: string, ka: string) => language === 'ka' ? ka : en };
}

const resultTranslations: Record<string, string> = {
  'Home team': 'მასპინძელი გუნდი', 'Away team': 'სტუმარი გუნდი', 'Lead referee': 'მთავარი მსაჯი',
  'Match result': 'მატჩის შედეგი', 'Refresh result': 'შედეგის განახლება', 'Retry result': 'ხელახლა ცდა', 'Loading result…': 'შედეგი იტვირთება…',
  'Previously recorded result': 'ადრე დაფიქსირებული შედეგი', 'Confirmed result': 'დადასტურებული შედეგი', 'Proposed score': 'შეთავაზებული ანგარიში',
  'Confirmation evidence is unavailable for this older record.': 'ამ ძველი ჩანაწერის დადასტურების მტკიცებულება მიუწვდომელია.',
  'awaiting confirmation': 'დადასტურების მოლოდინში', 'Proposed by': 'შეთავაზებულია', 'a match participant': 'მატჩის მონაწილის მიერ',
  'Still needed': 'ჯერ კიდევ საჭიროა', 'Confirmations are being checked.': 'დადასტურებები მოწმდება.',
  'Result disputed.': 'შედეგი სადავოა.', 'The score is under review': 'ანგარიში განხილვის პროცესშია', 'disputed score': 'სადავო ანგარიში',
  'Previously recorded score': 'ადრე დაფიქსირებული ანგარიში', 'This has not been confirmed through the current result process.': 'ეს ანგარიში მიმდინარე პროცესით არ დადასტურებულა.',
  'No result has been proposed.': 'შედეგი ჯერ არ არის შეთავაზებული.', 'This cancelled fixture’s result history is read only.': 'გაუქმებული მატჩის შედეგების ისტორიის შეცვლა შეუძლებელია.',
  'Propose a score': 'ანგარიშის შეთავაზება', 'Propose score': 'ანგარიშის შეთავაზება', 'score': 'ანგარიში', 'Confirm as': 'დაადასტურეთ როგორც',
  'A proposed score becomes final only after the required independent confirmations.': 'შეთავაზებული ანგარიში საბოლოო ხდება აუცილებელი დამოუკიდებელი დადასტურებების შემდეგ.',
  'Dispute result': 'შედეგის გასაჩივრება', 'Reason for dispute': 'გასაჩივრების მიზეზი', 'Submit dispute': 'გასაჩივრების გაგზავნა',
  'Propose correction': 'შესწორების შეთავაზება', 'Correct the score': 'ანგარიშის შესწორება', 'Reason for correction': 'შესწორების მიზეზი',
  'A correction needs a new round of confirmations.': 'შესწორება ხელახალ დადასტურებებს მოითხოვს.', 'Submit correction': 'შესწორების გაგზავნა',
  'Result history': 'შედეგის ისტორია', 'Historical record': 'ისტორიული ჩანაწერი', 'Match participant': 'მატჩის მონაწილე',
  'No result actions yet.': 'შედეგზე მოქმედებები ჯერ არ არის.', 'Acting as': 'მოქმედებთ როგორც',
  'The result changed. Review the latest version before editing again.': 'შედეგი შეიცვალა. რედაქტირებამდე გადახედეთ უახლეს ვერსიას.',
  'The result changed. Review the latest version before trying again.': 'შედეგი შეიცვალა. ხელახლა ცდამდე გადახედეთ უახლეს ვერსიას.',
  'Could not load the match result.': 'მატჩის შედეგი ვერ ჩაიტვირთა.', 'Could not update the match result. Please try again.': 'მატჩის შედეგი ვერ განახლდა. სცადეთ ხელახლა.',
  'Score proposed. Awaiting confirmation.': 'ანგარიში შეთავაზებულია. დადასტურების მოლოდინშია.', 'Confirmation recorded.': 'დადასტურება დაფიქსირდა.',
  'Result disputed. The score is under review.': 'შედეგი გასაჩივრებულია. ანგარიში განხილვის პროცესშია.', 'Correction proposed. Fresh confirmations are required.': 'შესწორება შეთავაზებულია. საჭიროა ახალი დადასტურებები.',
  'propose': 'შეთავაზება', 'confirm': 'დადასტურება', 'dispute': 'გასაჩივრება', 'correct': 'შესწორება', 'imported': 'ძველი ჩანაწერი',
};
export function useResultText() {
  const { language } = useResultCopy();
  return useCallback((value: string) => language === 'ka' ? resultTranslations[value] ?? value : value, [language]);
}
