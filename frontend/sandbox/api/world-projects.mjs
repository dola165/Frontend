// FC Dinamo Tbilisi Academy's projects (step 4): invented goals, steps, talk and one fundraiser, all fictional.
// Shapes follow ProjectDto (backend) and src/features/projects/api.ts.
import * as W from './world.mjs';
import { ensurePerson } from './world-club.mjs';

export const CLUB_ID = 1;
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
const step = (title, personId, done, dayOffset = null) => ({ id: newId(), title, personId, done, day: dayOffset == null ? null : day(dayOffset), version: done ? 1 : 0 });

/** Each project as the server keeps it; the handler reads them as each person sees them. */
export const projects = [
    {
        id: newId(), goal: 'New kit for U12', purpose: '22 sets before the winter league.', status: 'NOW', squadId: u12?.id ?? null, dueOn: day(28),
        target: { amount: 2000, currency: 'GEL' }, createdBy: irakli.id, added: [nana.id], updatedAt: at(5), version: 3,
        steps: [step('Ask families for sizes', nana.id, true), step('Start the fundraiser', irakli.id, true), step('Choose a quote', irakli.id, false, 2),
            step('Order and pay', giorgi.id, false), step('Hand out at training', W.ME_ID, false, 24)],
        talk: [{ id: newId(), authorId: nana.id, body: 'Sport House can do 22 sets by 20 November. Quote B.', createdAt: at(30), editedAt: null },
            { id: newId(), authorId: irakli.id, body: 'B looks right. I\'ll confirm on Friday.', createdAt: at(6), editedAt: null }],
        files: [{ id: newId(), kind: 'FILE', url: '/sandbox-media/file/quote-a.pdf', name: 'Quote A – Sport House.pdf', contentType: 'application/pdf', sizeBytes: 182000, uploadedBy: nana.id, createdAt: at(31) },
            { id: newId(), kind: 'FILE', url: '/sandbox-media/file/quote-b.pdf', name: 'Quote B – Kit Centre.pdf', contentType: 'application/pdf', sizeBytes: 164000, uploadedBy: nana.id, createdAt: at(30) }],
        history: [{ at: at(5), by: irakli.id, text: 'Updated the amount raised' }, { at: at(48), by: irakli.id, text: 'Published the fundraiser' }, { at: at(120), by: irakli.id, text: 'Started' }],
        fundraiser: { id: 9101, status: 'PUBLISHED', phase: 'ACTIVE', donateUrl: 'https://www.gofundme.com/f/dinamo-u12-kit', reportedAmount: 1240, reportedNote: 'Reported by the club',
            reportedBy: irakli.id, reportedAt: at(48), publishedBy: irakli.id, publishedAt: at(96), version: 4 },
    },
    {
        id: newId(), goal: 'Sponsor for 2027: Kartuli Bank', purpose: null, status: 'NOW', squadId: null, dueOn: day(4), target: null, createdBy: irakli.id, added: [], updatedAt: at(20), version: 2,
        steps: [step('Contact the business', irakli.id, true), step('Send an offer', irakli.id, false, 3), step('Agree', irakli.id, false), step('Add their logo to the club page', irakli.id, false)],
        talk: [], files: [], history: [{ at: at(20), by: irakli.id, text: 'Contact the business: Done' }, { at: at(200), by: irakli.id, text: 'Started' }], fundraiser: null,
    },
    {
        id: newId(), goal: 'Goals for Pitch 2', purpose: 'Two 5 × 2 m goals for the small-sided games.', status: 'NOW', squadId: null, dueOn: null, target: null, createdBy: levan.id, added: [], updatedAt: at(50), version: 1,
        steps: [step('Get quotes', levan.id, false, 5), step('Choose one', levan.id, false), step('Pay', giorgi.id, false), step('Hand out', levan.id, false)],
        talk: [{ id: newId(), authorId: levan.id, body: 'Waiting on a second quote from Arena Sport.', createdAt: at(50), editedAt: null }], files: [], history: [{ at: at(52), by: levan.id, text: 'Started' }], fundraiser: null,
    },
    {
        id: newId(), goal: 'Summer tournament trip', purpose: 'Batumi Cup in July for U14 Boys.', status: 'LATER', squadId: W.squads.find(s => s.clubId === CLUB_ID && s.name === 'U14 Boys')?.id ?? null, dueOn: null,
        target: { amount: 3500, currency: 'GEL' }, createdBy: irakli.id, added: [], updatedAt: at(240), version: 1,
        steps: [step('Set the target', irakli.id, true), step('Start the fundraiser', irakli.id, false), step('Thank the givers', irakli.id, false)], talk: [], files: [], history: [{ at: at(240), by: irakli.id, text: 'Started' }], fundraiser: null,
    },
    {
        id: newId(), goal: 'Floodlights for the small pitch', purpose: 'Evening sessions in winter.', status: 'IDEA', squadId: null, dueOn: null, target: null, createdBy: levan.id, added: [], updatedAt: at(400), version: 0,
        steps: [], talk: [], files: [], history: [{ at: at(400), by: levan.id, text: 'Started' }], fundraiser: null,
    },
    {
        id: newId(), goal: 'Balls for U10', purpose: null, status: 'DONE', squadId: null, dueOn: null, target: null, createdBy: levan.id, added: [], updatedAt: at(900), version: 4,
        steps: [step('Get quotes', levan.id, true), step('Choose one', levan.id, true), step('Pay', giorgi.id, true), step('Hand out', levan.id, true)], talk: [], files: [], history: [{ at: at(900), by: levan.id, text: 'Done' }], fundraiser: null,
    },
];
