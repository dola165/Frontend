// FC Dinamo Tbilisi Academy's projects (step 4): invented goals, steps, talk and fundraisers, all fictional. Luka also
// helps at Gldani Juniors, which is not verified yet, so the club switch and "public once verified" show. Every
// fundraiser is a project's money part: the public fundraiser record (world-football's campaigns) is the project's
// fundraiser itself. Shapes follow ProjectDto (backend) and src/features/projects/api.ts.
import * as W from './world.mjs';
import * as F from './world-football.mjs';
import { ensurePerson } from './world-club.mjs';

export const CLUB_ID = 1;
export const GLDANI = 6;
/** The clubs Luka runs projects at, as an admin. */
export const CLUBS = [CLUB_ID, GLDANI];
// The people the project personas stand in for (sandbox ids 7401–7404).
export const irakli = ensurePerson({ id: 7401, first: 'Irakli', last: 'Kapanadze', role: 'STAFF', birthYear: 1986, clubId: 1, headline: 'Commercial and sponsorship · FC Dinamo Tbilisi Academy' });
export const levan = ensurePerson({ id: 7402, first: 'Levan', last: 'Beridze', role: 'STAFF', birthYear: 1979, clubId: 1, headline: 'Facilities coordinator · FC Dinamo Tbilisi Academy' });
export const nana = ensurePerson({ id: 7403, first: 'Nana', last: 'Beridze', gender: 'FEMALE', role: 'PARENT', birthYear: 1984, headline: 'U12 parent · kit committee' });
export const giorgi = ensurePerson({ id: 7404, first: 'Giorgi', last: 'Bakradze', role: 'STAFF', birthYear: 1981, clubId: 1, headline: 'Fees · FC Dinamo Tbilisi Academy' });

const u12 = W.squads.find(s => s.clubId === CLUB_ID && s.name === 'U12 Mixed');
const day = offset => W.isoDate(W.day(offset));
const at = hours => new Date(W.NOW.getTime() - hours * 3600000).toISOString();

let nextId = 8800;
export const newId = () => ++nextId;
/** A parent or volunteer added to a project by name (phase B2): a new sandbox person. */
export const newHelper = name => { const [first, ...rest] = String(name).trim().split(/\s+/); return ensurePerson({ id: newId(), first, last: rest.join(' ') || '', role: 'PARENT' }); };
/** The club's staff in the sandbox: whoever else is on a project helps on it (a parent or volunteer). */
export const STAFF_IDS = [W.ME_ID, 7401, 7402, 7404];
const step = (title, personId, done, dayOffset = null) => ({ id: newId(), title, personId, done, day: dayOffset == null ? null : day(dayOffset), version: done ? 1 : 0 });
// A seeded public fundraiser as a project's: who reported its amount and who published it.
const fundraiserOf = (id, reportedBy, publishedBy) => Object.assign(F.campaignById(id), { reportedBy, publishedBy });
// The U12 kit fundraiser, made here and listed with the others.
const kit = { id: 9101, clubId: CLUB_ID, clubName: W.clubById(CLUB_ID).name, clubLogoUrl: W.clubById(CLUB_ID).logoUrl ?? null, country: 'Georgia', city: 'Tbilisi',
    title: 'New kit for U12', summary: 'New kit for the U12 squad', description: '22 sets of shirts, shorts and socks before the winter league.', beneficiary: 'U12 Mixed',
    useOfFunds: 'Shirts, shorts and socks', category: 'EQUIPMENT', currency: 'GEL', goalAmount: 2000, reportedAmount: 1240, reportedNote: 'Reported by the club',
    reportedAt: at(48), startsOn: null, endsOn: null, images: ['/football/touchline.jpg'], status: 'PUBLISHED', phase: 'ACTIVE', version: 4, updatedAt: at(5),
    publishedAt: at(96), updates: [], donateUrl: 'https://www.gofundme.com/f/dinamo-u12-kit', donations: 31, reportedBy: irakli.id, publishedBy: irakli.id };
if (!F.campaignById(kit.id)) F.campaigns.push(kit);

