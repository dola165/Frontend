import { Building2, CalendarDays, Coins, MapPin, Medal, Phone, ShoppingBag, UserPlus, Users } from 'lucide-react';
import type { BoxRenderers } from '../edit/boxRegistry';
import { ContactBox } from './ContactBox';
import { EventsBox } from './EventsBox';
import { FeesBox } from './FeesBox';
import { GroundsBox, HonoursBox, InvolvedBox, SponsorsBox, SquadsBox, StaffBox } from './ListBoxes';

/**
 * Every box as the page DNA draws it. A page kind only decides which start switched on; a club page may replace any
 * view with its own (the Home chat's blocks) while keeping these ghosts and editors.
 */
export const defaultBoxes: BoxRenderers = {
  contact: { View: ContactBox, icon: Phone, words: 'How to reach you', hint: 'Phone, WhatsApp, email', filled: page => Boolean(page.identity.contact.phone || page.identity.contact.email || page.identity.social.website || page.identity.social.instagram || page.identity.social.facebook) },
  fees: { View: FeesBox, icon: Coins, words: 'What does it cost?', hint: 'From – to a month, or free', filled: page => page.boxes.fees.band !== null },
  grounds: { View: GroundsBox, icon: MapPin, words: 'Where do you play?', hint: 'Pick a pitch on the map', panel: 'grounds', filled: page => page.boxes.grounds.items.length > 0 },
  squads: { View: SquadsBox, icon: Users, words: 'Which teams?', hint: 'Boys, girls or both, by birth year', panel: 'squads', filled: page => page.boxes.squads.items.length > 0 },
  staff: { View: StaffBox, icon: UserPlus, words: 'Invite coaches & staff', hint: 'They get an account and act for the club', panel: 'staff', filled: page => page.boxes.staff.members.length > 1 || page.boxes.staff.invites.length > 0 },
  sponsors: { View: SponsorsBox, icon: Building2, words: 'Who backs you?', hint: 'Sponsors and partners', filled: page => page.boxes.sponsors.items.length > 0 },
  honours: { View: HonoursBox, icon: Medal, words: 'Add an honour', hint: 'Cups, leagues, awards', filled: page => page.boxes.honours.items.length > 0 },
  events: { View: EventsBox, icon: CalendarDays, words: 'What’s coming up', hint: 'From the club calendar', filled: page => page.clubId !== null },
  involved: { View: InvolvedBox, icon: ShoppingBag, words: 'Sell, hire or raise', hint: 'Store, jobs, fundraising', filled: page => page.boxes.involved.parts.length > 0 },
};
