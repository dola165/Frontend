import type { AdmissionCase, AdmissionInquiry, Opportunity, GroupInput, Choice, NextAction } from '../admissions/types';

export const JOINING_CONTRACT_REVISION = 'joining-1.2.0' as const;
export const PLAYER_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF'] as const;
export type PlayerIdentity = {
  playerId: number; version: number; fullName: string; dateOfBirth: string | null;
  gender: 'MALE' | 'FEMALE' | null; photoUrl: string | null; positions: string[];
  dominantFoot: 'LEFT' | 'RIGHT' | 'BOTH' | null; heightCm: number | null; weightKg: number | null;
  canEdit: boolean; minor: boolean;
};
export type PlayerIdentityInput = Omit<PlayerIdentity, 'playerId' | 'version' | 'canEdit' | 'minor'> & {
  requestId: string; expectedVersion: number;
};
export type ChildClub = { clubId: number; clubName: string; cardId: number | null; affiliationStatus: string | null; consentStatus: string | null; squadNames: string[] };
export type JoiningChild = { playerId: number; identity: PlayerIdentity; clubs: ChildClub[]; cases: AdmissionCase[]; inquiries: ConnectedInquiry[] };
export type ChildDirectory = { children: JoiningChild[] };
export type JoiningOption = { squadId: number | null; squadName: string; programmeIds: number[]; opportunity: Opportunity | null; availability: 'AVAILABLE' | 'WAITLIST' | 'CLOSED' | 'ENQUIRY_ONLY'; destination: string | null };
export type ClubJoiningOptions = { clubId: number; organizationId: number; options: JoiningOption[] };
export type EnquiryInput = { requestId: string; playerId?: number | null; groupId?: number | null; programmeId?: number | null; squadId?: number | null; contactId?: number | null; preferredFacilityId?: number | null; message: string };
export type InquiryContinuation = { applicant: boolean; staff: boolean; destination: string };
export type InquirySetupCapability = { canConfigure: boolean; canRequest: boolean; destination: string | null; requested: boolean };
export type ConnectedInquiry = Omit<AdmissionInquiry, 'playerId' | 'playerName' | 'actions' | 'status'> & {
  playerId: number | null; playerName: string | null;
  status: 'OPEN' | 'RESOLVED' | 'ROUTED' | 'DECLINED' | 'WITHDRAWN';
  actions: Array<'MESSAGE' | 'WITHDRAW' | 'DECLINE' | 'ROUTE' | 'ASSOCIATE_PLAYER' | 'RESOLVE' | 'REOPEN' | 'REQUEST_SETUP'>;
  conversationId: number | null; groupId: number | null; programmeId: number | null; squadId: number | null;
  applicantDestination: string; staffDestination: string; conversationDestination: string | null;
  continuation: InquiryContinuation; nextAction: NextAction; setup: InquirySetupCapability;
};
export type ConnectedInquiryCommand = { requestId: string; expectedVersion: number; action: ConnectedInquiry['actions'][number]; message?: string; playerId?: number | null; groupId?: number | null; groupVersion?: number | null };
export type CreateLinkCode = { requestId: string; clubId?: number | null };
export type LinkCode = { id: number; code: string; expiresAt: string; clubId: number | null };
export type LinkCodePreview = { playerId: number; playerName: string; expiresAt: string; clubId: number; existingCaseId: number | null; existingInquiryId: number | null; status: 'READY' | 'ALREADY_LINKED'; options: Opportunity[] };
export type RedeemLinkCode = { requestId: string; code: string; groupId?: number | null; groupVersion?: number | null };
export type LinkCodeResult = { status: 'LINKED' | 'RESUMED' | 'ALREADY_LINKED'; playerId: number; caseId: number | null; inquiryId: number | null; staffDestination: string; applicantDestination: string; conversationId: number | null; conversationDestination: string | null };
export type JoiningSetupKnown = {
  name: string | null; category: string | null; gender: string | null; headCoachId: number | null;
  ageMin: number | null; ageMax: number | null; sessionsPerWeek: number | null;
  priceType: string | null; amount: number | null; currency: string | null; billingPeriod: string | null;
  trialAmount: number | null; joiningFee: number | null; equipmentFee: number | null; details: string | null;
};
export type JoiningSetup = {
  inquiryId: number; inquiryVersion: number; organizationId: number; clubId: number | null;
  programmeId: number | null; squadId: number | null; programmeName: string | null; squadName: string | null;
  known: JoiningSetupKnown; reviewRequired: string[]; existingGroups: Opportunity[]; staff: Choice[];
  canConfigure: boolean; canRequest: boolean; requested: boolean; returnDestination: string;
};
export type JoiningSetupInput = { requestId: string; expectedVersion: number; group: GroupInput };
export type JoiningProblem = { code: string; message: string; currentVersion?: number };
