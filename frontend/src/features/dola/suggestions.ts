export const dolaContexts = ['family', 'coach', 'referee', 'venue', 'organization', 'agent', 'player', 'discover'] as const;
export type DolaWorkspace = typeof dolaContexts[number];
export const normalizeDolaContexts = (value: unknown): DolaWorkspace[] => Array.isArray(value)
    ? [...dolaContexts.filter(context => context !== 'discover' && value.includes(context)), 'discover'] : ['discover'];

export function chooseDolaContext(contexts: DolaWorkspace[], path: string, preferred?: DolaWorkspace): DolaWorkspace {
    if (preferred && contexts.includes(preferred)) return preferred;
    const page: DolaWorkspace | undefined = path.startsWith('/parent') ? 'family'
        : path.startsWith('/referees') ? 'referee'
            : path === '/agent' || path.startsWith('/agent/') ? 'agent'
                : path.startsWith('/match-exchange') || path.startsWith('/squads') ? 'coach'
                    : /^\/stadiums\/\d+\/manage/.test(path) && contexts.includes('venue') ? 'venue'
                    : /^\/(organizations|stadiums|tournaments)\//.test(path) || /^\/clubs\/\d+\/workspace/.test(path) ? 'organization' : undefined;
    return page && contexts.includes(page) ? page : contexts[0] ?? 'discover';
}
export const dolaContextLabel = (context: DolaWorkspace, ka: boolean): string => (ka ? {
    family: 'ოჯახი', coach: 'ჩემი გუნდები', referee: 'მსაჯობა', venue: 'ჩემი მოედნები', organization: 'ორგანიზაცია', agent: 'აგენტის საქმიანობა', player: 'მოთამაშე', discover: 'აღმოჩენა',
} : { family: 'Family', coach: 'My squads', referee: 'Refereeing', venue: 'My venues', organization: 'My organisation', agent: 'Agent work', player: 'Playing', discover: 'Explore' })[context];

const starters: Record<DolaWorkspace, [string, string][]> = {
    family: [
        ['What needs my attention for my children?', 'ჩემს შვილებთან დაკავშირებით რას უნდა მივაქციო ყურადღება?'],
        ['Which updates still need my acknowledgement?', 'რომელი განახლებები ელოდება ჩემს დადასტურებას?'],
        ['Show my children’s upcoming training.', 'მაჩვენე ჩემი შვილების მომავალი ვარჯიშები.'],
    ],
    coach: [
        ['When is my next squad match?', 'როდის არის ჩემი გუნდის შემდეგი მატჩი?'],
        ['Help me write a coach update.', 'დამეხმარე მწვრთნელის განახლების დაწერაში.'],
        ['Has anyone responded to our open challenges?', 'გამოეხმაურა ვინმე ჩვენს ღია გამოწვევებს?'],
    ],
    referee: [
        ['What are my next accepted referee appointments?', 'რომელია ჩემი შემდეგი მიღებული სამსაჯო დანიშვნები?'],
        ['Which referee invitations need my response?', 'რომელი სამსაჯო მოწვევები ელოდება ჩემს პასუხს?'],
        ['Help me update my referee availability.', 'დამეხმარე ჩემი სამსაჯო ხელმისაწვდომობის განახლებაში.'],
    ],
    venue: [
        ['What needs my attention at my venues?', 'ჩემს მოედნებზე რას უნდა მივაქციო ყურადღება?'],
        ['Who is arriving at my venues today?', 'ვინ მოდის დღეს ჩემს მოედნებზე?'],
        ['Help me record an agreed booking.', 'დამეხმარე შეთანხმებული ჯავშნის დამატებაში.'],
    ],
    organization: [
        ['What needs attention in my organisation?', 'რას უნდა მივაქციო ყურადღება ჩემს ორგანიზაციაში?'],
        ['Summarise my organisation’s current workspaces.', 'შემაჯამე ჩემი ორგანიზაციის მიმდინარე სამუშაო სივრცეები.'],
        ['Find public volunteering roles.', 'მომიძებნე მოხალისეობრივი ვაკანსიები.'],
    ],
    agent: [
        ['Show updates on my club engagements as a football agent.', 'მაჩვენე კლუბებთან ჩემი, როგორც საფეხბურთო აგენტის, ურთიერთობების სტატუსი.'],
        ['Which clubs expressed interest in my player listings?', 'რომელმა კლუბებმა გამოხატეს ინტერესი ჩემი მოთამაშეების განცხადებებზე?'],
        ['Show my football-agent portfolio.', 'მაჩვენე ჩემი საფეხბურთო აგენტის პორტფოლიო.'],
    ],
    player: [
        ['Show my upcoming squad training.', 'მაჩვენე ჩემი გუნდის მომავალი ვარჯიშები.'],
        ['When is my next squad match?', 'როდის არის ჩემი გუნდის შემდეგი მატჩი?'],
        ['Find public volunteering roles.', 'მომიძებნე მოხალისეობრივი ვაკანსიები.'],
    ],
    discover: [
        ['Find public volunteering roles.', 'მომიძებნე მოხალისეობრივი ვაკანსიები.'],
        ['Find open challenges looking for opponents.', 'მომიძებნე ღია გამოწვევები, რომლებიც მეტოქეს ეძებენ.'],
        ['How can I find a football academy?', 'როგორ მოვძებნო საფეხბურთო აკადემია?'],
    ],
};
export const dolaSuggestions = (context: DolaWorkspace, ka: boolean): string[] => starters[context].map(pair => pair[ka ? 1 : 0]);

const nextSteps: Record<string, [string, string]> = {
    'venue-arrivals': ['Who is arriving today?', 'ვინ მოდის დღეს?'],
    'venue-availability': ['Find a free pitch slot for me.', 'მომიძებნე თავისუფალი დრო მოედანზე.'],
    'venue-booking': ['Help me record an agreed booking.', 'დამეხმარე შეთანხმებული ჯავშნის დამატებაში.'],
    'referee-response': ['Help me respond to a referee invitation.', 'დამეხმარე სამსაჯო მოწვევაზე პასუხში.'],
    'referee-availability': ['Show my referee availability.', 'მაჩვენე ჩემი სამსაჯო ხელმისაწვდომობა.'],
    'referee-opportunities': ['Find volunteer referee opportunities.', 'მომიძებნე მსაჯის მოხალისეობრივი შესაძლებლობები.'],
    'match-arrangements': ['What still needs arranging for these matches?', 'რა არის კიდევ მოსაგვარებელი ამ მატჩებისთვის?'],
    'match-proposals': ['Show the pending proposals for my challenges.', 'მაჩვენე ჩემს გამოწვევებზე პასუხის მომლოდინე შეთავაზებები.'],
    'agent-interests': ['Which clubs expressed interest in my player listings?', 'რომელმა კლუბებმა გამოხატეს ინტერესი ჩემი მოთამაშეების განცხადებებზე?'],
    'agent-engagements': ['Show the status of my club engagements.', 'მაჩვენე კლუბებთან ჩემი ურთიერთობების სტატუსი.'],
};
export const dolaFollowUps = (keys: string[] | undefined, ka: boolean): string[] => [...new Set(keys ?? [])]
    .filter(key => Object.hasOwn(nextSteps, key)).slice(0, 3).map(key => nextSteps[key][ka ? 1 : 0]);
