export const registrationRoles = ['PLAYER', 'PARENT', 'ORGANIZER', 'FAN'] as const;

export type RegistrationRole = typeof registrationRoles[number];

export const isRegistrationRole = (role: string | null | undefined): role is RegistrationRole =>
    registrationRoles.some((option) => option === role);
