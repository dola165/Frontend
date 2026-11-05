/** True when the web build has Google's client ID; without it "Continue with Google" is hidden rather than broken. */
export const googleSignInConfigured = () => Boolean((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim());
