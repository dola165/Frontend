// Synthetic API: the squad page seen by a parent (parent mode only; see ../world-family.mjs).
// In U12 Mixed Luka is only Saba's parent: the squad answers with `can_manage: false`, his own private thread with
// the coaches and the coach's updates to acknowledge. U14 Boys stays his to coach (a parent who is also the coach).
// The coach-side answers come from social.mjs; this file asks it first (`passOn`) and narrows the result.
import { get, post, reply, handleApi } from '../router.mjs';
import * as W from '../world.mjs';
import * as S from '../world-social.mjs';
import { familyRequest, U12, SABA } from '../world-family.mjs';

const PASS = 'x-sandbox-family-pass';
const parentOnly = (headers, id) => familyRequest(headers) && !headers[PASS] && Number(id) === U12;
const passOn = async req => (await handleApi({ ...req, headers: { ...req.headers, [PASS]: '1' } }))?.body;
const COACH = W.squadById(U12).headCoachId;
const minutesAgo = minutes => new Date(Date.now() - minutes * 60000);

// The coach's updates, chat and Luka's private thread in U12 Mixed.
const post_ = (fields) => S.squadMessages.push({ id: S.newSquadMessageId(), squadId: U12, authorId: COACH, threadUserId: null, kind: 'ANNOUNCEMENT', title: null, important: false, expiresAt: null, reactions: new Map(), comments: [], acknowledged: new Map(), ...fields });
if (!S.squadMessages.some(m => m.squadId === U12)) {
  const players = W.squadById(U12).playerIds, families = S.familiesOf(U12);
  post_({ title: 'Well played on Sunday', body: 'Three good halves of football and lots of passing. Video clips will be shared in the squad chat.', createdAt: minutesAgo(5 * 24 * 60) });
  post_({ title: 'New training tops', body: 'The new blue training tops are in. Each player gets one at Tuesday’s session; sizes were taken last week.', createdAt: minutesAgo(2 * 24 * 60), reactions: new Map([[families[1], 'LIKE'], [families[4], 'HEART']]) });
  post_({ title: 'Autumn tournament in Rustavi', body: 'Saturday 9:30, Rustavi Community FC ground. We leave the Digomi gate at 8:15 by bus; back by 15:00. Bring the white kit, a packed lunch and water. Please confirm you have read this.', important: true, createdAt: minutesAgo(5 * 60), expiresAt: new Date(Date.now() + 5 * 86400000),
    acknowledged: new Map(families.filter(id => id !== W.ME_ID).slice(0, 7).map(id => [id, minutesAgo(200)])) });
  for (const [author, body, ago] of [[families[2], 'Can anyone give Luka a lift from Vake on Saturday?', 9 * 60], [families[5], 'We can, two free seats.', 9 * 60 - 20], [COACH, 'Thanks all. Bus is booked, so lifts only to the Digomi gate.', 6 * 60], [players[1], 'See you Tuesday!', 3 * 60]])
    post_({ kind: 'CHAT', authorId: author, body, createdAt: minutesAgo(ago) });
  for (const [author, body, ago] of [[COACH, 'Saba played really well in midfield on Sunday. Could he bring his own water bottle from now on?', 30 * 60], [W.ME_ID, 'Thank you! Yes, he will.', 29 * 60]])
    post_({ kind: 'CHAT', authorId: author, threadUserId: W.ME_ID, body, createdAt: minutesAgo(ago) });
}

// The parent's list: their coached squads, plus the child's squad as a family member.
get('/squad-communication', async req => {
  if (!familyRequest(req.headers) || req.headers[PASS]) return undefined;
  const mine = (await passOn(req)) ?? [];
  const space = (await passOn({ ...req, path: `/squad-communication/${U12}` }));
  return mine.some(s => s.id === U12) ? mine.map(s => s.id === U12 ? { ...s, can_manage: false } : s) : [...mine, { ...space, can_manage: false }];
});

get('/squad-communication/:id', async req => {
  if (!parentOnly(req.headers, req.params.id)) return undefined;
  const space = await passOn(req);
  if (!space) return undefined;
  // A parent sees one private thread (their own) and no coaching controls; the attention is theirs.
  return { ...space, can_manage: false, can_assign_coach: false, available_coaches: [], threads: [{ user_id: W.ME_ID, full_name: W.me.fullName, unread_count: 0 }],
    attention: { ...space.attention, acknowledgements_needed: 0 }, viewer_child_ids: [SABA] };
});

// Parents talk in the chat and their own thread; updates are the coaches'.
post('/squad-communication/:id/messages', req => {
  if (!parentOnly(req.headers, req.params.id)) return undefined;
  if (req.body?.kind !== 'CHAT') return reply(403, { status: 403, message: 'Only the coaches post updates in this squad.' });
  if (req.body?.threadUserId != null && Number(req.body.threadUserId) !== W.ME_ID) return reply(403, { status: 403, message: 'You can message the coaches in your own conversation.' });
  return undefined;
});

// The coaches' receipts are not a parent's to read.
get('/squad-communication/:id/messages/:mid/receipts', req => parentOnly(req.headers, req.params.id) ? reply(403, { status: 403, message: 'Only the coaches see who has read an update.' }) : undefined);
