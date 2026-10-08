/** Synthetic design fixtures. These are not account roles or authorization rules. */
export const contexts = [
    { id: 'owner', label: 'Coach Luka · own academy', name: 'Coach Luka', initials: 'CL' },
    { id: 'visitor', label: 'Parent · exploring the academy', name: 'Parent', initials: 'PA' },
    { id: 'family', label: 'Parent · connected to the academy', name: 'Parent', initials: 'PA' },
    { id: 'coach', label: 'Coach · visiting another club', name: 'Visiting coach', initials: 'VC' },
    { id: 'referee', label: 'Tamar · club referee', name: 'Tamar Beridze', initials: 'TB' },
    { id: 'organization', label: 'Coach · visiting a kit maker', name: 'Visiting coach', initials: 'VC' },
] as const;
export type Context = typeof contexts[number]['id'];
export type PageTab = 'Overview' | 'Posts' | 'Training & teams' | 'Schedule' | 'People' | 'Facilities' | 'About';
export type Scene = 'football' | 'place' | 'community';
export type Detail = {
    eyebrow: string;
    title: string;
    description: string;
    facts?: [string, string][];
    note?: string;
    image?: string;
    workspace?: 'club' | 'referee' | 'family';
};
export const programmes = [
    { name: 'Foundation', age: 'Ages 8–12', price: 150, description: 'Confidence on the ball. A love for the game.', days: 'Monday · Wednesday · Friday', time: '17:00–18:15', size: 'Small-group training', icon: '01' },
    { name: 'Youth development', age: 'Ages 13–16', price: 200, description: 'A sharper game. A stronger sense of team.', days: 'Tuesday · Thursday · Saturday', time: '18:00–19:30', size: 'Team & individual development', icon: '02' },
] as const;
export const updates = [
    { title: 'The work between matchdays.', text: 'A week of first touches, quick decisions and looking out for each other. Back on the training ground with our academy squads.', category: 'From the training ground', date: '28 September', image: '/preview/club-ground.png' },
    { title: 'A little preparation goes a long way.', text: 'For this week’s sessions, please bring your boots, shin pads and a filled water bottle. Your squad schedule has the meeting time and location.', category: 'Academy notice', date: '27 September' },
];
export const programmeDetail = (index: number): Detail => {
    const p = programmes[index];
    return { eyebrow: `Training programme · ${p.age}`, title: p.name, description: p.description,
        facts: [['Monthly training fee', `${p.price} GEL`], ['Training days', p.days], ['Session time', p.time], ['Format', p.size]],
        note: 'Contact the academy to ask about joining, the right group and current availability. A published programme does not guarantee an available place.' };
};
export const fixtureDetail: Detail = { eyebrow: 'Public fixture · Under 16', title: 'Dinamo vs Riverside', description: 'A friendly to put the week’s work into practice.', facts: [['Date', 'Saturday, 3 October'], ['Kick-off', '11:00'], ['Location', 'Academy ground'], ['Competition', 'Friendly']], note: 'Sample fixture for the design preview. This is not an actual scheduled match.' };
export const groundDetail: Detail = { eyebrow: 'Training ground', title: 'Room to find your game.', description: 'The place behind the practice. Explore the ground, check the location and contact the academy before your first visit.', image: '/preview/club-ground.png', facts: [['City', 'Tbilisi, Georgia'], ['Use', 'Academy training & fixtures']], note: 'Illustrative image from the existing application. Facility and booking details will come from the published venue record.' };
export const staffDetail: Detail = { eyebrow: 'Club staff', title: 'Coach Luka', description: 'Club leadership & coaching', facts: [['Organization', 'FC Dinamo Tbilisi Academy'], ['Recorded responsibilities', 'Club leadership · Coaching']], note: 'Appointments describe responsibilities. Qualifications and verification are separate records.' };
export const refereeDetail: Detail = { eyebrow: 'Recorded appointment', title: 'Tamar Beridze', description: 'Club referee', facts: [['Organization', 'FC Dinamo Tbilisi Academy'], ['Recorded responsibility', 'Officiating']], note: 'A recorded club appointment does not imply qualification verification or ownership of the club. This is sample content for the design study.' };
