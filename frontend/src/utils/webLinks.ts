/**
 * Web addresses in running text, one rule for every place that shows them (the owner, 28 October 2026): http(s)
 * addresses as written and, where asked, bare domains such as rustavi-lions.ge, opened as https. Nothing else ever
 * becomes a link: no HTML, no other schemes, and never part of an email address.
 */
export const URL_PATTERN = 'https?:\\/\\/[^\\s<>"\']+';
/** The endings a bare domain may have here, so "e.g." or "U14.boys" never become links. */
const ENDINGS = 'ge|com|org|net|info|club|academy|football|soccer|sport|sports|team|io|eu|uk|de|fr|it|es|ru|ua|tr|am|az|us|co|me|app|dev|tv|online|site|store|shop|edu|gov';
const DOMAIN_PATTERN = `(?<![\\w@./-])(?:www\\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${ENDINGS})(?![\\w-])(?:\\/[^\\s<>"']*)?`;

/** A link's own end: trailing punctuation and unbalanced closing brackets belong to the sentence. */
export function trimUrl(candidate: string) {
    let url = candidate.replace(/[.,!?;:]+$/, '');
    for (const [open, close] of [['(', ')'], ['[', ']']]) {
        while (url.endsWith(close) && url.split(close).length > url.split(open).length) url = url.slice(0, -1);
    }
    return url;
}

const href = (value: string) => {
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password ? url.href : null;
    } catch { return null; }
};

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
    for (const match of text.matchAll(new RegExp(`(${URL_PATTERN})|(${DOMAIN_PATTERN})`, 'gi'))) {
        push(text.slice(end, match.index));
        end = match.index + match[0].length;
        const address = trimUrl(match[0]);
        const target = href(match[1] ? address : `https://${address}`);
        if (target) { out.push({ text: address, href: target }); push(match[0].slice(address.length)); } else push(match[0]);
    }
    push(text.slice(end));
    return out;
}
