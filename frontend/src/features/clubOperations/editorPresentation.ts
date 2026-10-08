import { label, type Field, type Definition, type Bootstrap } from './api';

const explanations: Record<string,string> = {
  FACILITY:'Add a playing venue or a supporting facility. Save a draft, then publish its visitor information. Rental bookings are managed separately by the venue operator.',
  EMERGENCY_PLAN:'Record how help reaches this ground, where equipment is kept and who takes responsibility.',
  COMPETITION_REQUIREMENTS:'Keep the organiser’s requirements together so match preparation can refer to them.',
  MATCH_PREPARATION:'Record the arrangements for a particular match and link the relevant emergency plan.',
  DUTY:'Assign a staff member to a time, place and responsibility.', STAFF_AVAILABILITY:'Record when a staff member is available or away so duties can be planned around it.',
  CREDENTIAL:'Record the qualification and its evidence. Saving does not verify or accredit it.',
  CONSENT:'Write the exact permission being requested. The confirmed guardian makes the decision.', COLLECTION:'Record who may collect the child and ask the confirmed guardian to approve it.',
  EMERGENCY_CONTACT:'Record who should be called and in what order.', ATTENDANCE:'Record attendance and collection for one event or training session.',
  CONCERN:'Record the concern and action taken. Access follows the club’s welfare permissions.', MEDICAL_APPOINTMENT:'Arrange the appointment and record who is responsible. Access follows medical permissions.',
  CLINICAL_NOTE:'Record the clinical details and review date in the restricted medical record.', RESTRICTION:'Share the participation limits coaches need, keeping clinical details in the medical record.',
  GOAL:'Agree what the player is working towards and how progress will be assessed.', OBSERVATION:'Record what you observed and useful next steps for the player.', REVIEW:'Plan the review and record the player’s feedback and agreed outcome.',
  EDUCATION_ABSENCE:'Record school commitments that affect availability.', EDUCATION_CONTACT:'Record the school contact and the purpose for which they may be contacted.',
  REGISTRATION:'Track the registering body’s requirements, outstanding items and approval evidence.',
  ASSET:'Add equipment to the club inventory, including quantity and condition.', EQUIPMENT_ISSUE:'Record equipment allocated to a person or squad.', MAINTENANCE:'Plan maintenance for an existing item of club equipment.',
  PURCHASE:'Prepare a purchase request for review. Saving does not transfer money.', REIMBURSEMENT:'Record an expense for review and reimbursement. Saving does not transfer money.',
  BUDGET:'Record the agreed budget for this scope and period.', INSTALMENT:'Track an amount due from a member. Payment recording is manual.', FINANCIAL_SUPPORT:'Record the agreed discount or scholarship and its validity.',
  TRIP:'Plan the journey, transport and responsible staff.', PASSENGER:'Check a passenger’s permission and arrangements for an existing trip.',
  ENGAGEMENT:'Record an external specialist’s work, dates and agreed terms.', DEPARTURE:'Track the actions needed when a player leaves the club.',
};
export const editorDescription = (d:Definition) => explanations[d.kind] ?? `Record the ${d.label.toLowerCase()} details, assign responsibility and check before saving.`;
const help: Record<string,string> = {
  address:'Use the address visitors should travel to, rather than the club’s postal address.',
  placeType:'Venues host matches or football training. Facilities support the club: gyms, changing rooms, medical rooms, offices and clubhouses. Neither classification enables rentals.',
  relationship:'Describe how the club uses this place. This does not register ownership or make a booking.',
  description:'A short public description, such as which pitches or training activities are here.',
  amenities:'List facilities that are actually available, such as changing rooms, toilets and spectator seating.',
  accessibility:'Explain step-free access, accessible toilets or any assistance visitors should arrange.',
  arrival:'Describe the correct gate, entrance and meeting point.', transport:'Useful parking, bus or walking information.',
  collection:'Where to wait and how collection is arranged. Do not include private information about a child.',
  contact:'Only include contact details that may appear on the public facility page.',
  whatToBring:'Practical items visitors should bring. Leave empty if no special preparation is needed.',
  evidence:'Name the document or source. Supporting PDFs and images can be attached privately after the record is saved.',
  reference:'The reference printed on the qualification or document, if one exists.',
  externalReference:'The registration number issued by the external body, if available.',
  approvalReference:'Identify the approval or decision. Attach its supporting document after saving.',
  clearanceReference:'Identify the professional clearance. Keep medical details in the restricted medical record.',
  requirementsReference:'Select the competition requirements this preparation follows.',
  permissionReference:'Select the recorded guardian permission for these arrangements.', collectionReference:'Select the recorded collection authorisation; do not type an internal ID.',
  version:'Give this wording a short version, such as “Season 2026”. A changed request needs fresh guardian consent.',
  priority:'1 is the first person to call, 2 is the next, and so on.',
  currency:'Currency used for every amount on this record.', dueOn:'Optional reminder for the next action or review; this is not an event time.',
  startsAt:'Shown in your current local timezone.', endsAt:'Must be after the start time.',
};
export const fieldHelp = (kind:string,key:string) => key==='description' && kind!=='FACILITY' ? 'Describe what happened and relevant facts. Access follows the permissions for this record.' : key==='contact' && kind!=='FACILITY' ? 'Contact details needed for this record.' : help[key];
export const fieldLabel = (f:Field) => ({photos:'Photos',venueId:'Existing venue',collectionReference:'Collection authorisation',permissionReference:'Guardian permission',requirementsReference:'Competition requirements'} as Record<string,string>)[f.key] ?? f.label;
const groups = [
  {title:'Dates & times', description:'When this applies and when it needs to be reviewed.', keys:['startsAt','endsAt','startsOn','endsOn','issuedOn','expiresOn','reviewOn','reviewedOn','checkedOn','departureAt','returnAt']},
  {title:'Amounts & terms',description:'Record the agreed amounts and currency.',keys:['amount','currency','payee','cost','budget','discount','period']},
  {title:'References & evidence',description:'Connect the supporting records. Private documents can be attached after saving.',keys:['evidence','reference','clearanceReference','externalReference','approvalReference','requirementsReference','permissionReference','collectionReference']},
  {title:'Notes & follow-up',description:'Additional information for the people working on this record.',keys:['notes','reviewNotes','nextSteps','followUp','resolution','feedback','outcome','progress','issues','instructions','cover']},
];
export function fieldGroups(d:Definition) {
  const special = new Set(groups.flatMap(g=>g.keys));
  return [{title:'Main details',description:editorDescription(d),fields:d.fields.filter(f=>!special.has(f.key))}, ...groups.map(g=>({...g,fields:d.fields.filter(f=>g.keys.includes(f.key))}))].filter(g=>g.fields.length);
}
export function reviewValue(f:Field,value:string,boot:Bootstrap) {
  if(f.type==='urls') { const count=value.split(/\r?\n/).filter(Boolean).length;return `${count} ${count===1?'photo':'photos'}`; }
  if(f.key==='venueId') return boot.venues.find(v=>String(v.id)===value)?.name ?? 'Previously linked venue';
  if(['collectionReference','permissionReference','requirementsReference'].includes(f.key)) return boot.links.find(v=>String(v.id)===value)?.title ?? 'Previously linked record';
  if(f.type==='choice') return label(value);
  if(f.type==='datetime') return new Date(value).toLocaleString();
  return value;
}
