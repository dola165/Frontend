/**
 * The ways in to a club for a family (Parent Hub, step 5): only what the club filled in. Plain helpers, no React, so
 * every rule here is tested on its own.
 */

/** A phone number as a `tel:` link: digits and a leading +, nothing else. Null when there is no number. */
export function telLink(phone?: string | null) {
    const digits = (phone ?? '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    return digits.replace(/\D/g, '').length >= 6 ? `tel:${digits}` : null;
}

/** WhatsApp's own link for a number (digits only, with the country code), with a first line already written. */
export function whatsAppLink(phone?: string | null, text?: string) {
    const digits = (phone ?? '').replace(/\D/g, '');
    if (digits.length < 8) return null;
    // A Georgian mobile written without the country code (5xx xx xx xx) gets +995.
    const number = digits.length === 9 && digits.startsWith('5') ? `995${digits}` : digits;
    return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

type Copy = (en: string, ka: string) => string;

/**
 * The first line of a family's message to a club: "Hello, my son Nino was born in 2017. Is there a place for him in
 * Beginners?" Only what the family knows is said; without a child it asks for the parent.
 */
export function firstLine(copy: Copy, child?: { name: string; gender?: 'MALE' | 'FEMALE' | null; birthYear?: number | null } | null, group?: string | null) {
    if (!child) return group ? copy(`Hello, I would like to ask about ${group}.`, `გამარჯობა, მინდა ვიკითხო ${group}-ის შესახებ.`) : copy('Hello, I would like to ask about training at your club.', 'გამარჯობა, მინდა ვიკითხო თქვენს კლუბში ვარჯიშის შესახებ.');
    const first = child.name.trim().split(/\s+/)[0];
    const who = child.gender === 'MALE' ? copy('my son', 'ჩემი შვილი') : child.gender === 'FEMALE' ? copy('my daughter', 'ჩემი შვილი') : copy('my child', 'ჩემი შვილი');
    const born = child.birthYear ? copy(` was born in ${child.birthYear}`, ` დაიბადა ${child.birthYear} წელს`) : '';
    const place = group ? copy(` Is there a place in ${group}?`, ` არის ადგილი ${group}-ში?`) : copy(' Is there a place for them at your club?', ' არის ადგილი თქვენს კლუბში?');
    return copy(`Hello, ${who} ${first}${born}.${place}`, `გამარჯობა, ${who} ${first}${born}.${place}`);
}

/** A group's first visits as the family saw them when they pressed Book, and the training they chose. */
export interface SeenVisit { fee: number | null; currency: string | null; places: number; session: { reference: string; startsAt: string; endsAt: string; place: string } }

/**
 * What changed between what the family saw and the group's first visits now, one line each: the price, the places a
 * session, and the chosen training (moved, at another place, or no longer offered). Empty when nothing they saw changed.
 */
export function visitChanges(copy: Copy, seen: SeenVisit, now: { fee: number | null; currency: string | null; places: number; sessions: SeenVisit['session'][] }, when: (iso: string) => string) {
    const price = (fee: number | null, currency: string | null) => fee ? `${fee} ${currency ?? ''}`.trim() : copy('Free', 'უფასო');
    const lines: string[] = [];
    if (price(seen.fee, seen.currency) !== price(now.fee, now.currency)) lines.push(copy(`Price: ${price(now.fee, now.currency)}, was ${price(seen.fee, seen.currency)}`, `ფასი: ${price(now.fee, now.currency)}, იყო ${price(seen.fee, seen.currency)}`));
    if (seen.places !== now.places) lines.push(copy(`At most ${now.places} a session, was ${seen.places}`, `მაქსიმუმ ${now.places} ერთ ვარჯიშზე, იყო ${seen.places}`));
    const session = now.sessions.find(item => item.reference === seen.session.reference);
    const at = (item: SeenVisit['session']) => `${when(item.startsAt)}–${when(item.endsAt).split(', ').pop()} · ${item.place}`;
    if (!session) lines.push(copy(`The training on ${when(seen.session.startsAt)} is no longer offered`, `${when(seen.session.startsAt)}-ის ვარჯიში აღარ არის`));
    else if (at(session) !== at(seen.session)) lines.push(copy(`Training: ${at(session)}, was ${at(seen.session)}`, `ვარჯიში: ${at(session)}, იყო ${at(seen.session)}`));
    return lines;
}

/** An age code: "U8", "U-12", "Under 12s", "U8–U10", "U8-10", with brackets around it if any. */
const AGE_CODE = String.raw`\(?\s*\b(?:U|Under\s*)-?\s*\d{1,2}s?(?:\s*[-–—/]\s*(?:U-?\s*)?\d{1,2}s?)?\b\s*\)?`;
const EDGES = /^[\s·|,:–—-]+|[\s·|,:–—-]+$/g;

/**
 * A club's programme, group or squad name as a parent reads it (owner, 29 October 2026): the club's own words with
 * any "U8–U10"-style age part taken out, since the birth years go beside it ("Foundation (U8–U10)" is "Foundation").
 * Null when the name is nothing but that. Staff screens keep names as they are.
 */
export function parentName(name?: string | null) {
    const rest = (name ?? '').replace(new RegExp(AGE_CODE, 'gi'), ' ').replace(/\s{2,}/g, ' ').replace(EDGES, '').trim();
    return rest || null;
}

/**
 * "Foundation · born 2017–2020": the parent-facing name and the birth years beside it. A name that is only an age
 * code gives way to the years ("Born 2017–2020"); without years it stays as the club wrote it.
 */
export function parentGroupLabel(copy: Copy, name: string, from?: number | null, to?: number | null) {
    const born = bornLabel(copy, from, to), own = parentName(name);
    if (!own) return born ? born.charAt(0).toUpperCase() + born.slice(1) : name.trim();
    return [own, born].filter(Boolean).join(' · ');
}

/** "born 2017–2019", "born 2017": how a parent reads a group. Null without years. */
export function bornLabel(copy: Copy, from?: number | null, to?: number | null) {
    if (!from && !to) return null;
    const low = Math.min(from ?? to!, to ?? from!), high = Math.max(from ?? to!, to ?? from!);
    return low === high ? copy(`born ${low}`, `დაბ. ${low}`) : copy(`born ${low}–${high}`, `დაბ. ${low}–${high}`);
}

/**
 * Whether a tryout is for this child: no age group, or a "U12"-style one the child is in this year (under 12, and no
 * more than two years younger). Without a birth year every tryout is shown.
 */
export function tryoutFits(ageGroup?: string | null, birthYear?: number, year = new Date().getFullYear()) {
    const under = ageGroup ? /^U(\d{1,2})$/i.exec(ageGroup.trim()) : null;
    if (!under || !birthYear) return true;
    const age = year - birthYear, limit = Number(under[1]);
    return age < limit && age >= limit - 3;
}

/** A programme's ages as the birth years it takes this year ("Ages 8–10" in 2026 is born 2016–2018). */
export function programmeBornYears(ageMin?: number | null, ageMax?: number | null, year = new Date().getFullYear()) {
    if (ageMin == null && ageMax == null) return null;
    return { from: ageMax != null ? year - ageMax : null, to: ageMin != null ? year - ageMin : null };
}

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, match => `\\${match}`);

/**
 * One calendar entry (an .ics file) for a club's tryout, so "Add to calendar" puts it in the family's own calendar.
 * Two hours long when the club gave only a start.
 */
export function tryoutIcs(tryout: { id: number; title: string; clubName: string; tryoutDate: string; location?: string | null }, now = new Date()) {
    const end = new Date(new Date(tryout.tryoutDate).getTime() + 2 * 3600000).toISOString();
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GrassKickZ//Tryouts//EN', 'BEGIN:VEVENT', `UID:tryout-${tryout.id}@grasskickz`,
        `DTSTAMP:${icsDate(now.toISOString())}`, `DTSTART:${icsDate(tryout.tryoutDate)}`, `DTEND:${icsDate(end)}`,
        `SUMMARY:${icsText(`${tryout.title} · ${tryout.clubName}`)}`, ...(tryout.location ? [`LOCATION:${icsText(tryout.location)}`] : []),
        'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

/** The group's own address, which a shared link opens: the pop-up for a signed-in parent, the public page otherwise. */
export const groupShareUrl = (groupId: number, origin = window.location.origin) => `${origin}/admissions/opportunities/${groupId}`;
