import { createUser, createClub, createPost, createComment, resetFactoryCounters } from './factories';
import { users, clubs, posts, comments, currentUserId, followedClubIds, events, nextEventId, resetStore, products, type StoreProduct } from './store';
import { resetIds } from './ids';

export const seed = () => {
  resetStore();
  resetIds();
  resetFactoryCounters();

  // -- users --
  // Adult DOBs so the minors framework (allowlist, private profiles, gates)
  // treats every demo persona as an adult — except the two intentional ones below.
  const u1 = createUser({ id: 1, email: 'player@test.dev', password: 'mock', username: 'marcus.r', fullName: 'Marcus Rivera', role: 'PLAYER', position: 'Forward', bio: 'Sunday league forward. Always looking for a game.', dob: '1998-05-14' });
  const u2 = createUser({ id: 2, email: 'organizer@test.dev', password: 'mock', username: 'sarah.c', fullName: 'Sarah Chen', role: 'ORGANIZER', dob: '1992-09-02' });
  const u3 = createUser({ id: 3, email: 'coach@test.dev', password: 'mock', username: 'james.w', fullName: 'James Wilson', role: 'COACH', position: 'Head Coach', dob: '1985-01-23' });
  const u4 = createUser({ id: 4, email: 'fan@test.dev', password: 'mock', username: 'emma.t', fullName: 'Emma Thompson', role: 'FAN', profileComplete: false, dob: '2000-07-30' });
  const u5 = createUser({ id: 5, email: 'admin@test.dev', password: 'mock', username: 'alex.k', fullName: 'Alex Kim', role: 'ADMIN', dob: '1981-11-05' });

  // Minors-framework demo personas: a 14-year-old player (consent PENDING on
  // the Creekside affiliation) and their guardian — powers the DM allowlist,
  // private-profile, and consent flows in mock mode.
  const u6 = createUser({ id: 6, email: 'youth@test.dev', password: 'mock', username: 'saba.y', fullName: 'Saba Youth', role: 'PLAYER', position: 'Goalkeeper', dob: `${new Date().getFullYear() - 14}-08-01` });
  const u7 = createUser({ id: 7, email: 'parent@test.dev', password: 'mock', username: 'nino.p', fullName: 'Nino Parent', role: 'FAN', dob: `${new Date().getFullYear() - 38}-03-20` });

  [u1, u2, u3, u4, u5, u6, u7].forEach((u) => users().set(u.id, u));

  // -- clubs --
  const c1 = createClub({ id: 1, name: 'Creekside FC', ownerId: u1.id, city: 'Bristol', description: 'Grassroots community club. Open trials every Saturday.', joinPolicy: 'OPEN_TRIAL', memberCount: 42 });
  const c2 = createClub({ id: 2, name: 'Metro United Academy', ownerId: u2.id, city: 'Manchester', description: 'Youth development academy. U14–U18 squads competing in regional leagues.', joinPolicy: 'APPLICATION_REQUIRED', memberCount: 128 });
  const c3 = createClub({ id: 3, name: 'Lakeside Athletic', ownerId: u3.id, city: 'London', description: 'Semi-professional club. First team in the Isthmian League.', joinPolicy: 'INVITE_ONLY', memberCount: 56 });

  [c1, c2, c3].forEach((c) => clubs().set(c.id, c));

  // -- store products (WEB_APP_MASTER_PLAN.md §4.1, Phase 3) --
  let nextProductId = 1;
  const seedProduct = (clubId: number, clubName: string, name: string, description: string | null, price: number, sizes: string[], imageSeed: string, category: string, city: string) => {
    const product: StoreProduct = {
      id: nextProductId++,
      clubId,
      clubName,
      clubLogoUrl: null,
      clubWhatsappNumber: null,
      clubEmail: null,
      name,
      description,
      price,
      sizes,
      images: [`https://picsum.photos/seed/${imageSeed}/800/800`],
      active: true,
      createdAt: new Date().toISOString(),
      category,
      clubCityName: city,
      clubCountryName: 'United Kingdom',
    };
    products().set(product.id, product);
  };

  seedProduct(c1.id, c1.name, 'Home Kit 2026/27', 'Official home shirt — navy with white trim.', 65, ['S', 'M', 'L', 'XL'], 'store-creekside-kit', 'SHIRT', c1.city);
  seedProduct(c1.id, c1.name, 'Academy Scarf', 'Knitted club scarf in home colours.', 18, [], 'store-creekside-scarf', 'ACCESSORIES', c1.city);
  seedProduct(c1.id, c1.name, 'Training Top', 'Lightweight training top for academy sessions.', 40, ['M', 'L', 'XL'], 'store-creekside-top', 'TRAINING', c1.city);
  seedProduct(c1.id, c1.name, 'Matchday Ticket', 'General admission for the Saturday derby.', 8, [], 'store-creekside-ticket', 'TICKETS', c1.city);
  seedProduct(c2.id, c2.name, 'Academy Kit', 'Full academy kit — red and white.', 80, ['XS', 'S', 'M', 'L'], 'store-metro-kit', 'SHIRT', c2.city);
  seedProduct(c2.id, c2.name, 'Club Cap', 'Adjustable club cap — embroidered crest.', 22, [], 'store-metro-cap', 'ACCESSORIES', c2.city);
  seedProduct(c2.id, c2.name, 'Club Football', 'Size 5 training ball with the club crest.', 35, [], 'store-metro-ball', 'EQUIPMENT', c2.city);
  seedProduct(c3.id, c3.name, 'Home Kit 2026', 'Semi-pro home shirt, breathable match fabric.', 75, ['S', 'M', 'L'], 'store-lakeside-kit', 'SHIRT', c3.city);
  seedProduct(c3.id, c3.name, 'Winter Beanie', 'Club beanie for cold matchdays.', 20, [], 'store-lakeside-beanie', 'ACCESSORIES', c3.city);

  // -- posts --
  const p1 = createPost({ authorId: u1.id, clubId: c1.id, content: 'Great session this morning! The new 4-3-3 shape is starting to click. See everyone at the match on Saturday.' });
  const p2 = createPost({ authorId: u3.id, clubId: c2.id, content: 'Reminder: trialists need to submit their medical forms by Friday. No exceptions.' });
  const p3 = createPost({ authorId: u2.id, clubId: null, content: 'Excited to announce we\'ve partnered with a local physio clinic. All members get 20% off consultations.' });
  const p4 = createPost({ authorId: u1.id, clubId: c1.id, content: 'Man of the match last night! 2 goals and an assist. The team was on fire.' });
  const p5 = createPost({ authorId: u4.id, clubId: c3.id, content: 'Does anyone know if there\'s parking near the Lakeside ground? Coming for the cup game next week.' });
  const p6 = createPost({ authorId: u3.id, clubId: c3.id, content: 'Fitness test results are in. Squad averages have improved 12% since pre-season. Proud of the lads.' });
  const p7 = createPost({ authorId: u5.id, clubId: null, content: 'Platform update: new tournament bracket editor is live. Feedback welcome!' });
  const p8 = createPost({ authorId: u1.id, clubId: c1.id, content: 'Looking for a friendly next Sunday. Anyone free? DM me.' });
  const p9 = createPost({ authorId: u2.id, clubId: c2.id, content: 'U16s won 3-0 against Westbrook. Clean sheet and a hat-trick from our striker. Future is bright!' });
  const p10 = createPost({ authorId: u4.id, clubId: null, content: 'Just moved to the area — any recommendations for a casual 5-a-side league?' });

  const allPosts = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10];
  allPosts.forEach((p) => posts().set(p.id, p));

  // -- comments & like counts --
  const addComments = (postId: number, ...authors: number[]) => {
    authors.forEach((authorId, i) => {
      const cmt = createComment({ postId, authorId, content: sampleComments[i % sampleComments.length] });
      comments().set(cmt.id, cmt);
    });
    const post = posts().get(postId);
    if (post) {
      post.commentCount = authors.length;
      post.likeCount = authors.length + Math.floor(Math.random() * 5);
    }
  };

  addComments(p1.id, u2.id, u3.id);
  addComments(p4.id, u2.id, u3.id, u5.id);
  addComments(p3.id, u1.id, u4.id);
  addComments(p9.id, u1.id, u4.id, u5.id, u3.id);
  addComments(p2.id, u2.id);
  addComments(p7.id, u1.id);

  // -- login as player by default --
  currentUserId(u1.id);

  // -- auto-follow owned club so the following feed has content --
  followedClubIds().add(c1.id);

  // -- seed schedule events --
  const e1 = nextEventId();
  const e2 = nextEventId();
  const e3 = nextEventId();

  events().set(e1, {
    eventId: e1, occurrenceId: `occ-${e1}`, clubId: 1, clubName: 'Creekside FC', userId: 1,
    eventType: 'MATCH', title: 'Friendly vs Westbrook', description: 'Warm-up at 14:30.',
    startsAt: '2026-06-10T15:00:00Z', endsAt: '2026-06-10T17:00:00Z',
    locationName: 'Creekside Main Pitch', locationLat: 51.4545, locationLng: -2.5879,
    visibility: 'PUBLIC', publishAt: null, publicNow: true,
    recurring: false, recurrence: null,
    opponentClubId: null, opponentClubName: null, challengeStatus: null,
    status: 'SCHEDULED', conflict: false, conflictingEventIds: [],
  });

  events().set(e2, {
    eventId: e2, occurrenceId: `occ-${e2}`, clubId: 1, clubName: 'Creekside FC', userId: 1,
    eventType: 'TRYOUT', title: 'Open Trials — U16', description: 'Looking for U16 forwards.',
    startsAt: '2026-06-14T10:00:00Z', endsAt: '2026-06-14T12:00:00Z',
    locationName: 'Creekside Training Ground', locationLat: 51.4545, locationLng: -2.5879,
    visibility: 'PUBLIC', publishAt: null, publicNow: true,
    recurring: false, recurrence: null,
    opponentClubId: null, opponentClubName: null, challengeStatus: null,
    status: 'SCHEDULED', conflict: false, conflictingEventIds: [],
  });

  events().set(e3, {
    eventId: e3, occurrenceId: `occ-${e3}`, clubId: 1, clubName: 'Creekside FC', userId: 1,
    eventType: 'TRAINING', title: 'Team Training', description: 'Weekly training session.',
    startsAt: '2026-06-07T09:00:00Z', endsAt: '2026-06-07T11:00:00Z',
    locationName: 'Creekside Main Pitch', locationLat: 51.4545, locationLng: -2.5879,
    visibility: 'SCHEDULED_PUBLICATION', publishAt: '2026-06-06T09:00:00Z', publicNow: false,
    recurring: false, recurrence: null,
    opponentClubId: null, opponentClubName: null, challengeStatus: null,
    status: 'SCHEDULED', conflict: false, conflictingEventIds: [],
  });

  const e4 = nextEventId();
  events().set(e4, {
    eventId: e4, occurrenceId: `occ-${e4}`, clubId: 3, clubName: 'Lakeside Athletic', userId: 3,
    eventType: 'MATCH', title: 'Community Cup — Round 1', description: 'Public community match.',
    startsAt: '2026-06-21T14:00:00Z', endsAt: '2026-06-21T16:00:00Z',
    locationName: 'Lakeside Stadium', locationLat: 51.5074, locationLng: -0.1278,
    visibility: 'PUBLIC', publishAt: null, publicNow: true,
    recurring: false, recurrence: null,
    opponentClubId: null, opponentClubName: null, challengeStatus: 'OPEN',
    status: 'SCHEDULED', conflict: false, conflictingEventIds: [],
  });
};

const sampleComments = [
  'Well said!',
  'Congrats! Keep it up.',
  'Can\'t wait for this.',
  'Thanks for sharing.',
  'Count me in.',
  'Great work!',
];

// auto-seed on first import
seed();
