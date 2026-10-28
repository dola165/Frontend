/**
 * Web addresses in running text, one rule for every place that shows them (the owner, 28 October 2026): http(s)
 * addresses as written and, where asked, bare domains such as rustavi-lions.ge, opened as https. Nothing else ever
 * becomes a link: no HTML, no other schemes, no address carrying a user name, and never part of an email address or of
 * a longer word, a look-alike letter included.
 */
export const URL_PATTERN = 'https?:\\/\\/[^\\s<>"\']+';
/** The endings a bare domain may have here, so "e.g." or "U14.boys" never become links. */
const ENDINGS = 'ge|com|org|net|info|club|academy|football|soccer|sport|sports|team|io|eu|uk|de|fr|it|es|ru|ua|tr|am|az|us|co|me|app|dev|tv|online|site|store|shop|edu|gov';
// No letter, digit, @ or dot on either side: "dinamo.academy@gmail.com" and "dіnamo.ge" (a Cyrillic і) stay words.
const DOMAIN_PATTERN = `(?<![\\p{L}\\p{N}_@./-])(?:www\\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${ENDINGS})(?![\\p{L}\\p{N}_@-])(?:\\/[^\\s<>"']*)?`;

/**
 * A link's own end: trailing punctuation, closing quotes („ “ ” » ’) and unbalanced closing brackets belong to the
 * sentence, in any order, as in "(see https://club.ge.)".
 */
export function trimUrl(candidate: string) {
    let url = candidate, before;
    do {
        before = url;
        url = url.replace(/[.,!?;:'"„“”«»‘’]+$/u, '');
        for (const [open, close] of [['(', ')'], ['[', ']']])
            if (url.endsWith(close) && url.split(close).length > url.split(open).length) url = url.slice(0, -1);
    } while (url !== before);
    return url;
}

/** Where an address may open: http(s) only, never with a user name or password in it. The one check for links. */
export function linkHref(value: string): string | null {
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}

export type TextPiece = { text: string; href?: undefined } | { text: string; href: string };

/** Text in pieces: plain words, and its web addresses with where they open. */
export function webLinkParts(text: string): TextPiece[] {
    const out: TextPiece[] = [];
    const push = (value: string) => {
        if (!value) return;
        const last = out.at(-1);
        if (last && last.href === undefined) last.text += value; else out.push({ text: value });
    };
    let end = 0;
    for (const match of text.matchAll(new RegExp(`(${URL_PATTERN})|(${DOMAIN_PATTERN})`, 'giu'))) {
        push(text.slice(end, match.index));
        end = match.index + match[0].length;
        const address = trimUrl(match[0]);
        const target = linkHref(match[1] ? address : `https://${address}`);
        if (target) { out.push({ text: address, href: target }); push(match[0].slice(address.length)); } else push(match[0]);
    }
    push(text.slice(end));
    return out;
}
