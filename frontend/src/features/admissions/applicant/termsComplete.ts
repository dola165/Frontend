import type { Location, Terms } from '../types';
export const termsComplete=(terms:Terms,schedule:string,location:Location)=>terms.feesKnown&&Boolean(terms.startDate&&terms.cancellation.trim()&&terms.participation.trim()&&schedule.trim()&&location.name.trim());
