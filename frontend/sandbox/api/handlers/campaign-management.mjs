// Club-owned fundraiser writes and their recovery contract. No payments are taken here.
import { get, post, put, reply } from '../router.mjs';
import * as C from '../world-club.mjs';
import * as W from '../world.mjs';
import * as V from '../viewer.mjs';
import * as P from '../pages-data.mjs';

const problem = (status, message) => reply(status, { status, message });
const conflict = () => problem(409, 'This fundraiser changed. Open its latest saved version.');
const requests = new Map();
const uploads = new Map(); // The campaign upload path is scoped to its uploader, as real MediaAccessService requires.
const isUuid = value => /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
const textFields = { title: 120, summary: 240, description: 5000, beneficiary: 240, useOfFunds: 2000, reportedNote: 1000 };
const moneyOk = (value, min) => value == null || (Number.isFinite(value) && value >= min && value <= 9999999999.99 && Math.abs(value * 100 - Math.round(value * 100)) < 0.0002);
const manager = (clubId, headers) => {
  const viewer = V.viewerId(headers);
  if (viewer === W.ME_ID && Number(clubId) === C.CLUB_ID && V.restrictedPersona(headers)) return false;
  return ['OWNER', 'ADMIN'].includes(P.roleOf(P.clubPage(clubId), viewer));
};
const owned = (clubId, id) => C.campaigns.find(campaign => campaign.clubId === Number(clubId) && campaign.id === Number(id));
const normalized = (body, current) => ({ ...Object.fromEntries(Object.keys(textFields).map(key => [key, String(body?.[key] ?? '').trim()])),
  category: body?.category, currency: body?.currency, goalAmount: body?.goalAmount ?? null, reportedAmount: body?.reportedAmount ?? null,
  startsOn: body?.startsOn || null, endsOn: body?.endsOn || null, images: Array.isArray(body?.images) ? [...body.images] : [],
  // Provider fields remain a sandbox prototype, awaiting the owner's F16 choice and a real backend contract.
  donateUrl: body?.donateUrl === undefined ? current?.donateUrl ?? null : body.donateUrl || null,
});
const validation = (input, viewer, current) => {
  for (const [field, limit] of Object.entries(textFields)) if (input[field].length > limit) return `${field} must have at most ${limit} characters.`;
  if (!input.title) return 'Give the fundraiser a title.';
  if (!['EQUIPMENT','FACILITIES','TRAVEL','YOUTH','COMMUNITY','OTHER'].includes(input.category)) return 'Choose a category.';
  if (!['GEL','EUR','GBP','USD'].includes(input.currency)) return 'Choose a supported currency.';
  if (!moneyOk(input.goalAmount, 0.01) || !moneyOk(input.reportedAmount, 0)) return 'Use a valid amount with at most two decimal places.';
  if (input.reportedAmount != null && !input.reportedNote) return 'Explain the reported amount.';
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) return 'The end date must follow the start date.';
  if (input.images.length > 8 || input.images.some(url => typeof url !== 'string' || url.length > 2048 || (!current?.images?.includes(url) && uploads.get(url) !== viewer))) return 'Upload your own campaign photos.';
  return null;
};
const publishError = campaign => !campaign.summary || !campaign.description || !campaign.beneficiary || (campaign.goalAmount != null && !campaign.useOfFunds)
  ? 'Before publishing, add a summary, purpose, beneficiary and how the goal will be used.' : null;

// Registered before the shared media stand-in. Other contexts continue through the existing handler.
post('/media/upload', ({ query, headers }) => {
  if (query.get('context') !== 'CAMPAIGN') return undefined;
  const id = C.nextId(), url = `/sandbox-media/photo/upload-CAMPAIGN-${id}.svg`;
  uploads.set(url, V.viewerId(headers));
  return reply(201, { id, url, mediaId: id });
});
get('/clubs/:id/campaigns', ({ params, headers }) => manager(params.id, headers)
  ? C.campaigns.filter(campaign => campaign.clubId === Number(params.id)) : problem(403, 'Only the club owner or admins can manage fundraisers.'));
get('/clubs/:id/campaigns/:cid', ({ params, headers }) => manager(params.id, headers)
  ? owned(params.id, params.cid) ?? problem(404, 'Fundraiser not found.') : problem(403, 'Only the club owner or admins can manage fundraisers.'));
