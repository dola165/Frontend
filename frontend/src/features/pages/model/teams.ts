import { birthYearOf, type AboutLanguage } from './about';

export type TeamGender = 'MALE' | 'FEMALE' | 'MIXED';

/** The age groups a club page offers, youngest first. */
export const TEAM_AGES = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'SENIOR'] as const;

const WORDS: Record<AboutLanguage, Record<TeamGender, string>> = {
  en: { MALE: 'Boys', FEMALE: 'Girls', MIXED: 'Mixed' },
  ka: { MALE: 'ბიჭები', FEMALE: 'გოგოები', MIXED: 'შერეული' },
};
const SENIOR: Record<AboutLanguage, Record<TeamGender, string>> = {
  en: { MALE: 'Men', FEMALE: 'Women', MIXED: 'Adults, mixed' },
  ka: { MALE: 'მამაკაცები', FEMALE: 'ქალები', MIXED: 'უფროსები, შერეული' },
};

/**
 * A team named the way grassroots football names it, by birth year: "2016 Boys", "2016 ბიჭები"; adults "Men",
 * "ქალები". In the owner's language, so a Georgian owner's teams are named in Georgian.
 */
export function teamName(ageGroup: string, gender: TeamGender, language: AboutLanguage, year = new Date().getFullYear()) {
  const born = birthYearOf(ageGroup, year);
  return born == null ? SENIOR[language][gender] : `${born} ${WORDS[language][gender]}`;
}
