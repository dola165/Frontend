const en = {
    competition: 'Competition', bracket: 'Bracket', matches: 'Matches', teams: 'Teams', about: 'About', navigation: 'Tournament sections',
    stage: 'Stage', share: 'Copy link', copied: 'Link copied', copyFallback: 'Copy this tournament link',
    refresh: 'Refresh results', refreshing: 'Refreshing…', refreshed: 'Results are up to date.', refreshFailed: 'Could not refresh results. Your current view is still here.',
    host: 'Organized by', partnerClub: 'Host club', teamSearch: 'Search teams', noSearch: 'No teams match your search.',
    allMatches: 'All matches', upcoming: 'Upcoming', results: 'Results', cancelled: 'Cancelled',
    noMatches: 'No matches in this view yet.', round: 'Round', time: 'Kickoff', team: 'Team',
    finalist: 'Winner', guestTeam: 'Guest team', registration: 'Entry details',
    bracketHint: 'Follow the bracket or standings, see scores, and find the next match.',
    notDrawn: 'The draw is coming soon', notDrawnHint: 'Confirmed teams will appear here when the organizer sets the draw.',
    participating: 'Taking part', venue: 'Tournament dates', searchHint: 'Search by club, squad or team name',
};
const ka: typeof en = {
    competition: 'შეჯიბრება', bracket: 'ბადე', matches: 'მატჩები', teams: 'გუნდები', about: 'შესახებ', navigation: 'ტურნირის სექციები',
    stage: 'ეტაპი', share: 'ბმულის კოპირება', copied: 'ბმული დაკოპირებულია', copyFallback: 'დააკოპირეთ ტურნირის ბმული',
    refresh: 'შედეგების განახლება', refreshing: 'ახლდება…', refreshed: 'შედეგები განახლებულია.', refreshFailed: 'შედეგები ვერ განახლდა. მიმდინარე ხედი შენარჩუნებულია.',
    host: 'ორგანიზატორი', partnerClub: 'მასპინძელი კლუბი', teamSearch: 'გუნდების ძიება', noSearch: 'გუნდი ვერ მოიძებნა.',
    allMatches: 'ყველა მატჩი', upcoming: 'მომავალი', results: 'შედეგები', cancelled: 'გაუქმებული',
    noMatches: 'ამ ხედში მატჩები ჯერ არ არის.', round: 'რაუნდი', time: 'დაწყება', team: 'გუნდი',
    finalist: 'გამარჯვებული', guestTeam: 'მოწვეული გუნდი', registration: 'მონაწილეობის დეტალები',
    bracketHint: 'თვალი ადევნეთ რაუნდებს, შედეგებს და მომდევნო მატჩებს.',
    notDrawn: 'ბადე მალე გამოქვეყნდება', notDrawnHint: 'დადასტურებული გუნდები აქ გამოჩნდება, როდესაც ორგანიზატორი ბადეს შეადგენს.',
    participating: 'მონაწილეები', venue: 'ტურნირის თარიღები', searchHint: 'მოძებნეთ კლუბის ან გუნდის სახელით',
};

export const tournamentPublicCopy = (language: string) => language.startsWith('ka') ? ka : en;
