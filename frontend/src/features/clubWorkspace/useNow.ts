import { useEffect, useState } from 'react';

/** The current time for a page that shows "today" and "next", refreshed every minute while it stays open. */
export function useNow(intervalMs = 60_000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(timer);
    }, [intervalMs]);
    return now;
}
