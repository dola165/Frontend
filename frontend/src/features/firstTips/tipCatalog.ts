import type { FirstTip, TipPlace, Words } from './firstTips';

/**
 * Every first-time tip of the web, by area: what the page or window is for, in English and Georgian, and what Agent
 * Dola can do there. Labels quoted in the Georgian text are the app's own Georgian labels.
 *
 * `ask` is sent to Dola as written when "Help me" is pressed; each one was tried on the test site and reaches the
 * right Dola ability (a tip leaves it out where Dola cannot help yet). Where Dola has a step-by-step guide for the
 * window the tip explains, the ask is help-phrased ("Help me…"), so it opens that guide; a plain instruction would get
 * Dola's chat questions instead (backend `CreateApproach`). Pages that rewrite a one-shot flag away at once
 * (`newEvent=1`, `compose=1`…) are reached through `data-first-tip` on the buttons that open them.
 */
const w = (en: string, ka: string): Words => ({ en, ka });
const workspaceTab = (...tabs: string[]): TipPlace[] => tabs.map(tab => ({ path: '/clubs/:id/workspace', query: { tab } }));

const ASK = {
    post: w('Help me write a post', 'დამეხმარე პოსტის დაწერაში'),
    findClubs: w('Find clubs near me', 'მოძებნე კლუბები ჩემთან ახლოს'),
    openTrialsClubs: w('Find an academy with open trials', 'მოძებნე აკადემია ღია გასინჯვით'),
    schedule: w('What’s on my schedule this week?', 'რა მაქვს ამ კვირაში?'),
    matches: w('What matches do I have this week?', 'რა მატჩები მაქვს ამ კვირაში?'),
    createMatch: w('Help me arrange a match', 'დამეხმარე მატჩის შეთანხმებაში'),
    tournamentHelp: w('Help me create a tournament', 'დამეხმარე ტურნირის შექმნაში'),
    tournaments: w('Show tournaments coming up', 'მაჩვენე მომავალი ტურნირები'),
    myTournaments: w('Show my tournaments', 'მაჩვენე ჩემი ტურნირები'),
    jobs: w('Any coaching jobs?', 'მწვრთნელის ვაკანსიები არის?'),
    tryouts: w('Show open tryouts', 'მაჩვენე ღია სინჯები'),
    groups: w('Find a club with training for my age group', 'მოძებნე კლუბი ჩემი ასაკისთვის ვარჯიშით'),
    profile: w('Help me fill out my profile', 'დამეხმარე პროფილის შევსებაში'),
    notifyPlayers: w('Send a message to my players', 'მოთამაშეებს შეტყობინება გაუგზავნე'),
    training: w('Add a training to the calendar', 'კალენდარში ვარჯიში დაამატე'),
    form: w('Help me fill in this form', 'დამეხმარე ამ ფორმის შევსებაში'),
    clubPage: w('Help me fill out my club’s page', 'დამეხმარე კლუბის გვერდის შევსებაში'),
    staff: w('Who works at my club?', 'ვინ მუშაობს ჩემს კლუბში?'),
    players: w('Show my club’s players', 'მაჩვენე ჩემი კლუბის მოთამაშეები'),
    applications: w('Any applications to my club?', 'ჩემს კლუბში განაცხადები არის?'),
    invitations: w('Show my club invitations', 'მაჩვენე კლუბის მოწვევები'),
    vacancy: w('Help me post a vacancy', 'დამეხმარე ვაკანსიის გამოქვეყნებაში'),
    store: w('What’s in the store?', 'რა იყიდება მაღაზიაში?'),
    messages: w('Do I have unread messages?', 'მიმოწერაში წაუკითხავი მაქვს?'),
    notifications: w('Any new notifications?', 'ახალი შეტყობინებები მაქვს?'),
    startClub: w('Help me create a club', 'დამეხმარე კლუბის შექმნაში'),
    myClubs: w('Show my clubs', 'მაჩვენე ჩემი კლუბები'),
    waiting: w('What’s waiting on me?', 'რა მელოდება?'),
    account: w('Is my profile complete?', 'ჩემი პროფილი სრულია?'),
    fundraiser: w('Help me start a fundraiser', 'დამეხმარე თანხის შეგროვების დაწყებაში'),
} satisfies Record<string, Words>;