/** Each project as the server keeps it; the handler reads them as each person sees them. */
export const projects = [
    {
        id: newId(), clubId: CLUB_ID, goal: 'New kit for U12', purpose: '22 sets before the winter league.', status: 'NOW', squadId: u12?.id ?? null, dueOn: day(28),
        target: { amount: 2000, currency: 'GEL' }, createdBy: irakli.id, added: [nana.id], updatedAt: at(5), version: 3,
        steps: [step('Ask families for sizes', nana.id, true), step('Start the fundraiser', irakli.id, true), step('Choose a quote', irakli.id, false, 2),
            step('Order and pay', giorgi.id, false), step('Hand out at training', W.ME_ID, false, 24)],
        talk: [{ id: newId(), authorId: nana.id, body: 'Sport House can do 22 sets by 20 November. Quote B.', createdAt: at(30), editedAt: null },
            { id: newId(), authorId: irakli.id, body: 'B looks right. I\'ll confirm on Friday.', createdAt: at(6), editedAt: null }],
        files: [{ id: newId(), kind: 'FILE', url: '/sandbox-media/file/quote-a.pdf', name: 'Quote A – Sport House.pdf', contentType: 'application/pdf', sizeBytes: 182000, uploadedBy: nana.id, createdAt: at(31) },
            { id: newId(), kind: 'FILE', url: '/sandbox-media/file/quote-b.pdf', name: 'Quote B – Kit Centre.pdf', contentType: 'application/pdf', sizeBytes: 164000, uploadedBy: nana.id, createdAt: at(30) }],
        history: [{ at: at(5), by: irakli.id, text: 'Updated the amount raised' }, { at: at(48), by: irakli.id, text: 'Published the fundraiser' }, { at: at(120), by: irakli.id, text: 'Started' }],
        fundraiser: F.campaignById(kit.id),
    },
    {
        id: newId(), clubId: CLUB_ID, goal: 'New floodlights for Pitch 3', purpose: 'Light the small-sided pitch so U12s can train after school in winter.', status: 'NOW', squadId: null,
        dueOn: null, target: { amount: 45000, currency: 'GEL' }, createdBy: irakli.id, added: [levan.id], updatedAt: at(60), version: 2,
        steps: [step('Set the target', irakli.id, true), step('Start the fundraiser', irakli.id, true), step('Book the electrician', levan.id, false, 14)], talk: [], files: [],
        history: [{ at: at(60), by: irakli.id, text: 'Updated the amount raised' }, { at: at(960), by: irakli.id, text: 'Started' }],
        fundraiser: fundraiserOf(1201, irakli.id, irakli.id),
    },
    {
        id: newId(), clubId: CLUB_ID, goal: 'Sponsor for 2027: Kartuli Bank', purpose: null, status: 'NOW', squadId: null, dueOn: day(4), target: null, createdBy: irakli.id, added: [], updatedAt: at(20), version: 2,
        steps: [step('Contact the business', irakli.id, true), step('Send an offer', irakli.id, false, 3), step('Agree', irakli.id, false), step('Add their logo to the club page', irakli.id, false)],
        talk: [], files: [], history: [{ at: at(20), by: irakli.id, text: 'Contact the business: Done' }, { at: at(200), by: irakli.id, text: 'Started' }], fundraiser: null,
    },
    {
        id: newId(), clubId: CLUB_ID, goal: 'Goals for Pitch 2', purpose: 'Two 5 × 2 m goals for the small-sided games.', status: 'NOW', squadId: null, dueOn: null, target: null, createdBy: levan.id, added: [], updatedAt: at(50), version: 1,
        steps: [step('Get quotes', levan.id, false, 5), step('Choose one', levan.id, false), step('Pay', giorgi.id, false), step('Hand out', levan.id, false)],
        talk: [{ id: newId(), authorId: levan.id, body: 'Waiting on a second quote from Arena Sport.', createdAt: at(50), editedAt: null }], files: [], history: [{ at: at(52), by: levan.id, text: 'Started' }], fundraiser: null,
    },
    {
        id: newId(), clubId: CLUB_ID, goal: 'Summer tournament trip', purpose: 'Batumi Cup in July for U14 Boys.', status: 'LATER', squadId: W.squads.find(s => s.clubId === CLUB_ID && s.name === 'U14 Boys')?.id ?? null, dueOn: null,
        target: { amount: 3500, currency: 'GEL' }, createdBy: irakli.id, added: [], updatedAt: at(240), version: 1,
        steps: [step('Set the target', irakli.id, true), step('Start the fundraiser', irakli.id, false), step('Thank the givers', irakli.id, false)], talk: [], files: [], history: [{ at: at(240), by: irakli.id, text: 'Started' }], fundraiser: null,
    },
    {
        id: newId(), clubId: CLUB_ID, goal: 'Floodlights for the small pitch', purpose: 'Evening sessions in winter.', status: 'IDEA', squadId: null, dueOn: null, target: null, createdBy: levan.id, added: [], updatedAt: at(400), version: 0,
        steps: [], talk: [], files: [], history: [{ at: at(400), by: levan.id, text: 'Started' }], fundraiser: null,
    },
    {
        id: newId(), clubId: CLUB_ID, goal: 'Balls for U10', purpose: null, status: 'DONE', squadId: null, dueOn: null, target: null, createdBy: levan.id, added: [], updatedAt: at(900), version: 4,
        steps: [step('Get quotes', levan.id, true), step('Choose one', levan.id, true), step('Pay', giorgi.id, true), step('Hand out', levan.id, true)], talk: [], files: [], history: [{ at: at(900), by: levan.id, text: 'Done' }], fundraiser: null,
    },
    // Gldani Juniors isn't verified: its fundraiser, published before step 4, works inside the club only.
    {
        id: newId(), clubId: GLDANI, goal: 'Gldani changing room renovation', purpose: 'Warm, safe changing rooms for 200 local children.', status: 'NOW', squadId: null, dueOn: null,
        target: { amount: 12000, currency: 'GEL' }, createdBy: W.ME_ID, added: [], updatedAt: at(70), version: 1,
        steps: [step('Get quotes', W.ME_ID, true), step('Book the builders', W.ME_ID, false, 10)], talk: [], files: [], history: [{ at: at(1400), by: W.ME_ID, text: 'Started' }],
        fundraiser: fundraiserOf(1204, W.ME_ID, W.ME_ID),
    },
];
