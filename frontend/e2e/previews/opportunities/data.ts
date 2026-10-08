export type Section = 'store' | 'campaigns' | 'jobs';
export type Variant = { label: string; stock: string };
export type Draft = {
    id?: number; title: string; description: string; summary: string; category: string;
    price: string; currency: string; variants: Variant[]; images: string[]; artwork: string;
    visibility: string; beneficiary: string; goal: string; useOfFunds: string; start: string; end: string;
    reported: string; reportedNote: string; engagement: string; age: string; experience: string; application: string;
};
export type RecordItem = Draft & { id: number; status: string; applicants: number; updated: string };
export type Editor = { draft: Draft; step: number; dirty: boolean };
export const meta = {
    store: { title: 'Club store', singular: 'product', action: 'Add product', intro: 'Manage your collection, keep stock up to date and choose what supporters see.', steps: ['Details & photos', 'Price & stock', 'Review & visibility'] },
    campaigns: { title: 'Club campaigns', singular: 'campaign', action: 'Create campaign', intro: 'Give your club’s next project a clear story, a goal and a place to grow.', steps: ['Tell the story', 'Goal & timing', 'Photos & review'] },
    jobs: { title: 'Jobs & volunteering', singular: 'job', action: 'Post job', intro: 'Find the right people for your club. Keep openings and applications together.', steps: ['Role details', 'Who & how', 'Review & post'] },
} as const;
export const productCategories = ['Shirts & kit', 'Footwear', 'Training wear', 'Equipment', 'Accessories', 'Tickets', 'Memberships', 'Events', 'Other'];
export const campaignCategories = ['Community projects', 'Equipment & kit', 'Pitches & facilities', 'Travel & competitions', 'Youth football', 'Other'];
export const jobCategories = ['Coaching', 'Football operations', 'Administration', 'Media & communications', 'Facilities & maintenance', 'Medical & wellbeing', 'Matchday staff', 'Other club role'];
export const money = (value: string | number, currency = 'GEL') => `${currency} ${Number(value || 0).toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
export const stock = (item: Draft) => item.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
export function emptyDraft(section: Section): Draft {
    return {title: '', description: '', summary: '', category: section === 'store' ? 'Shirts & kit' : section === 'campaigns' ? 'Community projects' : 'Coaching', price: '', currency: 'GEL', variants: [{label: 'One size', stock: '0'}], images: [], artwork: '', visibility: 'Draft', beneficiary: '', goal: '', useOfFunds: '', start: '', end: '', reported: '', reportedNote: '', engagement: 'Not specified', age: 'Any age group', experience: 'Any experience', application: 'Contact the club'};
}
export function example(section: Section): Draft {
    const base = emptyDraft(section);
    if (section === 'store') return {...base, title: 'Home Kit 2026/27', description: 'Our new home shirt. Lightweight, breathable fabric in the club’s classic blue, with an embroidered crest. A comfortable fit for matchdays and every day.', price: '150', artwork: 'shirt', variants: [{label: 'S', stock: '8'}, {label: 'M', stock: '15'}, {label: 'L', stock: '12'}, {label: 'XL', stock: '5'}]};
    if (section === 'campaigns') return {...base, title: 'Community Boot Library', summary: 'Help every young player step onto the pitch with a pair of boots that fits.', description: 'A shared collection of football boots for our youth teams. Players can borrow a pair for the season and exchange it when they grow, so equipment never gets in the way of joining the team.', beneficiary: 'Players aged 8–14 in our academy', goal: '4000', useOfFunds: '40 pairs of boots, cleaning supplies and secure storage at our training ground.', images: ['/preview/club-ground.png']};
    return {...base, title: 'U14 goalkeeper coach', category: 'Coaching', description: 'Help our young goalkeepers build confidence and strong foundations. Lead two evening sessions each week at our Tbilisi training ground, working alongside the U14 head coach. Please tell us about your coaching experience and availability.', engagement: 'Paid role', age: 'U14', experience: 'Experienced', application: 'Coach application'};
}
export function initialRecords(): Record<Section, RecordItem[]> {
    const make = (section: Section, id: number, changes: Partial<RecordItem>): RecordItem => ({...example(section), id, status: 'Published', applicants: 0, updated: '12 Sep', ...changes});
    return {
        store: [
            make('store', 1, {title: 'Home Kit 2026/27', artwork: 'shirt'}),
            make('store', 2, {title: 'Community Scarf', price: '35', category: 'Accessories', artwork: 'scarf', description: 'Club colours for the touchline. A soft woven scarf for every supporter.', variants: [{label: 'One size', stock: '12'}]}),
            make('store', 3, {title: 'Training Top', price: '85', category: 'Training wear', artwork: 'top', variants: [{label: 'M', stock: '2'}, {label: 'L', stock: '1'}]}),
            make('store', 4, {title: 'Club Football', price: '60', category: 'Equipment', artwork: 'ball', variants: [{label: 'Size 5', stock: '0'}]}),
            make('store', 5, {title: 'Academy Match Boots', price: '180', category: 'Footwear', artwork: 'boots', variants: [{label: '38', stock: '0'}, {label: '39', stock: '0'}]}),
            make('store', 6, {title: 'Supporters Membership 2026/27', price: '40', category: 'Memberships', artwork: 'membership', status: 'Draft', variants: [{label: 'Season pass', stock: '100'}]}),
            make('store', 7, {title: 'Summer Camp — One Week', price: '250', category: 'Events', artwork: 'camp', status: 'Draft', variants: [{label: 'One place', stock: '24'}]}),
        ],
        campaigns: [
            make('campaigns', 21, {status: 'Active', reported: '1250', reportedNote: 'Sample club-reported funds from our community collection.', start: '2026-09-01', end: '2026-10-31'}),
            make('campaigns', 22, {title: 'A better place to train', summary: 'New goals and better equipment for our academy’s evening sessions.', category: 'Pitches & facilities', status: 'Draft', goal: '6000', reported: '', images: []}),
            make('campaigns', 23, {title: 'Take the team to the tournament', summary: 'Help our U14s make their first away tournament together.', category: 'Travel & competitions', status: 'Paused', goal: '3500', reported: '850', images: [], end: '2026-11-15'}),
        ],
        jobs: [
            make('jobs', 31, {status: 'Open', applicants: 3}),
            make('jobs', 32, {title: 'Matchday photographer', category: 'Media & communications', description: 'Capture the moments that matter at our home matches. Help tell the club’s story through photos of the team and our supporters.', engagement: 'Volunteer role', application: 'Contact the club', age: 'Any age group', experience: 'Any experience', status: 'Open', applicants: 0}),
            make('jobs', 33, {title: 'Open midfield development place', category: 'Football operations', description: 'A development opportunity for an ambitious midfielder.', engagement: 'Not specified', application: 'Player application', age: 'U18', status: 'Closed', applicants: 0}),
        ],
    };
}
