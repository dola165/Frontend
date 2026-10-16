import { AlignLeft, Coins, Handshake, Link2, MapPin, MessageSquare, Phone, Shield, Type, UserPlus, Users, type LucideIcon } from 'lucide-react';
import type { BoxKey, PageKind, SetupKey } from '../model/kinds';

/** The picture of each setup step, in the steps list and the bar's current step. */
export const STEP_ICONS: Record<SetupKey, LucideIcon> = { name: Type, crest: Shield, about: AlignLeft, grounds: MapPin, squads: Users, contact: Phone, fees: Coins, players: Link2, staff: UserPlus, posts: MessageSquare, sponsors: Handshake };

/** The ghost words of each setup item, named in the ring as the next thing to do. */
export const SETUP_WORDS: Record<SetupKey, string> = {
  name: 'Name your page', crest: 'Add your crest', grounds: 'Where do you play?', squads: 'Which teams?', contact: 'How to reach you', fees: 'What does it cost?',
  players: 'Invite the players', staff: 'Invite coaches & staff', posts: 'Write the first post', about: 'Say what you are', sponsors: 'Who do you back?',
};

/** One line under each step, what it gives the club. */
export const STEP_WHY: Record<SetupKey, string> = {
  name: 'How people find you', crest: 'Your badge, everywhere', about: 'The one or two lines visitors read first', grounds: 'Puts you on the map',
  squads: 'Makes the calendar and the join links', contact: 'Phone and WhatsApp for parents', fees: 'Shows in parents’ searches', players: 'One link per squad to share',
  staff: 'They act for the club', posts: 'What visitors see first', sponsors: 'Who you back',
};

/** The words on a tray chip: what the box is, in two or three words. */
export const BOX_NAMES: Record<BoxKey, string> = {
  contact: 'Contact', fees: 'Fees', grounds: 'Grounds', squads: 'Teams', posts: 'Posts', involved: 'Store · Jobs · Fundraising', staff: 'Coaches and staff',
  events: 'Coming up', sponsors: 'Sponsors', honours: 'Honours', bookings: 'Bookings',
};

/** Where a page type says it differently: a fan club meets rather than plays, a business has a team rather than coaches. */
const KIND_WORDS: Partial<Record<PageKind, Partial<Record<SetupKey | BoxKey, { words: string; hint?: string; why?: string }>>>> = {
  FAN_CLUB: {
    grounds: { words: 'Where do you meet?', hint: 'Pick the place on the map', why: 'Puts you on the map' },
    fees: { words: 'What does membership cost?', hint: 'A month, or free', why: 'Shown on your page' },
    staff: { words: 'Invite your committee', hint: 'They help run the page', why: 'They help run the page' },
  },
  BUSINESS: { staff: { words: 'Invite your team', hint: 'They help run the page', why: 'They help run the page' }, sponsors: { words: 'Which clubs do you back?', hint: 'Clubs and teams you support' } },
  PAGE: { staff: { words: 'Invite your team', hint: 'They help run the page', why: 'They help run the page' } },
};
/** A set-up step's name for this page type. */
export const stepWords = (kind: PageKind, key: SetupKey) => KIND_WORDS[kind]?.[key]?.words ?? SETUP_WORDS[key];
/** What a set-up step gives this page type. */
export const stepWhy = (kind: PageKind, key: SetupKey) => KIND_WORDS[kind]?.[key]?.why ?? STEP_WHY[key];
/** An empty box's words for this page type, else the box's own. */
export const ghostWords = (kind: PageKind, key: BoxKey, fallback: { words: string; hint?: string }) => ({ words: KIND_WORDS[kind]?.[key]?.words ?? fallback.words, hint: KIND_WORDS[kind]?.[key]?.hint ?? fallback.hint });
