export const registrationRoles = ['PLAYER', 'COACH', 'REFEREE', 'AGENT', 'PARENT', 'ORGANIZER', 'VENUE_MANAGER', 'FAN'] as const;

export type RegistrationRole = typeof registrationRoles[number];

export const isRegistrationRole = (role: string | null | undefined): role is RegistrationRole =>
    registrationRoles.some((option) => option === role);
