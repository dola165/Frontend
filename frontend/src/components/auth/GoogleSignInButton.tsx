import { useEffect, useRef, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';

/** Google draws its button between 200 and 400 pixels wide and ignores anything else, such as "100%". */
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

/**
 * "Continue with Google" at the width of its column (up to Google's 400px), centred. The light colour scheme
 * keeps the browser from painting a white box behind Google's frame on our dark pages.
 */
export function GoogleSignInButton({ onSuccess, onError }: { onSuccess: (response: CredentialResponse) => void; onError: () => void }) {
    const box = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState<number | null>(null);

    useEffect(() => {
        const element = box.current;
        if (!element) return;
        const measure = () => setWidth(Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, element.clientWidth))));
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={box} className="flex min-h-[44px] w-full justify-center [color-scheme:light]">
            {width !== null && <GoogleLogin key={width} theme="filled_black" size="large" width={width} text="continue_with" onSuccess={onSuccess} onError={onError} />}
        </div>
    );
}
