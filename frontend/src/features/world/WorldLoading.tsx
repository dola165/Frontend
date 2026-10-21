import { Skeleton } from '../../design/primitives';
import { useWorldCopy } from './copy';

/** A World page while its code or the person's context loads. */
export function WorldLoading() {
    const t = useWorldCopy();
    return (
        <div className="gk-world-loading" role="status" aria-label={t('Loading')}>
            <Skeleton height={34} width="32%" /><Skeleton height={44} /><Skeleton height={220} />
        </div>
    );
}
