// Keep aligned with MediaService's byte and decoder-format limits.
export const SOCIAL_IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
export const SOCIAL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const supportedTypes = new Set(SOCIAL_IMAGE_ACCEPT.split(','));
const formatMessage = 'Choose a JPEG, PNG, GIF or WebP image. Videos are not supported.';
const sizeMessage = 'This photo is too large. Choose an image of 10 MB or smaller.';

export function validateSocialImage(file: File): string | null {
    if (!supportedTypes.has(file.type)) return formatMessage;
    if (file.size === 0) return 'This file is empty. Choose another photo.';
    if (file.size > SOCIAL_IMAGE_MAX_BYTES) return sizeMessage;
    return null;
}

export function socialImageUploadError(error: unknown): string {
    const response = (error as { response?: { status?: number; data?: { error?: string } } })?.response;
    const message = typeof response?.data?.error === 'string' ? response.data.error : '';
    if (response?.status === 413 || /10MB upload limit|upload size limit/.test(message)) return sizeMessage;
    if (response?.status === 429) return 'Image processing is busy. Wait a moment and try again.';
    if (/Only images|Unsupported image format/.test(message)) return formatMessage;
    if (/16 megapixels/.test(message)) return 'Resize this photo to at most 8192 pixels per side and 16 megapixels, then try again.';
    if (/Invalid.*image/.test(message)) return 'This photo could not be read. Export it as JPEG, PNG, GIF or WebP and choose it again.';
    if (/File cannot be empty/.test(message)) return 'This file is empty. Choose another photo.';
    return 'Photo upload failed. Your draft is still here—please try again.';
}
