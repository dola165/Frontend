import { useTranslation } from 'react-i18next';
const ka: Record<string, string> = {
  'Team': 'გუნდი', 'Loading team…': 'გუნდი იტვირთება…', 'Email': 'ელფოსტა', 'Responsibility': 'პასუხისმგებლობა',
  'Staff · organize tournaments': 'თანამშრომელი · ტურნირების ორგანიზება', 'Administrator · manage this organization': 'ადმინისტრატორი · ამ ორგანიზაციის მართვა',
  'Invite team member': 'გუნდის წევრის მოწვევა', 'Member': 'წევრი', 'Access': 'წვდომა', 'Active': 'აქტიური',
  'Remove access': 'წვდომის გაუქმება', 'Confirm removal': 'გაუქმების დადასტურება', 'Keep access': 'წვდომის დატოვება',
  'Remove {name}’s organization access?': 'გაუუქმდეს {name}-ს ორგანიზაციაზე წვდომა?', 'this member': 'ამ წევრს',
  'They will no longer be able to use this responsibility to manage the organization.': 'ამ პასუხისმგებლობით ორგანიზაციის მართვას ვეღარ შეძლებს.',
  'Invitations': 'მოწვევები', 'No invitations yet.': 'მოწვევები ჯერ არ არის.', 'Registered member': 'რეგისტრირებული წევრი',
  'Invite a registered team member using the form above. You choose their responsibility; access starts after they accept.': 'ზემოთ მოცემული ფორმით მოიწვიეთ რეგისტრირებული წევრი. აირჩიეთ პასუხისმგებლობა; წვდომა მიღების შემდეგ დაიწყება.',
  'Cancel invitation': 'მოწვევის გაუქმება', 'Retry': 'ხელახლა ცდა',
  'Could not load the team.': 'გუნდი ვერ ჩაიტვირთა.', 'Could not update the team.': 'გუნდის განახლება ვერ მოხერხდა.',
  'Invitation sent. They can respond in My organizations.': 'მოწვევა გაგზავნილია. პასუხი შეუძლიათ „ჩემ ორგანიზაციებში“.', 'Team access updated.': 'გუნდზე წვდომა განახლებულია.',
  'Organization invitations': 'ორგანიზაციის მოწვევები', 'Loading invitations…': 'მოწვევები იტვირთება…',
  'No pending invitations.': 'მომლოდინე მოწვევები არ არის.', 'Open workspace': 'სამუშაო სივრცის გახსნა',
  'Your response was saved. Check your current access below.': 'თქვენი პასუხი შენახულია. მიმდინარე წვდომა ქვემოთ შეამოწმეთ.',
  'My organizations': 'ჩემი ორგანიზაციები', 'Workspace access depends on your current responsibilities.': 'სამუშაო სივრცეზე წვდომა თქვენს მიმდინარე პასუხისმგებლობებზეა დამოკიდებული.',
  'Organization access has ended. Ask the current leadership for a new invitation.': 'ორგანიზაციაზე წვდომა დასრულებულია. ახალი მოწვევისთვის მიმართეთ მიმდინარე ხელმძღვანელობას.',
  'Invitation {status}.': 'მოწვევა: {status}.', 'Invited as {role}': 'მოწვეული ხართ: {role}',
  'Invitation role: {role}': 'მოწვევის როლი: {role}',
  'Accept responsibility': 'პასუხისმგებლობის მიღება', 'Decline': 'უარი',
  'This invitation no longer grants access. Contact the organization’s leadership for a new invitation.': 'ეს მოწვევა წვდომას აღარ იძლევა. ახალი მოწვევისთვის მიმართეთ ორგანიზაციის ხელმძღვანელობას.',
  'This invitation is unavailable.': 'ეს მოწვევა მიუწვდომელია.', 'Could not respond to this invitation.': 'მოწვევაზე პასუხის გაგზავნა ვერ მოხერხდა.',
  'Some invitations could not be loaded. Retry to check for pending invitations.': 'ზოგი მოწვევა ვერ ჩაიტვირთა. ხელახლა სცადეთ მომლოდინე მოწვევების შესამოწმებლად.',
  'Invitation accepted. Reload to refresh your navigation.': 'მოწვევა მიღებულია. ნავიგაციის გასაახლებლად განაახლეთ გვერდი.',
  'admin': 'ადმინისტრატორი', 'staff': 'თანამშრომელი', 'venue operator': 'ობიექტის ოპერატორი', 'owner': 'მფლობელი',
  'pending': 'მოლოდინში', 'accepted': 'მიღებულია', 'declined': 'უარყოფილია', 'cancelled': 'გაუქმებულია', 'expired': 'ვადაგასულია',
  'Manage your organization team': 'ორგანიზაციის გუნდის მართვა',
};
export function useInvitationCopy() {
  const { i18n } = useTranslation();
  return (text: string, vars?: Record<string, string | number>) => {
    const translated = i18n.language?.startsWith('ka') ? ka[text] ?? text : text;
    return translated.replace(/\{(\w+)\}/g, (match, name: string) => vars?.[name] === undefined ? match : String(vars[name]));
  };
}
