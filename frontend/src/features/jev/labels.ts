const labels: Record<string, [string, string]> = {
    COACHING: ['Coaching', 'მწვრთნელობა'], FOOTBALL_OPERATIONS: ['Football operations', 'საფეხბურთო საქმიანობა'],
    ADMINISTRATION: ['Administration', 'ადმინისტრაცია'], MEDIA_COMMUNICATIONS: ['Media & communications', 'მედია და კომუნიკაცია'],
    FACILITIES: ['Facilities & maintenance', 'ინფრასტრუქტურა'], MEDICAL: ['Medical & wellbeing', 'ჯანმრთელობა'],
    MATCHDAY: ['Matchday staff', 'მატჩის პერსონალი'], OTHER: ['Other', 'სხვა'],
    POSITION: ['Position', 'თანამდებობა'], QUALIFICATION: ['Qualification', 'კვალიფიკაცია'],
    ACHIEVEMENT: ['Achievement', 'მიღწევა'], VOLUNTEERING: ['Volunteering', 'მოხალისეობა'],
    SPAM: ['Spam', 'სპამი'], HARASSMENT: ['Harassment', 'შევიწროება'], SAFETY: ['Safety concern', 'უსაფრთხოების საკითხი'],
    MISLEADING: ['Misleading content', 'შეცდომაში შემყვანი ინფორმაცია'], URGENT: ['Urgent human review', 'სასწრაფო განხილვა'], NORMAL: ['Standard human review', 'ჩვეულებრივი განხილვა'],
    CONSISTENT: ['No clear conflict found in the engagement terms. Please review them yourself.', 'დასაქმების პირობებში აშკარა წინააღმდეგობა არ ჩანს. გადაამოწმეთ.'],
    CONTRADICTION: ['The description may conflict with the selected paid or volunteer terms.', 'აღწერა შესაძლოა ანაზღაურების არჩეულ პირობებს ეწინააღმდეგებოდეს.'],
    CLEAR: ['Responsibilities and requirements appear clear.', 'მოვალეობები და მოთხოვნები მკაფიოდ ჩანს.'],
    UNCLEAR: ['Consider clarifying responsibilities and required experience.', 'დააზუსტეთ მოვალეობები და საჭირო გამოცდილება.'],
};
export const adviceLabel = (value: string, ka = false) => labels[value]?.[ka ? 1 : 0] ?? value;

