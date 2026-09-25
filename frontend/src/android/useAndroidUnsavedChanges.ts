import { useEffect } from 'react';
import { isAndroidApp } from './bridge';

/** Native Back and tab changes ask before destroying an open editor. */
export function useAndroidUnsavedChanges(dirty: boolean) {
    useEffect(() => {
        if (!isAndroidApp || !dirty) return;
        const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [dirty]);
}
