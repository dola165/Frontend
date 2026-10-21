/** Temporary launch switch. Production builds default to real browsing only. */
export const paymentPreviewEnabled = () =>
    import.meta.env.VITE_PAYMENT_PREVIEW === 'true' ||
    (import.meta.env.DEV && import.meta.env.VITE_PAYMENT_PREVIEW !== 'false');
