import type { AuthSessionId } from '../../../utils/authStorage';

// An enquiry remains the same task when setup creates or associates a group.
export const joiningSetupScope = (session: AuthSessionId, organizationId: number, inquiryId: number) =>
    `joining-setup:${session}:${organizationId}:${inquiryId}`;
export const joiningSetupDraftKey = (session: AuthSessionId, organizationId: number, inquiryId: number) =>
    `gk-joining-setup-draft:${session}:${organizationId}:${inquiryId}`;
