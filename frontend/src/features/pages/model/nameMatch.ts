/**
 * The duplicate check while a page is named: "Dinamo" = "დინამო" = "Динамо" = "Dinamo Tb." all find FC Dinamo Tbilisi.
 *
 * Georgian (national romanisation) and Russian letters become Latin, case, accents and punctuation go, spellings that
 * people mix up are folded together (y/i, w/v, c/k, x/kh, q/k), filler words (FC, club, academy) don't decide a match,
 * an abbreviation matches the word it starts ("Tb." → Tbilisi) and a small typo is forgiven in a long word.
 *
 * No imports: the sandbox API uses this same file for `GET /pages/similar`.
 */

const GEORGIAN: Record<string, string> = {
  'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't', 'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p',
  'ჟ': 'zh', 'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'p', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q', 'შ': 'sh', 'ჩ': 'ch', 'ც': 'ts', 'ძ': 'dz', 'წ': 'ts',
  'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h',
};
const CYRILLIC: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
  'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '', 'ы': 'i', 'ь': '',
  'э': 'e', 'ю': 'iu', 'я': 'ia',
};

/** Words that say what kind of thing it is, not which one: English, Georgian and Russian, already in Latin letters. */
const FILLER = new Set([
  'fc', 'fk', 'sk', 'sc', 'cf', 'afc', 'ac', 'f', 'k', 'c', 'club', 'klubi', 'klub', 'football', 'futbol', 'futboli', 'futbolnii', 'sapekhburto', 'pekhburtis',
  'soccer', 'academy', 'akademia', 'akademiia', 'school', 'skola', 'shkola', 'youth', 'akhalgazrduli', 'juniors', 'junior', 'kids', 'team', 'gundi', 'komanda',
  'sport', 'sports', 'sporting', 'sportivnii', 'the', 'of', 'and', 'da',
]);
/** Prefixes that never tell two clubs apart ("FC Dinamo" is "Dinamo"). Unlike the filler words, "Academy" still counts for an exact copy. */
const PREFIXES = new Set(['fc', 'fk', 'sk', 'sc', 'cf', 'afc', 'ac', 'f', 'k', 'c']);

/** Lower case, letters in Latin, accents and punctuation gone. */
function rawWords(name: string): string[] {
  const latin = [...name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')]
    .map(letter => GEORGIAN[letter] ?? CYRILLIC[letter] ?? letter).join('');
  return latin.replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

/** One spelling for sounds people write differently: Dynamo/Dinamo, Lokomotiv/Locomotive, Kaxeti/Kakheti, Ghvinjilia/Gvinjilia. */
function fold(word: string): string {
  return word
    .replace(/ph/g, 'p').replace(/th/g, 't').replace(/kh/g, 'k').replace(/x/g, 'k').replace(/gh/g, 'g').replace(/q/g, 'k')
    .replace(/ck/g, 'k').replace(/c/g, 'k').replace(/tz/g, 'ts').replace(/y/g, 'i').replace(/w/g, 'v')
    .replace(/(.)\1+/g, '$1');
}

/** Every word of a name in one Latin spelling. */
export const latinWords = (name: string) => rawWords(name).map(fold);

/** The words that pick one club out from another. */
const distinctive = (name: string) => rawWords(name).filter(word => !FILLER.has(word)).map(fold);

/** The name's identity for exact copies: prefixes such as FC dropped, every other word kept in order. */
export function nameKey(name: string): string {
  const words = rawWords(name);
  const kept = words.filter((word, index) => !(PREFIXES.has(word) && (index === 0 || index === words.length - 1)));
  return (kept.length ? kept : words).map(fold).join(' ');
}

function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, current[j]);
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

/** Two words match when equal, when one is an abbreviation the other starts with, or when a long word has a small typo. */
function wordsMatch(typed: string, known: string): boolean {
  if (typed === known) return true;
  if (typed.length >= 2 && known.startsWith(typed)) return true;
  if (known.length >= 2 && typed.startsWith(known)) return true;
  const longest = Math.max(typed.length, known.length);
  const allowed = longest >= 8 ? 2 : longest >= 5 ? 1 : 0;
  return allowed > 0 && editDistance(typed, known, allowed) <= allowed;
}

export interface NameCandidate { name: string; town?: string | null }
export interface NameMatch<T extends NameCandidate> { candidate: T; exact: boolean; score: number }

/**
 * Known pages that look like the typed name, best first. Every distinctive word typed must match a word of the known
 * name (so "Rustavi Lions" never finds "Rustavi Community FC"), or every word of the known name must be among those typed.
 * `exact` is a copy of a known name: the sheet says it is already on GrassKickZ and offers to open it.
 */
export function findSimilar<T extends NameCandidate>(typed: string, candidates: readonly T[], { town, limit = 5 }: { town?: string | null; limit?: number } = {}): NameMatch<T>[] {
  const typedWords = distinctive(typed);
  if (!typedWords.length || typedWords.join('').length < 3) return [];
  const typedKey = nameKey(typed);
  const typedTown = town ? nameKey(town) : null;
  const matches: NameMatch<T>[] = [];
  for (const candidate of candidates) {
    const knownWords = distinctive(candidate.name);
    if (!knownWords.length) continue;
    const exact = nameKey(candidate.name) === typedKey;
    const typedCovered = typedWords.every(word => knownWords.some(known => wordsMatch(word, known)));
    const knownCovered = knownWords.every(known => typedWords.some(word => wordsMatch(word, known)));
    if (!exact && !typedCovered && !knownCovered) continue;
    // Prefer the names the typed words explain best, then the same town, then the shorter name.
    const covered = knownWords.filter(known => typedWords.some(word => wordsMatch(word, known))).length / knownWords.length;
    const sameTown = typedTown && candidate.town && nameKey(candidate.town) === typedTown ? 0.25 : 0;
    matches.push({ candidate, exact, score: (exact ? 2 : 0) + covered + sameTown - knownWords.length * 0.01 });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}
