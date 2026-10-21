/**
 * The About line written for the owner: one sentence from the page type, its town and its teams, in the owner's
 * language, accepted by doing nothing and followed (new teams, another town) until the owner writes their own.
 * Birth years, not "U11": grassroots groups are named and run by year, and parents know the year.
 *
 * No imports, so the sandbox API reads this very file.
 */

export type AboutLanguage = 'en' | 'ka';
export interface AboutFacts { kind: string; town: string; squads: { ageGroup: string; gender: string }[] }

/** The year a U-age group's players were born in, in a season that starts in `year` (U10 in 2026: born 2017). */
export const birthYearOf = (ageGroup: string, year: number): number | null => (/^U\d{1,2}$/.test(ageGroup) ? year - Number(ageGroup.slice(1)) + 1 : null);
/** The age group of players born in `born`, in a season that starts in `year`. */
export const ageGroupOf = (born: number, year: number) => `U${year - born + 1}`;

/** "in Rustavi" in Georgian: the towns the app offers, in their locative form. */
const KA_IN: Record<string, string> = {
  Tbilisi: 'თბილისში', Batumi: 'ბათუმში', Kutaisi: 'ქუთაისში', Rustavi: 'რუსთავში', Gori: 'გორში', Zugdidi: 'ზუგდიდში', Poti: 'ფოთში', Kobuleti: 'ქობულეთში',
  Telavi: 'თელავში', Mtskheta: 'მცხეთაში', Marneuli: 'მარნეულში', Samtredia: 'სამტრედიაში', Zestaponi: 'ზესტაფონში', Senaki: 'სენაკში', Khashuri: 'ხაშურში',
  Akhaltsikhe: 'ახალციხეში', Ozurgeti: 'ოზურგეთში', Borjomi: 'ბორჯომში', Gurjaani: 'გურჯაანში', Kaspi: 'კასპში',
};

export function aboutSuggestion(facts: AboutFacts, language: AboutLanguage = 'en', year = new Date().getFullYear()): string {
  const ka = language === 'ka';
  const where = ka ? KA_IN[facts.town] ?? facts.town : `in ${facts.town}`;
  if (facts.kind === 'FAN_CLUB') return ka ? `გულშემატკივართა კლუბი ${where}.` : `A supporters’ club ${where}.`;
  if (facts.kind === 'BUSINESS') return ka ? `ფეხბურთის მხარდამჭერი ${where}.` : `Backing football ${where}.`;
  if (facts.kind !== 'CLUB') return ka ? `ფეხბურთი ${where}.` : `Football ${where}.`;
  const youth = facts.squads.filter(squad => birthYearOf(squad.ageGroup, year) != null);
  const adults = facts.squads.filter(squad => squad.ageGroup === 'SENIOR');
  if (!youth.length && !adults.length) return ka ? `საფეხბურთო კლუბი ${where}.` : `A football club ${where}.`;
  const years = youth.map(squad => birthYearOf(squad.ageGroup, year) as number);
  const low = Math.min(...years), high = Math.max(...years);
  const span = low === high ? `${low}` : `${low}–${high}`;
  const genders = new Set(youth.map(squad => squad.gender));
  const children = genders.size === 1 && genders.has('MALE') ? 'boys' : genders.size === 1 && genders.has('FEMALE') ? 'girls' : 'boysAndGirls';
  const grown = new Set(adults.map(squad => squad.gender));
  const adultWord = grown.size === 1 && grown.has('MALE') ? 'men' : grown.size === 1 && grown.has('FEMALE') ? 'women' : 'adults';
  if (ka) {
    const born = low === high ? `${span} წელს დაბადებული` : `${span} წლებში დაბადებული`;
    const kids = { boys: 'ბიჭებისთვის', girls: 'გოგოებისთვის', boysAndGirls: 'ბიჭებისა და გოგოებისთვის' }[children];
    const big = { men: 'მამაკაცებისთვის', women: 'ქალებისთვის', adults: 'მოზრდილებისთვის' }[adultWord];
    if (!youth.length) return `ფეხბურთი ${big} ${where}.`;
    if (!adults.length) return `ფეხბურთი ${born} ${kids} ${where}.`;
    return `ფეხბურთი ${born} ბავშვებისა და მოზრდილებისთვის ${where}.`;
  }
  const kids = { boys: 'boys', girls: 'girls', boysAndGirls: 'boys and girls' }[children];
  if (!youth.length) return `Football for ${adultWord} ${where}.`;
  if (!adults.length) return `Football for ${kids} born ${span} ${where}.`;
  return `Football for children born ${span} and ${adultWord} ${where}.`;
}
