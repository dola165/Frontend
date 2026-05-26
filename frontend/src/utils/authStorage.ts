const ACCESS_TOKEN_KEY = 'accessToken';
const USER_ID_KEY = 'userId';
const USER_KEY = 'user';

export const getStoredAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);

export const hasStoredAccessToken = () => Boolean(getStoredAccessToken());

export const setStoredAccessToken = (token: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
};

export const getStoredUserId = () => localStorage.getItem(USER_ID_KEY);

export const setStoredUserId = (userId: number | string) => {
    localStorage.setItem(USER_ID_KEY, String(userId));
};

export const setStoredUser = (user: unknown) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearStoredAuth = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_KEY);
};