post('/clubs/:id/campaigns', ({ params, body, headers }) => {
  if (!manager(params.id, headers)) return problem(403, 'Only the club owner or admins can manage fundraisers.');
  const key = headers?.['idempotency-key'] ?? headers?.['Idempotency-Key'];
  if (key != null && !isUuid(key)) return problem(400, 'Use a UUID idempotency key.');
  const input = normalized(body), viewer = V.viewerId(headers), requestKey = key ? `${viewer}:${params.id}:${key.toLowerCase()}` : null;
  const fingerprint = JSON.stringify(input), seen = requestKey ? requests.get(requestKey) : null;
  if (seen) return seen.fingerprint === fingerprint ? owned(params.id, seen.id) ?? problem(404, 'Fundraiser not found.') : problem(409, 'This request was already used with different details.');
  const invalid = validation(input, viewer);
  if (invalid) return problem(400, invalid);
  const club = W.clubById(Number(params.id));
  const campaign = { ...input, id: C.nextId(), clubId: Number(params.id), clubName: club.name, clubLogoUrl: club.logoUrl,
    country: club.country ?? 'Georgia', city: club.city, status: 'DRAFT', phase: 'DRAFT', version: 1,
    updatedAt: C.nowIso(), publishedAt: null, reportedAt: input.reportedAmount == null ? null : C.nowIso(), updates: [], donations: null };
  C.campaigns.push(campaign);
  if (requestKey) requests.set(requestKey, { fingerprint, id: campaign.id });
  return reply(201, campaign);
});
put('/clubs/:id/campaigns/:cid', ({ params, body, headers }) => {
  if (!manager(params.id, headers)) return problem(403, 'Only the club owner or admins can manage fundraisers.');
  const campaign = owned(params.id, params.cid);
  if (!campaign) return problem(404, 'Fundraiser not found.');
  if (body?.version !== campaign.version) return conflict();
  const input = normalized(body, campaign), invalid = validation(input, V.viewerId(headers), campaign);
  if (invalid) return problem(400, invalid);
  if (campaign.status !== 'DRAFT' && publishError(input)) return problem(400, publishError(input));
  const reportChanged = input.reportedAmount !== campaign.reportedAmount || input.reportedNote !== campaign.reportedNote;
  Object.assign(campaign, input, { version: campaign.version + 1, updatedAt: C.nowIso(), reportedAt: input.reportedAmount == null ? null : reportChanged ? C.nowIso() : campaign.reportedAt });
  return campaign;
});
post('/clubs/:id/campaigns/:cid/state', ({ params, body, headers }) => {
  if (!manager(params.id, headers)) return problem(403, 'Only the club owner or admins can manage fundraisers.');
  const campaign = owned(params.id, params.cid);
  if (!campaign) return problem(404, 'Fundraiser not found.');
  if (body?.version !== campaign.version) return conflict();
  const allowed = campaign.status !== 'ARCHIVED' && (body.status === 'ARCHIVED' || ({ DRAFT: ['PUBLISHED'], PUBLISHED: ['PAUSED','CLOSED'], PAUSED: ['PUBLISHED','CLOSED'] }[campaign.status] ?? []).includes(body.status));
  if (!allowed) return problem(409, 'This fundraiser cannot move to that state.');
  if (body.status === 'PUBLISHED' && publishError(campaign)) return problem(400, publishError(campaign));
  if (body.status === 'PUBLISHED' && campaign.endsOn && campaign.endsOn < new Date().toISOString().slice(0,10)) return problem(400, 'Choose a current or future end date.');
  campaign.status = body.status; campaign.phase = body.status === 'PUBLISHED' ? 'ACTIVE' : body.status === 'CLOSED' ? 'ENDED' : body.status;
  if (body.status === 'PUBLISHED' && !campaign.publishedAt) campaign.publishedAt = C.nowIso();
  campaign.version++; campaign.updatedAt = C.nowIso(); return campaign;
});
post('/clubs/:id/campaigns/:cid/updates', ({ params, body, headers }) => {
  if (!manager(params.id, headers)) return problem(403, 'Only the club owner or admins can manage fundraisers.');
  const campaign = owned(params.id, params.cid);
  if (!campaign) return problem(404, 'Fundraiser not found.');
  if (body?.version !== campaign.version) return conflict();
  if (!campaign.publishedAt) return problem(409, 'Publish the fundraiser before posting an update.');
  const title = String(body?.title ?? '').trim(), message = String(body?.body ?? '').trim();
  if (!title || title.length > 120 || !message || message.length > 3000) return problem(400, 'An update needs a title and message.');
  campaign.updates.unshift({ id: C.nextId(), title, body: message, createdAt: C.nowIso() });
  campaign.version++; campaign.updatedAt = C.nowIso(); return campaign;
});