export const FIRST_TIPS: readonly FirstTip[] = [
    // ------------------------------------------------------------------ Home and the header
    {
        id: 'home', places: [{ path: '/home' }], ask: ASK.post,
        title: w('Home', 'მთავარი'),
        body: w('Your football feed. Discover shows your clubs and people first, then football near you; Following shows only those you follow. Share an update at the top; your squads, schedule, the store, jobs and fundraising are at the sides.',
            'თქვენი ფეხბურთის ფიდი. „აღმოაჩინეთ“ ჯერ თქვენს კლუბებსა და ადამიანებს აჩვენებს, შემდეგ — ფეხბურთს თქვენს ახლოს; „გამოწერილი“ — მხოლოდ მათ, ვისაც მიჰყვებით. სიახლე ზემოთ გააზიარეთ; თქვენი გუნდები, განრიგი, მაღაზია, ვაკანსიები და ფონდების მოზიდვა გვერდებზეა.'),
    },
    {
        id: 'post', action: true, ask: ASK.post,
        title: w('Write a post', 'პოსტის დაწერა'),
        body: w('Share what’s happening: a result, news from training, a photo from the weekend. Add up to 10 photos. It appears in the feed and on your profile. To put something on the calendar, use Event instead.',
            'გააზიარეთ, რა ხდება: შედეგი, სიახლე ვარჯიშიდან, შაბათ-კვირის ფოტო. შეგიძლიათ 10-მდე ფოტოს დამატება. პოსტი ფიდსა და თქვენს პროფილზე გამოჩნდება. კალენდარში რამის ჩასამატებლად „ღონისძიება“ გამოიყენეთ.'),
    },
    {
        id: 'new-event', action: true, ask: ASK.training,
        title: w('New event', 'ახალი ღონისძიება'),
        body: w('Put something on the calendar: a training, a match, a meeting or a plan of your own. Give it a day, a time and a place; you can move or change it later.',
            'ჩაამატეთ კალენდარში: ვარჯიში, მატჩი, შეხვედრა ან პირადი გეგმა. მიუთითეთ დღე, დრო და ადგილი; მოგვიანებით შეგიძლიათ გადაიტანოთ ან შეცვალოთ.'),
    },
    {
        id: 'pins', action: true,
        title: w('Pins', 'პინები'),
        body: w('Pin a page you use often and it becomes your own tab in the header, next to Home and World. Pin the page you’re on or pick a suggestion; you can keep up to 12.',
            'მიამაგრეთ ხშირად გამოყენებული გვერდი და ის ზედა ზოლში, „მთავარისა“ და „მსოფლიოს“ გვერდით, თქვენს საკუთარ ჩანართად იქცევა. მიამაგრეთ ის გვერდი, რომელზეც ხართ, ან აირჩიეთ შემოთავაზებული; შეგიძლიათ 12-მდე პინი გქონდეთ.'),
    },
    {
        id: 'inbox', action: true, ask: ASK.notifications,
        title: w('Inbox', 'შემოსულები'),
        body: w('Everything waiting for you in one place. Needs you holds the invitations, applications and decisions to answer; Updates holds the rest of your notifications.',
            'ყველაფერი, რაც გელოდებათ, ერთ ადგილას. „გელოდებათ“ — მოწვევები, განაცხადები და გადაწყვეტილებები, რომლებსაც პასუხი სჭირდება; „სიახლეები“ — დანარჩენი შეტყობინებები.'),
    },
    {
        id: 'notifications', places: [{ path: '/notifications' }], ask: ASK.notifications,
        title: w('Notifications', 'შეტყობინებები'),
        body: w('Every update about you, your clubs and your matches, newest first. Open one to go straight to what it is about.',
            'ყველა სიახლე თქვენზე, თქვენს კლუბებსა და მატჩებზე, უახლესი — პირველი. გახსენით ნებისმიერი და პირდაპირ იმ ადგილას მოხვდებით, რასაც ეხება.'),
    },
    {
        id: 'requests', places: [{ path: '/requests' }], ask: ASK.invitations,
        title: w('Requests', 'მოთხოვნები'),
        body: w('Invitations, applications and decisions that wait for you or your club. Incoming needs your answer, Sent shows what you’re waiting for, and History keeps what’s done.',
            'მოწვევები, განაცხადები და გადაწყვეტილებები, რომლებიც თქვენ ან თქვენს კლუბს გელოდებათ. „შემოსული“ თქვენს პასუხს ელის, „გაგზავნილი“ აჩვენებს, რას ელოდებით თქვენ, „ისტორიაში“ კი დასრულებული ინახება.'),
    },
    {
        id: 'messages', places: [{ path: '/messages' }], ask: ASK.messages,
        title: w('Messages', 'მიმოწერა'),
        body: w('Your conversations: one-to-one, groups and your squads’ chats. Start a new chat or group with the + button. You can see when people are online and typing.',
            'თქვენი მიმოწერა: პირადი, ჯგუფური და თქვენი გუნდების ჩატები. ახალი ჩატი ან ჯგუფი „+“ ღილაკით დაიწყეთ. ხედავთ, ვინ არის ხაზზე და ვინ წერს.'),
    },
    {
        id: 'create-page', action: true, places: [{ path: '/*', query: { create: true } }], ask: ASK.startClub,
        title: w('Create a page', 'გვერდის შექმნა'),
        body: w('Give your club, fan club, business or other football project its own page in about ten seconds: choose the kind, check the name, Create. If the page already exists, you can claim it instead.',
            'დაახლოებით ათ წამში შექმენით გვერდი თქვენი კლუბისთვის, ფან-კლუბისთვის, ბიზნესისთვის ან სხვა საფეხბურთო პროექტისთვის: აირჩიეთ ტიპი, გადაამოწმეთ სახელი და დააჭირეთ „შექმნას“. თუ გვერდი უკვე არსებობს, შეგიძლიათ მისი მფლობელობა მოითხოვოთ.'),
    },

    // ------------------------------------------------------------------ World
    {
        id: 'world', places: [{ path: '/world/*' }], ask: ASK.findClubs,
        title: w('World', 'მსოფლიო'),
        body: w('All the football around you, on a map and in lists: clubs, matches, tournaments, trials, jobs and people. Switch with the tabs. Set the area, or the child you’re searching for, once and World keeps it on every tab.',
            'მთელი ფეხბურთი თქვენს ირგვლივ, რუკაზე და სიებში: კლუბები, მატჩები, ტურნირები, გასინჯვები, ვაკანსიები და ადამიანები. გადართეთ ჩანართებით. ერთხელ მიუთითეთ ადგილი ან ბავშვი, ვისთვისაც ეძებთ, და „მსოფლიო“ მას ყველა ჩანართზე დაიმახსოვრებს.'),
    },
    {
        id: 'world-clubs', places: [{ path: '/world/clubs' }], ask: ASK.openTrialsClubs,
        title: w('Clubs', 'კლუბები'),
        body: w('Clubs near you: their age groups, who they’re for and whether trials are open. Open one to see its teams, coaches and contacts without leaving the list, then follow it or ask to join.',
            'კლუბები თქვენს ახლოს: ასაკობრივი ჯგუფები, ვისთვის არიან და ღიაა თუ არა გასინჯვა. გახსენით კლუბი და ნახეთ მისი გუნდები, მწვრთნელები და კონტაქტები სიიდან გაუსვლელად, შემდეგ გამოიწერეთ ან მოითხოვეთ გაწევრიანება.'),
    },
    {
        id: 'jobs', ask: ASK.jobs,
        places: [{ path: '/world/opportunities' }, { path: '/jobs' }, { path: '/jobs/all' }, { path: '/clubs/:id/jobs' }],
        title: w('Jobs & volunteering', 'სამუშაო და მოხალისეობა'),
        body: w('Paid jobs and volunteer roles in football (coaches, referees, physios, media and more), and people who are available for work. Open a role to read the terms and apply.',
            'ანაზღაურებადი სამუშაო და მოხალისეობა ფეხბურთში (მწვრთნელები, მსაჯები, ფიზიოთერაპევტები, მედია და სხვა), ასევე ადამიანები, რომლებიც სამუშაოს ეძებენ. გახსენით ვაკანსია, წაიკითხეთ პირობები და გაგზავნეთ განაცხადი.'),
    },
    {
        id: 'world-trials', places: [{ path: '/world/opportunities', query: { tab: 'trials' } }], ask: ASK.tryouts,
        title: w('Trials', 'გასინჯვები'),
        body: w('Clubs’ open trials: who they’re looking for, when and where. Open one for the details and apply from its page.',
            'კლუბების ღია გასინჯვები: ვის ეძებენ, როდის და სად. გახსენით, ნახეთ დეტალები და განაცხადი მის გვერდზე გააგზავნეთ.'),
    },
    {
        id: 'world-groups', places: [{ path: '/world/opportunities', query: { tab: 'groups' } }], ask: ASK.groups,
        title: w('Places to train', 'სავარჯიშო ჯგუფები'),
        body: w('Training groups that are taking players, with their ages, days and free places. Ask about a place; the club answers you in Joining football.',
            'სავარჯიშო ჯგუფები, რომლებიც მოთამაშეებს იღებენ: ასაკი, დღეები და თავისუფალი ადგილები. იკითხეთ ადგილის შესახებ — კლუბი „ფეხბურთში მონაწილეობაში“ გიპასუხებთ.'),
    },
    {
        id: 'world-matches', places: [{ path: '/world/matches' }], ask: ASK.matches,
        title: w('Fixtures & results', 'მატჩები და შედეგები'),
        body: w('Fixtures and results, one day at a time. The other tabs hold Open matches (teams looking for an opponent), My arrangements (your own matches) and All events.',
            'მატჩები და შედეგები, დღეების მიხედვით. სხვა ჩანართებზე: „ღია მატჩები“ (გუნდები, რომლებიც მეტოქეს ეძებენ), „ჩემი შეთანხმებები“ (თქვენი მატჩები) და „ყველა ღონისძიება“.'),
    },
    {
        id: 'world-open-matches', places: [{ path: '/world/matches', query: { tab: 'exchange' } }], ask: ASK.createMatch, askFor: 'staff',
        title: w('Open matches', 'ღია მატჩები'),
        body: w('Teams looking for an opponent. Propose to play one of them, or post an open match of your own and let other clubs propose to you.',
            'გუნდები, რომლებიც მეტოქეს ეძებენ. შესთავაზეთ თამაში რომელიმეს, ან გამოაქვეყნეთ საკუთარი ღია მატჩი და სხვა კლუბები თავად შემოგთავაზებენ.'),
    },
    {
        id: 'world-my-matches', places: [{ path: '/world/matches', query: { tab: 'mine' } }], ask: ASK.createMatch, askFor: 'staff',
        title: w('My arrangements', 'ჩემი შეთანხმებები'),
        body: w('Your matches, grouped by what they need: waiting for you, waiting for the other side, coming up and played. Arrange a new one with the + button.',
            'თქვენი მატჩები იმის მიხედვით, რას საჭიროებენ: გელოდებათ თქვენ, ელოდება მეორე მხარეს, მოახლოებული და ნათამაშები. ახალი მატჩი „+“ ღილაკით შეათანხმეთ.'),
    },
    {
        id: 'world-events', places: [{ path: '/world/matches', query: { tab: 'events' } }],
        title: w('All events', 'ყველა ღონისძიება'),
        body: w('Every event that clubs and organisers have published. Open one to see when and where it is and who it is for.',
            'ყველა ღონისძიება, რომელიც კლუბებმა და ორგანიზატორებმა გამოაქვეყნეს. გახსენით და ნახეთ, როდის და სად არის და ვისთვისაა.'),
    },
    {
        id: 'world-tournaments', places: [{ path: '/world/tournaments' }], ask: ASK.tournaments,
        title: w('Tournaments', 'ტურნირები'),
        body: w('Leagues, cups and festivals. This season shows what’s on now, All tournaments shows everything, and My tournaments the ones you play in or run, with invitations to answer.',
            'ლიგები, თასები და ფესტივალები. „ეს სეზონი“ აჩვენებს მიმდინარეს, „ყველა ტურნირი“ — ყველაფერს, „ჩემი ტურნირები“ კი — სადაც თამაშობთ ან რომელსაც ატარებთ, პასუხის მომლოდინე მოწვევებით.'),
    },
    {
        id: 'world-people', places: [{ path: '/world/people' }], ask: ASK.profile,
        title: w('People', 'ხალხი'),
        body: w('Referees you can book for a match, specialists, coaches and staff, and players. Your own profile decides how you show up here.',
            'მსაჯები, რომლებსაც მატჩზე მოიწვევთ, სპეციალისტები, მწვრთნელები და პერსონალი, მოთამაშეები. აქ როგორ გამოჩნდებით, თქვენი პროფილი წყვეტს.'),
    },
    {
        id: 'world-preview', action: true, places: [{ path: '/world/*', query: { peek: true } }],
        title: w('A quick look', 'სწრაფი დათვალიერება'),
        body: w('Details open beside the list, so you never lose your place. Links inside open the next thing; close it to come back to where you were.',
            'დეტალები სიის გვერდით იხსნება, ასე რომ ადგილს არ კარგავთ. შიგნით არსებული ბმულები შემდეგს ხსნის; დახურეთ და იქ დაბრუნდებით, სადაც იყავით.'),
    },
    {
        id: 'arrange-match', action: true, ask: ASK.createMatch,
        places: [{ path: '/world/*', query: { do: 'arrange_match' } }, { path: '/my-squads', query: { arrange: true } }],
        title: w('Arrange a match', 'მატჩის შეთანხმება'),
        body: w('Invite a club to play, or post an open match that anyone can propose to. Choose your squad, the day, time and ground; once the other side accepts, the match is on both calendars.',
            'მოიწვიეთ კლუბი სათამაშოდ, ან გამოაქვეყნეთ ღია მატჩი, რომელზეც ნებისმიერს შეუძლია შემოთავაზება. აირჩიეთ შემადგენლობა, დღე, დრო და მოედანი; როგორც კი მეორე მხარე დათანხმდება, მატჩი ორივეს კალენდარში აღმოჩნდება.'),
    },
    {
        id: 'create-tournament', action: true, places: [{ path: '/world/*', query: { peek: 'draw-*' } }], ask: ASK.tournamentHelp,
        title: w('Create a tournament', 'ტურნირის შექმნა'),
        body: w('Answer the questions that decide it (age group, format, teams, dates, place) and the rest is filled in with the likely answers. Before you press Create you see how many matches it makes and how long it takes.',
            'უპასუხეთ მთავარ კითხვებს (ასაკობრივი ჯგუფი, ფორმატი, გუნდები, თარიღები, ადგილი) და დანარჩენი სავარაუდო პასუხებით შეივსება. „შექმნამდე“ ხედავთ, რამდენი მატჩი იქნება და რამდენ ხანს გაგრძელდება.'),
    },

    // ------------------------------------------------------------------ My squads and squad pages
    {
        id: 'my-squads', places: [{ path: '/my-squads' }], ask: ASK.notifyPlayers, askFor: 'staff',
        title: w('My squads', 'ჩემი გუნდები'),
        body: w('Everything for the squads you coach: their calendar, players, updates to parents and your coaching team. Choose a squad to open its own page.',
            'ყველაფერი იმ გუნდებისთვის, რომლებსაც წვრთნით: კალენდარი, მოთამაშეები, სიახლეები მშობლებისთვის და თქვენი სამწვრთნელო შტაბი. აირჩიეთ გუნდი და მისი გვერდი გაიხსნება.'),
    },
    {
        id: 'squad-update', action: true, places: [{ path: '/my-squads', query: { compose: true } }], ask: ASK.notifyPlayers, askFor: 'staff',
        title: w('Post an update', 'სიახლის გამოქვეყნება'),
        body: w('Tell the squad’s players and their parents what they need to know: a new time, what to bring, a result. It goes on the squad page and they are notified.',
            'უთხარით გუნდის მოთამაშეებსა და მათ მშობლებს, რაც უნდა იცოდნენ: ახალი დრო, რა წამოიღონ, შედეგი. სიახლე გუნდის გვერდზე გამოჩნდება და მათ შეტყობინება მიუვათ.'),
    },
    {
        id: 'squad-page', places: [{ path: '/squads/:id' }], ask: ASK.schedule,
        title: w('Squad page', 'გუნდის გვერდი'),
        body: w('One page for the squad, the same for coaches and parents: updates from the coach, the schedule, the players and the grounds. The squad’s chat is in Messages.',
            'გუნდის ერთი გვერდი, ერთნაირი მწვრთნელებისა და მშობლებისთვის: მწვრთნელის სიახლეები, განრიგი, მოთამაშეები და მოედნები. გუნდის ჩატი მიმოწერაშია.'),
    },
    {
        id: 'training-setup', action: true, places: [{ path: '/squads/:id', query: { setup: 'training' } }], ask: ASK.training,
        title: w('Set up training', 'ვარჯიშის დაგეგმვა'),
        body: w('Set the squad’s regular training: the days, the times and the ground. The sessions then appear on the calendar of everyone in the squad.',
            'დააყენეთ გუნდის რეგულარული ვარჯიში: დღეები, დრო და მოედანი. ვარჯიშები გუნდის ყველა წევრის კალენდარში გამოჩნდება.'),
    },
    {
        id: 'add-players', action: true,
        title: w('Add players', 'მოთამაშეების დამატება'),
        body: w('Bring players into the squad so they see its schedule and updates. Someone who isn’t on GrassKickZ yet can be invited.',
            'დაამატეთ მოთამაშეები გუნდში, რომ მისი განრიგი და სიახლეები დაინახონ. ვინც ჯერ GrassKickZ-ზე არ არის, შეგიძლიათ მოიწვიოთ.'),
    },

    // ------------------------------------------------------------------ My Club, the club page and its workspace
    {
        id: 'my-club', places: [{ path: '/my-club' }], ask: ASK.findClubs,
        title: w('My Club', 'ჩემი კლუბი'),
        body: w('Find the club you play, coach or work at and ask to join, or start a club of your own. Invitations from clubs appear here too.',
            'იპოვეთ კლუბი, სადაც თამაშობთ, წვრთნით ან მუშაობთ, და მოითხოვეთ გაწევრიანება, ან შექმენით საკუთარი კლუბი. კლუბების მოწვევებიც აქ გამოჩნდება.'),
    },
    {
        id: 'club-page', places: [{ path: '/clubs/:id' }], ask: ASK.myClubs,
        title: w('Club page', 'კლუბის გვერდი'),
        body: w('A club’s public page: posts, teams and training, coaches and staff, facilities and contacts. Follow it to see its news on Home, or ask to join. The club’s own staff open its workspace from here.',
            'კლუბის საჯარო გვერდი: პოსტები, გუნდები და ვარჯიშები, მწვრთნელები და პერსონალი, ინფრასტრუქტურა და კონტაქტი. გამოიწერეთ, რომ მისი სიახლეები „მთავარზე“ ნახოთ, ან მოითხოვეთ გაწევრიანება. კლუბის პერსონალი აქედან ხსნის სამუშაო სივრცეს.'),
    },
    {
        id: 'followed-clubs', places: [{ path: '/clubs/following' }], ask: ASK.myClubs,
        title: w('Clubs you follow', 'გამოწერილი კლუბები'),
        body: w('The clubs you follow. Their posts and news come to your Home feed; you can unfollow any time from the club’s page.',
            'კლუბები, რომლებსაც მიჰყვებით. მათი პოსტები და სიახლეები თქვენს „მთავარ“ ფიდში მოდის; გამოწერის გაუქმება ნებისმიერ დროს შეგიძლიათ კლუბის გვერდიდან.'),
    },
    {
        id: 'club-workspace', places: [{ path: '/clubs/:id/workspace' }], ask: ASK.applications,
        title: w('Club workspace', 'კლუბის სამუშაო სივრცე'),
        body: w('Where the club is run. Today shows the totals, decisions and the coming week; the rail lists every tool your role allows: squads, players, staff, calendar, store and more. Hide what you don’t use with Edit tabs.',
            'აქ იმართება კლუბი. „დღეს“ აჩვენებს მთავარ ციფრებს, გადაწყვეტილებებს და მომავალ კვირას; გვერდით ზოლში ყველა ინსტრუმენტია, რაც თქვენს როლს ეკუთვნის: შემადგენლობები, მოთამაშეები, პერსონალი, კალენდარი, მაღაზია და სხვა. რასაც არ იყენებთ, „ჩანართების რედაქტირებით“ დამალეთ.'),
    },
    {
        id: 'club-updates', places: workspaceTab('inbox', 'actions'), ask: ASK.applications,
        title: w('Club updates', 'კლუბის სიახლეები'),
        body: w('Decisions, alerts and jobs waiting for the club, in one list. Deal with each one here or open it for the details.',
            'გადაწყვეტილებები, გაფრთხილებები და საქმეები, რომლებიც კლუბს ელოდება, ერთ სიაში. მოაგვარეთ აქვე ან გახსენით დეტალების სანახავად.'),
    },
    {
        id: 'club-calendar', places: workspaceTab('calendar'), ask: ASK.training,
        title: w('Club calendar', 'კლუბის კალენდარი'),
        body: w('Every squad’s training, matches and club events in one calendar. Use Plan training to add sessions for a squad.',
            'ყველა შემადგენლობის ვარჯიშები, მატჩები და კლუბის ღონისძიებები ერთ კალენდარში. გუნდისთვის ვარჯიშების დასამატებლად „ვარჯიშის დაგეგმვა“ გამოიყენეთ.'),
    },
    {
        id: 'club-tools', places: workspaceTab('tools'),
        title: w('All tools', 'ყველა ინსტრუმენტი'),
        body: w('Every tool your role at the club allows, in one place. Missing one you need? Ask a club admin for that responsibility.',
            'ყველა ინსტრუმენტი, რასაც კლუბში თქვენი როლი გაძლევთ, ერთ ადგილას. რაიმე გაკლიათ? სთხოვეთ კლუბის ადმინისტრატორს ეს პასუხისმგებლობა.'),
    },
    {
        id: 'club-staff', places: workspaceTab('personnel'), ask: ASK.staff,
        title: w('Staff', 'პერსონალი'),
        body: w('The club’s coaches, specialists, referees and management, and what each of them can do. Invite staff to give someone a role at the club.',
            'კლუბის მწვრთნელები, სპეციალისტები, მსაჯები და ხელმძღვანელობა — და რისი გაკეთება შეუძლია თითოეულს. პერსონალის მოწვევით ადამიანს კლუბში როლს მიანიჭებთ.'),
    },
    {
        id: 'club-players', places: workspaceTab('players'), ask: ASK.players,
        title: w('Players', 'მოთამაშეები'),
        body: w('Everyone who plays for the club, trialists included, with their status. Invite a player to start bringing someone new in.',
            'ყველა, ვინც კლუბში თამაშობს, გასინჯვაზე მყოფების ჩათვლით, მათი სტატუსით. ახალი მოთამაშის მოსაყვანად მოიწვიეთ ის.'),
    },
    {
        id: 'club-invites', places: workspaceTab('invites'),
        title: w('Invitations', 'მოწვევები'),
        body: w('Invite people to join the club, and follow the invitations you’ve sent until they are answered.',
            'მოიწვიეთ ადამიანები კლუბში და თვალი ადევნეთ გაგზავნილ მოწვევებს, სანამ პასუხს მიიღებთ.'),
    },
    {
        id: 'club-applications', places: workspaceTab('applications'), ask: ASK.applications,
        title: w('Applications', 'განაცხადები'),
        body: w('People who asked to join the club or applied for a role. Review each one, then accept or decline.',
            'ადამიანები, რომლებმაც კლუბში გაწევრიანება ან როლზე განაცხადი გამოგზავნეს. განიხილეთ თითოეული და მიიღეთ ან უარყავით.'),
    },
    {
        id: 'club-admissions', places: workspaceTab('admissions'),
        title: w('Player admission', 'მოთამაშეების მიღება'),
        body: w('Bring new players in step by step: arrange an introduction, agree a place, then complete their enrolment in a group.',
            'ახალი მოთამაშეების ეტაპობრივი მიღება: მოაწყვეთ გაცნობა, შეთანხმდით ადგილზე და დაასრულეთ ჯგუფში ჩარიცხვა.'),
    },
    {
        id: 'club-squads', places: [...workspaceTab('squads'), { path: '/clubs/:id/squads' }], ask: ASK.players,
        title: w('Squads', 'შემადგენლობები'),
        body: w('The club’s squads, each with its roster, training and the people responsible for it. Create a squad for every team or age group, then add its players.',
            'კლუბის შემადგენლობები — თითოეულს თავისი სია, ვარჯიშები და პასუხისმგებელი პირები ჰყავს. შექმენით შემადგენლობა ყოველი გუნდისა თუ ასაკობრივი ჯგუფისთვის და დაამატეთ მოთამაშეები.'),
    },
    {
        id: 'new-squad', action: true, ask: ASK.form,
        title: w('New squad', 'ახალი გუნდი'),
        body: w('A squad is one team: its age group, boys or girls, its coaches and its players. Create it, then add players and set up its training.',
            'გუნდი ერთი შემადგენლობაა: ასაკობრივი ჯგუფი, ბიჭები თუ გოგონები, მწვრთნელები და მოთამაშეები. შექმენით, შემდეგ დაამატეთ მოთამაშეები და დაგეგმეთ ვარჯიში.'),
    },
    {
        id: 'player-cards', places: workspaceTab('player-cards'),
        title: w('Player cards', 'მოთამაშის ბარათები'),
        body: w('Football profiles for the club’s players, including young players who don’t have an account of their own. Keep positions, numbers and details up to date.',
            'კლუბის მოთამაშეების საფეხბურთო პროფილები, მათ შორის პატარებისაც, ვისაც საკუთარი ანგარიში არ აქვს. განაახლეთ პოზიციები, ნომრები და დეტალები.'),
    },
    {
        id: 'club-tryouts', places: workspaceTab('tryouts'),
        title: w('Tryouts', 'სინჯები'),
        body: w('Organise trials for new players: post a tryout with the date, the place and who you’re looking for, then review the players who apply.',
            'მოაწყვეთ სინჯები ახალი მოთამაშეებისთვის: გამოაქვეყნეთ თარიღი, ადგილი და ვის ეძებთ, შემდეგ განიხილეთ განმცხადებლები.'),
    },
    {
        id: 'post-tryout', action: true, ask: ASK.form,
        title: w('Post a tryout', 'სინჯის გამოქვეყნება'),
        body: w('Say who you’re looking for (age group and positions), when and where. Once it’s posted, players find it in World under Trials and apply.',
            'მიუთითეთ, ვის ეძებთ (ასაკობრივი ჯგუფი და პოზიციები), როდის და სად. გამოქვეყნების შემდეგ მოთამაშეები მას „მსოფლიოში“, „გასინჯვების“ ჩანართზე იპოვიან და განაცხადს გამოგზავნიან.'),
    },
    {
        id: 'club-jobs', places: workspaceTab('jobs'), ask: ASK.vacancy,
        title: w('Hiring', 'დაქირავება'),
        body: w('Post the club’s open roles and review who applies. Posted roles also appear in Jobs & volunteering, where everyone can find them.',
            'გამოაქვეყნეთ კლუბის ვაკანსიები და განიხილეთ განმცხადებლები. გამოქვეყნებული ვაკანსიები „სამუშაო და მოხალისეობაშიც“ ჩანს, სადაც ყველას შეუძლია მათი პოვნა.'),
    },
    {
        id: 'post-job', action: true, places: [{ path: '/jobs/new' }], ask: ASK.vacancy,
        title: w('Post a job', 'ვაკანსიის გამოქვეყნება'),
        body: w('Three short screens: the line of work and title; the pay, terms and hours; then how people reach you. Post for a club you run, or list yourself as available for work.',
            'სამი მოკლე ეკრანი: სფერო და სათაური; ანაზღაურება, პირობები და სამუშაო საათები; შემდეგ — როგორ დაგიკავშირდნენ. გამოაქვეყნეთ თქვენი კლუბისთვის, ან განაცხადეთ, რომ თავად ეძებთ სამუშაოს.'),
    },
    {
        id: 'club-programmes', places: workspaceTab('programmes'),
        title: w('Programmes & fees', 'პროგრამები და საფასური'),
        body: w('The club’s training programmes with their prices and fees. They show on the club’s public page, so families know what to expect.',
            'კლუბის სავარჯიშო პროგრამები ფასებითა და საფასურით. ისინი კლუბის საჯარო გვერდზე ჩანს, რომ ოჯახებმა იცოდნენ, რას ელოდონ.'),
    },
    {
        id: 'club-store', places: workspaceTab('store'),
        title: w('Club store', 'კლუბის მაღაზია'),
        body: w('The club’s shop on GrassKickZ. Add kit and merchandise with photos and prices; products stay drafts until you publish them, and buyers contact the club to buy.',
            'კლუბის მაღაზია GrassKickZ-ზე. დაამატეთ ფორმები და სუვენირები ფოტოებითა და ფასებით; პროდუქტი გამოქვეყნებამდე მონახაზად რჩება, მყიდველები კი საყიდლად კლუბს უკავშირდებიან.'),
    },
    {
        id: 'add-product', action: true, places: [{ path: '/clubs/:id/store', query: { add: true } }], ask: ASK.form,
        title: w('Add a product', 'პროდუქტის დამატება'),
        body: w('Give it a name, a price and photos. It stays a draft until you publish it; then it shows in the club’s store and in the GrassKickZ store.',
            'მიუთითეთ სახელი, ფასი და ფოტოები. გამოქვეყნებამდე მონახაზად რჩება; შემდეგ კლუბის მაღაზიაშიც და GrassKickZ-ის მაღაზიაშიც გამოჩნდება.'),
    },
    {
        id: 'club-campaigns', places: workspaceTab('campaigns'), ask: ASK.fundraiser,
        title: w('Fundraising', 'შემოწირულობები'),
        body: w('The club’s fundraising and sponsorship campaigns: what you’re raising for, the target and how far you’ve got. Start a new campaign from here.',
            'კლუბის შემოწირულობებისა და სპონსორობის კამპანიები: რისთვის აგროვებთ, რა არის მიზანი და რამდენი შეგროვდა. ახალი კამპანია აქედან დაიწყეთ.'),
    },
    {
        id: 'start-fundraiser', action: true, places: [{ path: '/campaigns/new' }], ask: ASK.fundraiser, askFor: 'staff',
        title: w('Start a fundraiser', 'თანხის შეგროვების დაწყება'),
        body: w('One form: the title, the story and what the money is for. It saves as a draft with its own project, and goes public when you publish it. GrassKickZ takes no payments; supporters ask your club how to give.',
            'ერთი ფორმა: სათაური, ამბავი და რას მოხმარდება თანხა. ჯერ მონახაზად შეინახება საკუთარ პროექტთან ერთად და გამოქვეყნების შემდეგ საჯარო ხდება. GrassKickZ გადახდებს არ იღებს; გულშემატკივრები თქვენს კლუბს ეკითხებიან, როგორ დაეხმარონ.'),
    },
    {
        id: 'club-settings', places: workspaceTab('settings'), ask: ASK.clubPage,
        title: w('Club settings', 'კლუბის პარამეტრები'),
        body: w('Decide how people can join the club, what its public page shows and which activities it runs. You can also import players and staff here.',
            'გადაწყვიტეთ, როგორ შეუერთდნენ ადამიანები კლუბს, რას აჩვენებს მისი საჯარო გვერდი და რა საქმიანობას ეწევა. აქვე შეგიძლიათ მოთამაშეებისა და პერსონალის იმპორტი.'),
    },
    {
        id: 'club-profile-settings', places: [{ path: '/clubs/:id/profile-settings' }], ask: ASK.clubPage,
        title: w('Club page details', 'კლუბის გვერდის დეტალები'),
        body: w('What families see on the club’s public page: programmes, fees, sponsors and affiliations. Fill it in so the right players find you.',
            'რას ხედავენ ოჯახები კლუბის საჯარო გვერდზე: პროგრამები, საფასური, სპონსორები და კავშირები. შეავსეთ, რომ შესაფერისმა მოთამაშეებმა გიპოვონ.'),
    },
    {
        id: 'club-roles', places: workspaceTab('roles', 'role-requests'),
        title: w('Ownership & access', 'მფლობელობა და წვდომა'),
        body: w('Who owns the club, who manages it and what each person may do. Change someone’s access or answer requests for a role here.',
            'ვინ ფლობს კლუბს, ვინ მართავს და რისი უფლება აქვს თითოეულს. აქ შეცვალეთ ვინმეს წვდომა ან უპასუხეთ როლის მოთხოვნებს.'),
    },
    {
        id: 'club-operations',
        places: workspaceTab('staff-duties', 'credentials', 'specialists', 'guardians', 'attendance', 'registration', 'departures', 'development',
            'education', 'facilities', 'preparation', 'equipment', 'finance', 'travel', 'restrictions', 'medical', 'welfare', 'workspace-settings'),
        title: w('Running the club', 'კლუბის მართვა'),
        body: w('Tools for the club’s day-to-day work: duties, credentials, attendance, medical, welfare, equipment, travel, finance and more. Each one shows only what your role allows.',
            'ინსტრუმენტები კლუბის ყოველდღიური საქმისთვის: მოვალეობები, სერტიფიკატები, დასწრება, სამედიცინო, კეთილდღეობა, აღჭურვილობა, მგზავრობა, ფინანსები და სხვა. თითოეული მხოლოდ იმას აჩვენებს, რაც თქვენს როლს ეკუთვნის.'),
    },

    // ------------------------------------------------------------------ You: schedule, profile, account, family
    {
        id: 'my-schedule', places: [{ path: '/profile/:id', query: { tab: 'schedule' } }], ask: ASK.schedule,
        title: w('My schedule', 'ჩემი განრიგი'),
        body: w('Your own plans, your squads’ sessions and matches, and trips, together in one calendar. Add something of your own with New event.',
            'თქვენი გეგმები, თქვენი გუნდების ვარჯიშები და მატჩები და მგზავრობები — ერთ კალენდარში. საკუთარი რამის დასამატებლად „ახალი ღონისძიება“ გამოიყენეთ.'),
    },
    {
        id: 'profile', places: [{ path: '/profile/:id' }], ask: ASK.profile,
        title: w('Profile', 'პროფილი'),
        body: w('A person’s football profile: roles, clubs, career, posts, photos and videos. Yours is how clubs, coaches and scouts see you, so keep it full and up to date.',
            'ადამიანის საფეხბურთო პროფილი: როლები, კლუბები, კარიერა, პოსტები, ფოტოები და ვიდეოები. თქვენი პროფილით გიცნობენ კლუბები, მწვრთნელები და სკაუტები — შეავსეთ და განაახლეთ.'),
    },
    {
        id: 'account', places: [{ path: '/account' }], ask: ASK.account,
        title: w('Account & settings', 'ანგარიში და პარამეტრები'),
        body: w('Your details, password and two-step sign-in, the notifications you get, where you’re signed in, linked accounts such as Google, and closing your account.',
            'თქვენი მონაცემები, პაროლი და ორსაფეხურიანი შესვლა, რა შეტყობინებებს იღებთ, სად ხართ შესული, დაკავშირებული ანგარიშები (მაგ. Google) და ანგარიშის დახურვა.'),
    },
    {
        id: 'account-roles', places: [{ path: '/account/roles' }], ask: ASK.profile,
        title: w('Roles and work', 'როლები და საქმიანობა'),
        body: w('Tell GrassKickZ what you do in football: player, parent, coach, referee, fan or a professional role. Your roles show on your profile and help the right clubs and people find you.',
            'უთხარით GrassKickZ-ს, რას აკეთებთ ფეხბურთში: მოთამაშე, მშობელი, მწვრთნელი, მსაჯი, გულშემატკივარი თუ პროფესიული როლი. როლები თქვენს პროფილზე ჩანს და შესაფერის კლუბებსა და ადამიანებს თქვენს პოვნაში ეხმარება.'),
    },
    {
        id: 'parent-hub', places: [{ path: '/parent' }], ask: ASK.schedule,
        title: w('Parent Hub', 'მშობლის სივრცე'),
        body: w('Your children’s football in one place: the next session, the latest word from the coach, their squads, fees and the week ahead. With more than one child, choose whose you’re looking at.',
            'თქვენი შვილების ფეხბურთი ერთ ადგილას: შემდეგი ვარჯიში, მწვრთნელის ბოლო სიახლე, მათი გუნდები, გადასახადები და მომავალი კვირა. თუ რამდენიმე შვილი გყავთ, აირჩიეთ, ვისას უყურებთ.'),
    },
    {
        id: 'add-child', places: [{ path: '/parent', query: { tab: 'children' } }],
        title: w('Your children', 'თქვენი შვილები'),
        body: w('Add your child to make their player card. You look after it for them and decide what clubs and coaches can see.',
            'დაამატეთ შვილი და შეუქმენით მოთამაშის ბარათი. მას თქვენ მართავთ და წყვეტთ, რა დაინახონ კლუბებმა და მწვრთნელებმა.'),
    },
    {
        id: 'admissions', places: [{ path: '/admissions/*' }], ask: ASK.groups,
        title: w('Joining football', 'ფეხბურთში მონაწილეობა'),
        body: w('Your enquiries and places at clubs’ training groups. Follow each one from the first question to a place in a group.',
            'თქვენი მოთხოვნები და ადგილები კლუბების სავარჯიშო ჯგუფებში. თვალი ადევნეთ თითოეულს პირველი კითხვიდან ჯგუფში ადგილამდე.'),
    },
    {
        id: 'team-work', places: [{ path: '/team-work/*' }], ask: ASK.waiting,
        title: w('Team work', 'გუნდის სამუშაო'),
        body: w('What the team is building and fixing: plans, tasks and their status, questions waiting for an answer and what changed. Dola can move tasks and answer questions for you.',
            'რას აწყობს და ასწორებს გუნდი: გეგმები, თასქები და მათი სტატუსი, უპასუხო კითხვები და რა შეიცვალა. დოლას შეუძლია თასქების გადატანა და კითხვებზე პასუხი თქვენ ნაცვლად.'),
    },

    // ------------------------------------------------------------------ Store, jobs and fundraising for everyone
    {
        id: 'store', places: [{ path: '/store/*' }, { path: '/clubs/:id/store' }], ask: ASK.store,
        title: w('Store', 'მაღაზია'),
        body: w('Kit and merchandise from clubs, in one place. Add items to your cart to see the total, then contact the club to buy directly: GrassKickZ doesn’t take payment yet.',
            'კლუბების ფორმები და სუვენირები ერთ ადგილას. დაამატეთ ნივთები კალათაში ჯამის სანახავად, შემდეგ საყიდლად პირდაპირ კლუბს დაუკავშირდით: GrassKickZ ჯერ გადახდას არ იღებს.'),
    },
    {
        id: 'fundraising', places: [{ path: '/campaigns' }, { path: '/campaigns/:id' }, { path: '/clubs/:id/campaigns' }], ask: ASK.fundraiser, askFor: 'staff',
        title: w('Fundraising', 'თანხის შეგროვება'),
        body: w('Clubs raising money for kit, pitches, travel and more. Read a fundraiser’s story and see how far it has got; donations are made on GoFundMe. A club’s owner or admin can start one in three short screens.',
            'კლუბები თანხას აგროვებენ ინვენტარისთვის, მოედნებისთვის, მგზავრობისთვის და სხვა. წაიკითხეთ შეგროვების ამბავი და ნახეთ, რამდენი შეგროვდა; შემოწირულობა GoFundMe-ზე ხდება. კლუბის მფლობელს ან ადმინისტრატორს შეგროვების დაწყება სამ მოკლე ეკრანზე შეუძლია.'),
    },

    // ------------------------------------------------------------------ Tournaments, venues, matches and trials
    {
        id: 'tournament-page', places: [{ path: '/tournaments/:id' }], ask: ASK.myTournaments,
        title: w('Tournament', 'ტურნირი'),
        body: w('One tournament: its bracket or table, the matches and results, the teams taking part and what it is about.',
            'ერთი ტურნირი: მისი ბადე ან ცხრილი, მატჩები და შედეგები, მონაწილე გუნდები და ინფორმაცია მის შესახებ.'),
    },
    {
        id: 'tournament-workspace', places: [{ path: '/tournaments/:id/workspace' }],
        title: w('Tournament workspace', 'ტურნირის სამუშაო სივრცე'),
        body: w('Run the tournament: accept the teams taking part, set up the competition and its schedule, manage matchday and results, and the people helping you.',
            'მართეთ ტურნირი: მიიღეთ მონაწილე გუნდები, ააწყვეთ შეჯიბრი და მისი განრიგი, მართეთ მატჩის დღე და შედეგები, ასევე თქვენი დამხმარეები.'),
    },
    {
        id: 'organization-workspace', places: [{ path: '/organizations/:id/workspace' }], ask: ASK.tournamentHelp,
        title: w('Organisation workspace', 'ორგანიზაციის სამუშაო სივრცე'),
        body: w('Run your organisation: its profile, facilities, tournaments and team. Create a new tournament from here.',
            'მართეთ თქვენი ორგანიზაცია: პროფილი, ინფრასტრუქტურა, ტურნირები და გუნდი. ახალი ტურნირი აქედან შექმენით.'),
    },
    {
        id: 'venue-workspace', places: [{ path: '/stadiums/:id/manage' }],
        title: w('Venue workspace', 'სტადიონის სამუშაო სივრცე'),
        body: w('Run your venue: the calendar and reservations, booking requests, your pitches, the venue’s public page and its setup.',
            'მართეთ თქვენი სტადიონი: კალენდარი და ჯავშნები, ჯავშნის მოთხოვნები, მოედნები, საჯარო გვერდი და პარამეტრები.'),
    },
    {
        id: 'venue-page', places: [{ path: '/stadiums/:id' }],
        title: w('Venue', 'სტადიონი'),
        body: w('A venue’s pitches, prices and free times. Choose a time to ask for a booking.',
            'სტადიონის მოედნები, ფასები და თავისუფალი დრო. აირჩიეთ დრო და მოითხოვეთ ჯავშანი.'),
    },
    {
        id: 'match', places: [{ path: '/match-exchange/:id' }], ask: ASK.matches,
        title: w('Match', 'მატჩი'),
        body: w('Everything about one match: kick-off and ground, the other side’s answer, officials, the players and, at the end, the result.',
            'ყველაფერი ერთ მატჩზე: დაწყების დრო და მოედანი, მეორე მხარის პასუხი, მსაჯები, მოთამაშეები და ბოლოს — შედეგი.'),
    },
    {
        id: 'trial', places: [{ path: '/tryouts/:id' }], ask: ASK.tryouts,
        title: w('Trial', 'გასინჯვა'),
        body: w('A club’s trial: who they’re looking for, when and where. Read it through and apply here.',
            'კლუბის გასინჯვა: ვის ეძებენ, როდის და სად. ყურადღებით წაიკითხეთ და განაცხადი აქ გააგზავნეთ.'),
    },
];
