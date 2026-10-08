const en = {
    title: 'Organization activities', settings: 'Activities & venue team', venue: 'Accept new venue reservations',
    tournament: 'Create new tournaments', profile: 'Organization profile', always: 'Available',
    help: 'Pausing new activity keeps existing reservations, tournament duties and history available to the authorized team.',
    save: 'Save activities', saving: 'Saving…', saved: 'Activities saved.', loading: 'Loading…', retry: 'Reload',
    conflict: 'This changed while you were working. Reload to review the current state before trying again.',
    denied: 'Access has changed or your account needs attention. Reload after checking your account.',
    invalid: 'Check the details. Invitations require the email of a registered, verified adult with completed account setup.',
    failed: 'Could not complete this request. Your inputs have been kept.',
    operators: 'Venue operators', operatorHelp: 'Operators handle bookings and closures. Profile, pitch settings and tournament authority stay with the existing team.',
    email: 'Operator’s registered email', invite: 'Invite venue operator', invited: 'Invitation created. The recipient can respond in My organizations.',
    noOperators: 'No venue operators or invitations yet.', revoke: 'Revoke access', revokeConfirm: 'Confirm revocation',
    revokeHelp: 'This ends venue access immediately. Existing bookings and membership history remain.', cancel: 'Cancel', cancelInvite: 'Cancel invitation',
    revoked: 'Venue access revoked.', cancelled: 'Invitation cancelled.', inbox: 'Organization invitations',
    noInvitations: 'No organization invitations yet.', accept: 'Accept venue role', decline: 'Decline',
    responded: 'Response saved.', open: 'Open venue workspace', unknown: 'Organization member',
    paused: 'New reservations are paused. Existing reservations and closures remain available.',
    closure: 'Add closure', bookingOrClosure: 'Add booking or closure', close: 'Close form',
    venueWorkspace: 'Venue workspace', createTournament: 'Create a tournament', club: 'Club workspace', viewVenue: 'View venue',
    pending: 'Pending', accepted: 'Accepted', declined: 'Declined', expired: 'Expired', cancelledStatus: 'Cancelled', active: 'Active', ended: 'Access ended',
    unavailableInvite: 'This invitation can no longer be accepted. Contact the current owner.',
};
const ka: typeof en = {
    title: 'ორგანიზაციის საქმიანობა', settings: 'საქმიანობა და ობიექტის გუნდი', venue: 'ახალი ჯავშნების მიღება',
    tournament: 'ახალი ტურნირების შექმნა', profile: 'ორგანიზაციის პროფილი', always: 'ხელმისაწვდომია',
    help: 'ახალი საქმიანობის შეჩერებისას არსებული ჯავშნები, ტურნირების მოვალეობები და ისტორია უფლებამოსილი გუნდისთვის ხელმისაწვდომი რჩება.',
    save: 'საქმიანობის შენახვა', saving: 'ინახება…', saved: 'საქმიანობა შენახულია.', loading: 'იტვირთება…', retry: 'განახლება',
    conflict: 'მუშაობისას მონაცემები შეიცვალა. ხელახლა ცდამდე განაახლეთ და გადახედეთ მიმდინარე მდგომარეობას.',
    denied: 'წვდომა შეიცვალა ან ანგარიში ყურადღებას საჭიროებს. ანგარიშის შემოწმების შემდეგ განაახლეთ.',
    invalid: 'შეამოწმეთ მონაცემები. მოწვევისთვის საჭიროა სრულად შევსებული, დადასტურებული სრულწლოვანი ანგარიშის ელფოსტა.',
    failed: 'მოთხოვნა ვერ შესრულდა. შევსებული მონაცემები შენახულია.',
    operators: 'ობიექტის ოპერატორები', operatorHelp: 'ოპერატორები მართავენ ჯავშნებსა და დახურვებს. პროფილის, მოედნებისა და ტურნირების უფლებები არსებულ გუნდს რჩება.',
    email: 'ოპერატორის რეგისტრირებული ელფოსტა', invite: 'ოპერატორის მოწვევა', invited: 'მოწვევა შექმნილია. მიმღებს პასუხი შეუძლია „ჩემს ორგანიზაციებში“.',
    noOperators: 'ოპერატორები ან მოწვევები ჯერ არ არის.', revoke: 'წვდომის გაუქმება', revokeConfirm: 'გაუქმების დადასტურება',
    revokeHelp: 'ობიექტზე წვდომა დაუყოვნებლივ დასრულდება. არსებული ჯავშნები და წევრობის ისტორია შენარჩუნდება.', cancel: 'უკან', cancelInvite: 'მოწვევის გაუქმება',
    revoked: 'ობიექტზე წვდომა გაუქმებულია.', cancelled: 'მოწვევა გაუქმებულია.', inbox: 'ორგანიზაციის მოწვევები',
    noInvitations: 'ორგანიზაციის მოწვევები ჯერ არ არის.', accept: 'ოპერატორის როლის მიღება', decline: 'უარი',
    responded: 'პასუხი შენახულია.', open: 'ობიექტის სამუშაო სივრცის გახსნა', unknown: 'ორგანიზაციის წევრი',
    paused: 'ახალი ჯავშნები შეჩერებულია. არსებული ჯავშნები და დახურვები ხელმისაწვდომია.',
    closure: 'დახურვის დამატება', bookingOrClosure: 'ჯავშნის ან დახურვის დამატება', close: 'ფორმის დახურვა',
    venueWorkspace: 'ობიექტის სამუშაო სივრცე', createTournament: 'ტურნირის შექმნა', club: 'კლუბის სამუშაო სივრცე', viewVenue: 'ობიექტის ნახვა',
    pending: 'მოლოდინში', accepted: 'მიღებულია', declined: 'უარყოფილია', expired: 'ვადაგასულია', cancelledStatus: 'გაუქმებულია', active: 'აქტიური', ended: 'წვდომა დასრულებულია',
    unavailableInvite: 'ამ მოწვევის მიღება აღარ შეიძლება. დაუკავშირდით მიმდინარე მფლობელს.',
};
export const activityCopy = (language?: string) => language?.toLowerCase().startsWith('ka') ? ka : en;
export const activityStatus = (status: string, copy: typeof en) => ({ PENDING: copy.pending, ACCEPTED: copy.accepted,
    DECLINED: copy.declined, EXPIRED: copy.expired, CANCELLED: copy.cancelledStatus, ACTIVE: copy.active, ENDED: copy.ended }[status] ?? status);
export const activityError = (error: unknown, copy: typeof en) => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return status === 409 ? copy.conflict : [401, 403, 404].includes(status ?? 0) ? copy.denied : status === 400 ? copy.invalid : copy.failed;
};
