import type { BoxKey, SetupKey } from '../model/kinds';

/** The ghost words of each setup item, named in the ring as the next thing to do. */
export const SETUP_WORDS: Record<SetupKey, string> = {
  name: 'Name your page', crest: 'Add your crest', grounds: 'Where do you play?', squads: 'Which ages?', contact: 'How to reach you', fees: 'What does it cost?',
  players: 'Invite the players', staff: 'Invite coaches & staff', posts: 'Write the first post', about: 'Say what you are', sponsors: 'Who do you back?',
};

/** The words on a tray chip: what the box is, in two or three words. */
export const BOX_NAMES: Record<BoxKey, string> = {
  contact: 'Contact', fees: 'Fees', grounds: 'Grounds', squads: 'Teams', posts: 'Posts', involved: 'Store · Jobs · Fundraising', staff: 'Coaches and staff',
  events: 'Coming up', sponsors: 'Sponsors', honours: 'Honours', bookings: 'Bookings',
};
