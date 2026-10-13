/**
 * Nobody chooses a role when they sign up: what a person does in football is chosen later, and what they may
 * open comes only from links someone else confirms. The backend still expects a role at registration and
 * onboarding, so every new account is sent as a fan until the field is optional (ROUND_2.md, "Before release").
 */
export const NEUTRAL_REGISTRATION_ROLE = 'FAN';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** A phone number as people type it: digits with the usual spaces, brackets and dashes, with or without +. */
export const PHONE_PATTERN = /^\+?[\d\s()-]{9,20}$/;

export const isEmail = (value: string) => EMAIL_PATTERN.test(value.trim());
export const isPhone = (value: string) => !isEmail(value) && PHONE_PATTERN.test(value.trim()) && value.replace(/\D/g, '').length >= 9;
export const normalizePhone = (value: string) => value.trim().replace(/[\s()-]/g, '');
