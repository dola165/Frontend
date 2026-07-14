import type { StoreUser, StoreClub, StorePost, StoreComment } from './store';

let userIdCounter = 10;
let clubIdCounter = 10;
let postIdCounter = 100;
let commentIdCounter = 200;

export const resetFactoryCounters = () => {
  userIdCounter = 10;
  clubIdCounter = 10;
  postIdCounter = 100;
  commentIdCounter = 200;
};

export const createUser = (overrides: Partial<StoreUser> & { email: string; password: string }): StoreUser => ({
  id: overrides.id ?? userIdCounter++,
  email: overrides.email,
  password: overrides.password,
  username: overrides.username ?? `user_${userIdCounter}`,
  fullName: overrides.fullName ?? undefined,
  name: overrides.name ?? undefined,
  role: overrides.role ?? 'PLAYER',
  avatarUrl: overrides.avatarUrl ?? undefined,
  profileComplete: overrides.profileComplete ?? true,
  bio: overrides.bio,
  position: overrides.position,
});

export const createClub = (overrides: Partial<StoreClub> & { name: string; ownerId: number }): StoreClub => ({
  id: overrides.id ?? clubIdCounter++,
  name: overrides.name,
  slug: overrides.slug ?? overrides.name.toLowerCase().replace(/\s+/g, '-'),
  description: overrides.description ?? 'A great football club.',
  logoUrl: overrides.logoUrl ?? null,
  bannerUrl: overrides.bannerUrl ?? null,
  city: overrides.city ?? 'London',
  memberCount: overrides.memberCount ?? 1,
  ownerId: overrides.ownerId,
  joinPolicy: overrides.joinPolicy ?? 'OPEN_TRIAL',
  createdAt: overrides.createdAt ?? new Date().toISOString(),
});

export const createPost = (overrides: { authorId: number; clubId?: number | null; content: string }): StorePost => ({
  id: postIdCounter++,
  authorId: overrides.authorId,
  clubId: overrides.clubId ?? null,
  content: overrides.content,
  imageUrl: null,
  likeCount: 0,
  commentCount: 0,
  createdAt: new Date().toISOString(),
});

export const createComment = (overrides: { postId: number; authorId: number; content: string }): StoreComment => ({
  id: commentIdCounter++,
  postId: overrides.postId,
  authorId: overrides.authorId,
  content: overrides.content,
  createdAt: new Date().toISOString(),
});
