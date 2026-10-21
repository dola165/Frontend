/**
 * Nobody chooses a role when they sign up: what a person does in football is chosen later, and what they may
 * open comes only from links someone else confirms. Sign-up sends no role (the account starts as a fan). Finishing
 * a profile after a Google sign-in still has to name one for the backend, so that step sends a fan.
 */
export const NEUTRAL_ONBOARDING_ROLE = 'FAN';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string) => EMAIL_PATTERN.test(value.trim());
