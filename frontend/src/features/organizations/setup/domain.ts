export const organizationTypes = [
  ['CLUB', 'Club or academy', 'Football teams, squads and club operations.'],
  ['COMPANY', 'Company', 'A business with the activities you choose.'],
  ['SPONSOR', 'Sponsor', 'Support football and organize competitions.'],
  ['SPORTS_ORG', 'Sports organization', 'A federation, association or sports body.'],
  ['MEDIA', 'Media organization', 'Football coverage, publishing and production.'],
  ['HEALTHCARE', 'Healthcare organization', 'Medical, rehabilitation or wellbeing services.'],
  ['PARTNER', 'Community or partner', 'A community group or football partner.'],
  ['OTHER', 'Other organization', 'Start with a profile and choose your activities.'],
] as const;
export type OrganizationType = typeof organizationTypes[number][0];
export const clubCategories = [
  ['PROFESSIONAL_CLUB', 'Professional club'], ['SEMI_PROFESSIONAL_CLUB', 'Semi-professional club'],
  ['PROFESSIONAL_ACADEMY', 'Professional academy'], ['PRIVATE_ACADEMY', 'Private academy'],
  ['SCHOOL_CLUB', 'School or educational team'], ['AMATEUR_CLUB', 'Amateur club'],
  ['COMMUNITY_CLUB', 'Grassroots or community club'], ['YOUTH_DEVELOPMENT', 'Youth development'], ['OTHER', 'Other football club'],
] as const;
export const typeLabel = (type: string) => organizationTypes.find(([key]) => key === type)?.[1] ?? 'Organization';
export interface SetupDraft {
  displayName: string; description: string; organizationType: OrganizationType; clubCategory: string;
  venueEnabled: boolean; tournamentEnabled: boolean; website: string; publicEmail: string;
  publicPhone: string; addressText: string; focus: string;
}
export interface CreatedOrganization { id: number; clubId: number | null; profilePath: string; workspacePath: string }
export interface ImportField { key: string; label: string; required?: boolean }
export const profileFields: ImportField[] = [
  { key: 'displayName', label: 'Name', required: true }, { key: 'description', label: 'About' },
  { key: 'website', label: 'Website' }, { key: 'publicEmail', label: 'Public email' },
  { key: 'publicPhone', label: 'Public phone' }, { key: 'addressText', label: 'Address' }, { key: 'focus', label: 'What we do' },
];
export const venueFields: ImportField[] = [
  { key: 'name', label: 'Venue name', required: true }, { key: 'city', label: 'City' },
  { key: 'address', label: 'Address' }, { key: 'relationship', label: 'OWNS or OPERATES', required: true },
  { key: 'website', label: 'Website' }, { key: 'email', label: 'Public email' }, { key: 'phone', label: 'Public phone' },
];
export const squadFields: ImportField[] = [
  { key: 'name', label: 'Squad name', required: true }, { key: 'category', label: 'Age group / category', required: true },
  { key: 'gender', label: 'MALE, FEMALE or MIXED', required: true },
];
