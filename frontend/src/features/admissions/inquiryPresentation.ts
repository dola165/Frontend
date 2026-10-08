import type { AdmissionInquiry, InquiryAction } from './types';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

/** Compatibility responses have no staff grant: old contextual URLs are not authority. */
export function inquiryContinuation(inquiry: AdmissionInquiry) {
    if (inquiry.continuation) return {
        destination: inquiry.continuation.destination,
        staff: inquiry.continuation.staff && !inquiry.continuation.applicant,
    };
    return { destination: inquiry.applicantDestination || `/admissions/inquiries/${inquiry.id}`, staff: false };
}

export function inquiryOwner(inquiry: AdmissionInquiry) {
    return inquiry.nextAction?.owner ?? (inquiry.status === 'OPEN' ? 'CLUB' : 'NONE');
}

export function useInquiryCopy() {
    const copy = useJourneyCopy();
    const status = (inquiry: AdmissionInquiry) => ({
        OPEN: copy('Conversation open', 'საუბარი ღიაა'),
        ROUTED: copy('Joining arrangement started', 'გაწევრიანების შეთანხმება დაწყებულია'),
        RESOLVED: copy('Question resolved', 'კითხვა გადაწყვეტილია'),
        WITHDRAWN: copy('Enquiry withdrawn', 'კითხვა გაუქმებულია'),
        DECLINED: copy('Club declined the request', 'კლუბმა მოთხოვნა უარყო'),
    })[inquiry.status];
    const next = (inquiry: AdmissionInquiry) => {
        if (inquiry.nextAction?.code === 'JOINING_SETUP' && inquiry.setup?.requested && !inquiry.groupId && inquiry.status === 'OPEN' && inquiryOwner(inquiry) === 'CLUB')
            return copy('Club leadership is reviewing joining setup.', 'კლუბის ხელმძღვანელობა გაწევრიანების პირობებს განიხილავს.');
        if (inquiry.status === 'RESOLVED') return copy('No reply is needed. A new message reopens this question.', 'პასუხი საჭირო არ არის. ახალი შეტყობინება კითხვას ხელახლა გახსნის.');
        if (inquiry.status === 'WITHDRAWN' || inquiry.status === 'DECLINED') return copy('This enquiry is closed. Its conversation and outcome remain available.', 'კითხვა დახურულია. საუბარი და შედეგი ხელმისაწვდომია.');
        if (inquiry.status === 'ROUTED') return inquiryOwner(inquiry) === 'APPLICANT'
            ? copy('The player or guardian needs to continue the joining arrangement.', 'მოთამაშემ ან მეურვემ უნდა გააგრძელოს გაწევრიანების შეთანხმება.')
            : inquiryOwner(inquiry) === 'CLUB'
                ? copy('The club needs to continue the joining arrangement.', 'კლუბმა უნდა გააგრძელოს გაწევრიანების შეთანხმება.')
                : copy('Review the joining arrangement’s next step and recorded outcome.', 'განიხილეთ გაწევრიანების შეთანხმების შემდეგი ნაბიჯი და დაფიქსირებული შედეგი.');
        return inquiryOwner(inquiry) === 'APPLICANT'
            ? inquiry.playerId === null
                ? copy('The player or guardian can reply or confirm that the question is resolved.', 'მოთამაშეს ან მეურვეს შეუძლია უპასუხოს ან დაადასტუროს, რომ კითხვა გადაწყვეტილია.')
                : copy('The player or guardian needs to reply.', 'მოთამაშემ ან მეურვემ უნდა უპასუხოს.')
            : inquiryOwner(inquiry) === 'CLUB'
                ? copy('The club needs to reply.', 'კლუბმა უნდა უპასუხოს.')
                : copy('No action is needed.', 'მოქმედება საჭირო არ არის.');
    };
    const action = (value: InquiryAction): string => ({
        MESSAGE: copy('Send message', 'შეტყობინების გაგზავნა'),
        WITHDRAW: copy('Withdraw this enquiry', 'ამ კითხვის გაუქმება'),
        DECLINE: copy('Decline request', 'მოთხოვნის უარყოფა'),
        ROUTE: copy('Continue with an agreed group', 'შეთანხმებულ ჯგუფთან გაგრძელება'),
        ASSOCIATE_PLAYER: copy('Share selected player', 'არჩეული მოთამაშის გაზიარება'),
        RESOLVE: copy('Mark question resolved', 'კითხვის გადაწყვეტილად მონიშვნა'),
        REOPEN: copy('Reopen question', 'კითხვის ხელახლა გახსნა'),
        REQUEST_SETUP: copy('Ask club leadership to configure joining', 'ხელმძღვანელობისთვის გაწევრიანების პირობების მომზადების თხოვნა'),
    })[value];
    return { copy, status, next, action };
}
