/** Cloudflare Turnstile's site key; blank turns the bot check off (the backend then needs no token either). */
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? '';
export const turnstileEnabled = TURNSTILE_SITE_KEY.length > 0;

/** The backend's bot-check refusals: the token was missing or rejected, or Cloudflare could not be reached. */
export const BOT_CHECK_CODES = ['BOT_CHECK_FAILED', 'BOT_CHECK_UNAVAILABLE'] as const;
