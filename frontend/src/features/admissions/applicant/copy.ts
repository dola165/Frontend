import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { AdmissionMethod, Availability, CaseStage, NextAction, RequirementKind } from '../types';
type Pair = [string, string];
export const availabilityCopy: Record<Availability, Pair> = {
    PLACES_AVAILABLE:['Places available','ადგილები ხელმისაწვდომია'], APPLICATIONS_OPEN:['Applications open','განაცხადების მიღება ღიაა'],
    INTRODUCTION_AVAILABLE:['Introductory sessions available','გაცნობითი ვარჯიში ხელმისაწვდომია'], UPCOMING_ASSESSMENT:['Upcoming assessment','მომავალი შეფასება'],
    WAITLIST:['Waiting list','მოლოდინის სია'], CLOSED:['Intake closed','მიღება დახურულია'],
};
export const methodCopy: Record<AdmissionMethod, Pair> = {DIRECT:['Direct enrollment','პირდაპირი ჩარიცხვა'], INTRODUCTION:['Introduction before joining','გაცნობითი ვარჯიში ჩარიცხვამდე'], SELECTIVE:['Selection before joining','შერჩევა ჩარიცხვამდე']};
export const stageCopy: Record<CaseStage, Pair> = {
    REQUEST_RECEIVED:['Request received','მოთხოვნა მიღებულია'], ARRANGING_PARTICIPATION:['Arranging participation','მონაწილეობის შეთანხმება'],
    INTRODUCTION_ASSESSMENT:['Introduction or assessment','გაცნობითი ვარჯიში ან შეფასება'], WAITLIST:['Waiting list','მოლოდინის სია'],
    PLACE_OFFERED:['Place offered','ადგილი შემოთავაზებულია'], COMPLETING_ENROLLMENT:['Completing enrollment','ჩარიცხვის დასრულება'], ENROLLED:['Enrolled','ჩარიცხულია'], CLOSED:['Closed','დახურულია'],
};
export const requirementCopy: Record<RequirementKind, Pair> = {
    EMERGENCY_CONTACT:['Emergency contact','გადაუდებელი საკონტაქტო პირი'], SCHOOL_ELIGIBILITY:['School eligibility confirmation','სკოლის უფლებამოსილების დადასტურება'],
    CURRENT_CLUB_PERMISSION:['Current club permission','მიმდინარე კლუბის ნებართვა'], PAYMENT_CONFIRMATION:['Payment confirmation by staff','გადახდის დადასტურება თანამშრომლის მიერ'],
    EXTERNAL_REGISTRATION:['External registration','გარე რეგისტრაცია'], PRIMARY_AFFILIATION_CONFIRMATION:['Explicit competitive club change','სათამაშო კლუბის ცვლილების ცალკე დადასტურება'], GUARDIAN_REVIEW:['Guardian authority review','მეურვის უფლებამოსილების განხილვა'],
};
export function useAdmissionCopy() {
    const copy = useJourneyCopy();
    return {copy, availability:(v:Availability)=>copy(...availabilityCopy[v]), method:(v:AdmissionMethod)=>copy(...methodCopy[v]), stage:(v:CaseStage)=>copy(...stageCopy[v]), requirement:(v:RequirementKind)=>copy(...requirementCopy[v]),
        next:(n:NextAction)=>{
            const labels:Record<string,Pair>={INTRODUCTION_PERMISSION_REQUIRED:['Host staff must record actual current-club permission before you can confirm this session.','მასპინძელმა თანამშრომელმა სესიის დადასტურებამდე უნდა დააფიქსიროს მიმდინარე კლუბის ნებართვა.'],ELIGIBILITY_REVIEW:['The player details were corrected. Club staff must review eligibility before this agreement can be completed.','მოთამაშის მონაცემები შესწორდა. ამ შეთანხმების დასრულებამდე კლუბის თანამშრომელმა უნდა განიხილოს შესაბამისობა.'],RESOLVE_EXPIRED_RESERVATION:['The reservation expired. Staff must review actual outstanding obligations and any new offer; no place or refund is restored.', 'ჯავშნის ვადა ამოიწურა. თანამშრომელმა უნდა განიხილოს დარჩენილი ვალდებულებები და ახალი შეთავაზება; ადგილი ან თანხის დაბრუნება არ აღდგება.'],CONSENT_RECONFIRM_REQUIRED:['The player must make their own current agreement. End the pending guardian arrangement with a reason, then review a new linked request.', 'მოთამაშემ თავად უნდა დადოს მიმდინარე შეთანხმება. მიზეზის მითითებით დაასრულეთ მეურვის დაუსრულებელი შეთანხმება, შემდეგ განიხილეთ ახალი დაკავშირებული მოთხოვნა.'],REVIEW_OVERDUE:['The participation review is overdue. Ask the responsible staff for the next decision; no outcome has been assumed.', 'მონაწილეობის განხილვის ვადა გასულია. შემდეგი გადაწყვეტილებისთვის მიმართეთ პასუხისმგებელ თანამშრომელს; შედეგი წინასწარ არ განისაზღვრება.'],CLUB_REVIEW:['The club will review your request and arrange the next step.','კლუბი განიხილავს მოთხოვნას და შემდეგ ნაბიჯს შეათანხმებს.'],RESPOND_SESSION:['Review and respond to the session invitation.','განიხილეთ და უპასუხეთ სესიის მოწვევას.'],REVIEW_PARTICIPATION:['Complete the agreed participation and review it with the club.','დაასრულეთ შეთანხმებული მონაწილეობა და განიხილეთ კლუბთან.'],RESPOND_OFFER:['Review the named group and its current offer.','განიხილეთ დასახელებული ჯგუფი და მიმდინარე შეთავაზება.'],COMPLETE_REQUIREMENTS:['Complete the remaining requirements with their named owners.','შეასრულეთ დარჩენილი მოთხოვნები დასახელებულ პასუხისმგებლებთან.'],WAITLIST:['Wait for a suitable place or update your preferences with the club.','დაელოდეთ შესაფერის ადგილს ან განაახლეთ სურვილები კლუბთან.'],ENROLLED:['Regular participation is confirmed for the agreed start date.','მუდმივი მონაწილეობა დადასტურებულია შეთანხმებული დაწყების თარიღით.'],CLOSED:['Review the recorded outcome; a new request remains separate.','განიხილეთ დაფიქსირებული შედეგი; ახალი მოთხოვნა ცალკე რჩება.']};
            const code=n.code==='WAIT_FOR_PLACE'?'WAITLIST':n.code==='ARRANGE_SESSION'?'RESPOND_SESSION':n.code;
            return labels[code]?copy(...labels[code]):n.label;
        },owner:(v:string)=>v==='PLATFORM'?copy('Appointed platform reviewer','პლატფორმის დანიშნული განმხილველი'):v==='APPLICANT'?copy('Player or guardian','მოთამაშე ან მეურვე'):v==='REGISTRATION_STAFF'?copy('Registration staff','რეგისტრაციის თანამშრომელი'):v==='NONE'?copy('No action due','ქმედება საჭირო არ არის'):copy('Club','კლუბი')};
}
