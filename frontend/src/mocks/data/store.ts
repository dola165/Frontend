import type { AuthUser } from '../../context/AuthContext';

// ---------------------------------------------------------------------------
// In-memory store — shared across all handler modules. Resets on page reload.
// ---------------------------------------------------------------------------

export interface StoreUser extends AuthUser {
  email: string;
  password: string;
  bio?: string;
  position?: string;
}

export interface StoreClub {
  id: number;
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  city: string;
  memberCount: number;
  ownerId: number;
  joinPolicy: 'OPEN_TRIAL' | 'APPLICATION_REQUIRED' | 'INVITE_ONLY';
  createdAt: string;
}

export interface StorePost {
  id: number;
  authorId: number;
  clubId: number | null;
  content: string;
  imageUrl: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

export interface StoreComment {
  id: number;
  postId: number;
  authorId: number;
  content: string;
  createdAt: string;
}

export interface StoreEvent {
  eventId: number;
  occurrenceId: string;
  clubId: number | null;
  clubName: string | null;
  userId: number | null;
  eventType: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  locationName: string | null;
  locationLat: number | null;
  locationLng: number | null;
  visibility: string;
  publishAt: string | null;
  publicNow: boolean;
  recurring: boolean;
  recurrence: Record<string, unknown> | null;
  opponentClubId: number | null;
  opponentClubName: string | null;
  challengeStatus: string | null;
  status: string;
  conflict: boolean;
  conflictingEventIds: number[];
}

// ---- store instance ----

let _users: Map<number, StoreUser> | null = null;
let _clubs: Map<number, StoreClub> | null = null;
let _posts: Map<number, StorePost> | null = null;
let _comments: Map<number, StoreComment> | null = null;
let _events: Map<number, StoreEvent> | null = null;
let _currentUserId: number | null = null;
let _followedClubIds: Set<number> | null = null;
let _nextEventId = 100;

export const users = () => { if (!_users) _users = new Map(); return _users; };
export const clubs = () => { if (!_clubs) _clubs = new Map(); return _clubs; };
export const posts = () => { if (!_posts) _posts = new Map(); return _posts; };
export const comments = () => { if (!_comments) _comments = new Map(); return _comments; };
export const events = () => { if (!_events) _events = new Map(); return _events; };
export const currentUserId = (v?: number | null) => { if (v !== undefined) _currentUserId = v; return _currentUserId; };
export const followedClubIds = () => { if (!_followedClubIds) _followedClubIds = new Set(); return _followedClubIds; };
export const nextEventId = () => { const id = _nextEventId; _nextEventId++; return id; };

export const resetStore = () => {
  _users = null;
  _clubs = null;
  _posts = null;
  _comments = null;
  _events = null;
  _currentUserId = null;
  _followedClubIds = null;
  _nextEventId = 100;
};
