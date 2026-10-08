import { useTranslation } from 'react-i18next';

const strings = {
    incomingRepresentation: ['Representation requests', 'წარმომადგენლობის მოთხოვნები'],
    incomingRepresentationDetail: ['Players waiting for your decision. Open each proposal to accept or decline.', 'მოთამაშეები თქვენს გადაწყვეტილებას ელოდებიან. გახსენით შეთავაზება და დაეთანხმეთ ან უარყავით.'],
    overview: ['Overview', 'მიმოხილვა'],
    enquiries: ['Enquiries', 'დაინტერესებები'],
    portfolio: ['Portfolio', 'პორტფელი'],
    relationships: ['Club relationships', 'კლუბებთან ურთიერთობები'],
    agentHub: ['Agent Hub', 'აგენტის სივრცე'],
    loadingHub: ['Loading Agent Hub…', 'აგენტის სივრცე იტვირთება…'],
    verifiedAgent: ['Verified agent', 'ვერიფიცირებული აგენტი'],
    privateWorkspace: ['Private workspace', 'პირადი სამუშაო სივრცე'],
    licence: ['Licence {value}', 'ლიცენზია {value}'],
    signedInAs: ['Signed in as @{value}', 'შესული ხართ როგორც @{value}'],
    mobileSubtitle: ['Your private enquiries and relationships', 'თქვენი პირადი დაინტერესებები და ურთიერთობები'],
    hubLoadError: ['Your agent hub could not load. No private club data was used. Please try again.', 'აგენტის სივრცე ვერ ჩაიტვირთა. კლუბის პირადი მონაცემები არ გამოყენებულა. სცადეთ თავიდან.'],
    errorTitle: ['Something went wrong', 'რაღაც ვერ შესრულდა'],
    retry: ['Retry', 'თავიდან ცდა'],
    attentionCount: ['{count} item{suffix} need attention', 'ყურადღებას საჭიროებს {count} საკითხი'],
    nextActionsClear: ['Your next actions are clear', 'შემდეგი ნაბიჯები განსაზღვრულია'],
    overviewDescription: ['Private enquiries, representation consent, and club decisions are kept separate so each person knows who must act.', 'პირადი დაინტერესებები, წარმომადგენლობაზე თანხმობა და კლუბის გადაწყვეტილებები განცალკევებულია, რათა პასუხისმგებელი პირი ნათელი იყოს.'],
    newEnquiries: ['New enquiries', 'ახალი დაინტერესებები'],
    newEnquiriesDetail: ['Review club interest and continue through a private conversation.', 'გაეცანით კლუბის ინტერესს და გააგრძელეთ პირად საუბარში.'],
    representationConsent: ['Representation consent', 'წარმომადგენლობაზე თანხმობა'],
    representationConsentDetail: ['The player or responsible guardian must resolve required consent separately. Youth identity remains protected in this hub.', 'საჭირო თანხმობა მოთამაშემ ან პასუხისმგებელმა მეურვემ ცალკე უნდა მოაგვაროს. ამ სივრცეში არასრულწლოვნის ვინაობა კვლავ დაცულია.'],
    clubDecisionsPending: ['Approaches awaiting a decision', 'მიმართვები გადაწყვეტილების მოლოდინშია'],
    clubDecisionsDetail: ['Review approaches waiting for player approval or a club response.', 'იხილეთ მიმართვები, რომლებიც მოთამაშის თანხმობას ან კლუბის პასუხს ელოდება.'],
    open: ['Open', 'გახსნა'],
    currentRepresentationRecords: ['Current representation records', 'მიმდინარე წარმომადგენლობები'],
    representationRecordsDetail: ['Declined and ended records are not projected as current portfolio data.', 'უარყოფილი და დასრულებული ჩანაწერები მიმდინარე პორტფელში არ ჩანს.'],
    activeClubRelationships: ['Active club relationships', 'აქტიური ურთიერთობები კლუბებთან'],
    activeRelationshipDetail: ['A relationship does not grant club workspace or club inbox access.', 'ურთიერთობა კლუბის სამუშაო სივრცეზე ან პირად შემოსულებზე წვდომას არ იძლევა.'],
    privateRepresentation: ['Private representation', 'პირადი წარმომადგენლობა'],
    playerPortfolio: ['Player portfolio', 'მოთამაშეთა პორტფელი'],
    portfolioDescription: ['Representation authority is separate from public listing consent. Public marketplace tools remain unavailable.', 'წარმომადგენლობის უფლებამოსილება საჯარო განცხადებაზე თანხმობისგან განცალკევებულია. საჯარო ბაზრის ხელსაწყოები კვლავ მიუწვდომელია.'],
    noActiveRepresentations: ['No active representations', 'აქტიური წარმომადგენლობა არ არის'],
    noActiveRepresentationsDetail: ['Your active player connections will appear here. Use the form above to send a proposal; representation starts after the required consent is complete.', 'მოთამაშეებთან თქვენი აქტიური კავშირები აქ გამოჩნდება. შეთავაზების გასაგზავნად გამოიყენეთ ზემოთ მოცემული ფორმა; წარმომადგენლობა საჭირო თანხმობის მიღების შემდეგ იწყება.'],
    consentPending: ['Consent pending', 'თანხმობა მოლოდინშია'],
    consentPendingDetail: ['The player must accept this representation before it can be used for listing decisions.', 'განცხადებასთან დაკავშირებულ გადაწყვეტილებამდე მოთამაშემ წარმომადგენლობა უნდა დაადასტუროს.'],
    consentConfirmed: ['Consent confirmed', 'თანხმობა დადასტურებულია'],
    consentConfirmedProtected: ['Consent is recorded, but youth identity remains protected in this bounded hub.', 'თანხმობა დაფიქსირებულია, თუმცა არასრულწლოვნის ვინაობა ამ შეზღუდულ სივრცეში დაცულია.'],
    consentConfirmedDetail: ['Representation consent is complete. Marketplace listing tools are not available in this release.', 'წარმომადგენლობაზე თანხმობა დასრულებულია. ამ ვერსიაში ბაზრის განცხადებების ხელსაწყოები მიუწვდომელია.'],
    consentNotConfirmed: ['Consent not confirmed', 'თანხმობა დადასტურებული არ არის'],
    consentNotConfirmedDetail: ['No player details are shown here. The player or responsible guardian must resolve the required consent separately.', 'მოთამაშის დეტალები აქ არ ჩანს. საჭირო თანხმობა მოთამაშემ ან პასუხისმგებელმა მეურვემ ცალკე უნდა მოაგვაროს.'],
    representationActive: ['Representation active', 'წარმომადგენლობა აქტიურია'],
    representationActiveDetail: ['This private representation is active. Marketplace listing tools are not available in this release.', 'პირადი წარმომადგენლობა აქტიურია. ამ ვერსიაში ბაზრის განცხადებების ხელსაწყოები მიუწვდომელია.'],
    protectedRequest: ['Protected representation request', 'დაცული წარმომადგენლობის მოთხოვნა'],
    protectedRequestDetail: ['Identity and club details are withheld under the current privacy boundary.', 'ვინაობისა და კლუბის დეტალები მოქმედი კონფიდენციალურობის წესებით დაფარულია.'],
    position: ['Position', 'პოზიცია'],
    noCurrentClub: ['No current club', 'მიმდინარე კლუბი არ არის'],
    notProvided: ['Not provided', 'მითითებული არ არის'],
    authority: ['Authority', 'უფლებამოსილება'],
    started: ['Started', 'დაწყება'],
    privateEnquiries: ['Private enquiries', 'პირადი დაინტერესებები'],
    agentInbox: ['Agent inbox', 'აგენტის შემოსული'],
    inboxDescription: ['Enquiries sent to listings you owned appear here. Club-private inbox data is never used.', 'აქ ჩანს თქვენს განცხადებებზე გამოგზავნილი დაინტერესებები. კლუბის პირადი შემოსულის მონაცემები არ გამოიყენება.'],
    noEnquiries: ['No enquiries yet', 'დაინტერესებები ჯერ არ არის'],
    noEnquiriesDetail: ['New agent-owned enquiries will appear here. The marketplace itself remains unavailable in this release.', 'აგენტის ახალი დაინტერესებები აქ გამოჩნდება. ბაზარი ამ ვერსიაში კვლავ მიუწვდომელია.'],
    newEnquiry: ['New enquiry', 'ახალი დაინტერესება'],
    viewed: ['Viewed', 'ნანახია'],
    contacted: ['Contacted', 'კონტაქტი შედგა'],
    closed: ['Closed', 'დახურულია'],
    clubContact: ['Club contact', 'კლუბის საკონტაქტო პირი'],
    protectedMessage: ['Message content is hidden because the listing is closed, expired, or no longer has current player consent.', 'შეტყობინება დამალულია, რადგან განცხადება დახურულია, ვადაგასულია ან მოთამაშის მოქმედი თანხმობა აღარ აქვს.'],
    noMessage: ['No message was included with this enquiry.', 'ამ დაინტერესებას შეტყობინება არ ახლავს.'],
    enquiryPrivacy: ['Player and family details are not disclosed through this enquiry.', 'ამ დაინტერესების მეშვეობით მოთამაშისა და ოჯახის დეტალები არ გამჟღავნდება.'],
    messageContact: ['Message contact', 'კონტაქტისთვის მიწერა'],
    noMessageDestination: ['No message destination is available.', 'შეტყობინების მისამართი მიუწვდომელია.'],
    relationshipHistory: ['Relationship history', 'ურთიერთობების ისტორია'],
    relationshipsDescription: ['Earlier club relationships remain here as recorded history. Use player–club approaches above for new consented contact.', 'ადრინდელი კლუბის ურთიერთობები აქ ინახება ისტორიის სახით. ახალი თანხმობითი კონტაქტისთვის გამოიყენეთ ზემოთ მოთამაშე–კლუბის მიმართვები.'],
    noRelationships: ['No club relationships', 'კლუბებთან ურთიერთობები არ არის'],
    noRelationshipsDetail: ['Earlier club relationships will appear here. For new contact about a player, use the player–club approaches section above.', 'კლუბებთან წინა ურთიერთობები აქ გამოჩნდება. მოთამაშის შესახებ ახალი კონტაქტისთვის გამოიყენეთ ზემოთ მოცემული მოთამაშე–კლუბის მიმართვების სექცია.'],
    awaitingClub: ['Awaiting club decision', 'კლუბის გადაწყვეტილების მოლოდინში'],
    awaitingClubDetail: ['The club must accept or decline this request. Agent-side withdrawal is not available yet.', 'კლუბმა მოთხოვნა უნდა მიიღოს ან უარყოს. აგენტის მხრიდან გამოთხოვა ჯერ მიუწვდომელია.'],
    activeRelationship: ['Active relationship', 'აქტიური ურთიერთობა'],
    activeRelationshipStateDetail: ['This club relationship is active. Ending it requires a preserved history and notifications, which are not available here yet.', 'კლუბთან ურთიერთობა აქტიურია. მისი დასრულება მოითხოვს ისტორიისა და შეტყობინებების შენარჩუნებას, რაც აქ ჯერ მიუწვდომელია.'],
    declinedByClub: ['Declined by club', 'კლუბმა უარყო'],
    declinedByClubDetail: ['The club declined this request. The record remains visible as history.', 'კლუბმა მოთხოვნა უარყო. ჩანაწერი ისტორიაში რჩება.'],
    cancelled: ['Cancelled', 'გაუქმებულია'],
    cancelledDetail: ['This request was cancelled and is retained as relationship history.', 'მოთხოვნა გაუქმებულია და ურთიერთობის ისტორიაში ინახება.'],
    relationshipEnded: ['Relationship ended', 'ურთიერთობა დასრულებულია'],
    relationshipEndedDetail: ['This relationship has ended. Its previous state is retained as history.', 'ურთიერთობა დასრულებულია. წინა მდგომარეობა ისტორიაში ინახება.'],
    requestedDate: ['Requested {date}', 'მოთხოვნილია {date}'],
    clubResponse: ['Club response:', 'კლუბის პასუხი:'],
    originalNote: ['Original note:', 'საწყისი შენიშვნა:'],
    activeRelationshipPrivacy: ["This relationship does not grant access to the club's private workspace or inbox.", 'ეს ურთიერთობა კლუბის პირად სამუშაო სივრცეზე ან შემოსულებზე წვდომას არ იძლევა.']
} as const;

export type AgentCopyKey = keyof typeof strings;

const fill = (template: string, values?: Record<string, string | number>) =>
    Object.entries(values ?? {}).reduce((value, [key, replacement]) =>
        value.replaceAll(`{${key}}`, String(replacement)), template);

export function useAgentCopy() {
    const { i18n } = useTranslation();
    const language = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka') ? 'ka' : 'en';
    const index = language === 'ka' ? 1 : 0;
    return {
        language,
        copy: (key: AgentCopyKey, values?: Record<string, string | number>) => fill(strings[key][index], values),
        date: (value: string) => new Intl.DateTimeFormat(language === 'ka' ? 'ka-GE' : 'en-GB', {
            dateStyle: 'medium'
        }).format(new Date(value))
    };
}
