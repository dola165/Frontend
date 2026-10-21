import * as W from './world.mjs';
import * as V from './viewer.mjs';
import * as P from './pages-data.mjs';
import * as F from './world-football.mjs';

export const viewerClubs = headers => V.viewerId(headers) === W.ME_ID
  ? [F.DINAMO] : P.ownedPages(V.viewerId(headers)).map(page => page.clubId).filter(id => id != null);
export const viewed = handler => context => {
  F.setViewerClubs(viewerClubs(context.headers));
  return handler(context);
};

/** Direct invitations stay private to the involved clubs and invited/accepted officials. */
export const canReadListing = (listing, headers) => !listing.requestedClubId
  || F.isMineClub(F.sq(listing.hostSquadId).clubId) || F.isMineClub(listing.requestedClubId)
  || Boolean(listing.opponentSquadId && F.isMineClub(F.sq(listing.opponentSquadId).clubId))
  || Boolean(listing.refereeId === V.viewerId(headers) && ['INVITED', 'ACCEPTED'].includes(F.refereeStatusOf(listing)))
  || Boolean(listing.assistants?.some(official => official.refereeId === V.viewerId(headers) && ['INVITED', 'ACCEPTED'].includes(official.status)))
  || Boolean(F.officialRequests.get(listing.id)?.status === 'OPEN' && F.refereeProfiles.some(referee => referee.user_id === V.viewerId(headers)));
