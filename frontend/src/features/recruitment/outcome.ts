const labels: Record<string,string> = {PENDING:'Awaiting club review',OFFERED:'Awaiting applicant response',ACCEPTED:'Accepted',DECLINED:'Declined by club',CANCELLED:'Withdrawn',EXPIRED:'Offer unavailable',OFFER_DECLINED:'Offer declined',OFFER_CANCELLED:'Offer cancelled'};
export const recruitmentOutcome = (s: string) => labels[s] ?? s.toLowerCase().replaceAll('_',' ');
