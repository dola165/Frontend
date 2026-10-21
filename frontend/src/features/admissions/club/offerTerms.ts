import type { Terms, Location } from '../types';

export const completeOfferTerms=(terms:Terms,schedule:string,location:Location) => terms.feesKnown && Boolean(terms.startDate && terms.cancellation.trim() && terms.participation.trim() && schedule.trim() && location.name.trim() && location.address.trim());
