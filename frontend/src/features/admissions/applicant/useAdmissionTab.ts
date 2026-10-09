import { useSearchParams } from 'react-router-dom';
export function useAdmissionTab(ids: readonly string[], fallback = 'overview') {
    const [params] = useSearchParams();
    const requested = params.get('tab') ?? fallback;
    return ids.includes(requested) ? requested : fallback;
}
