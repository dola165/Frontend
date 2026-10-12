import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { Button } from '../../../../design/primitives';
import { useAuth } from '../../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../../utils/authRedirect';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { setTournamentHostFollow } from '../../../tournaments/api';
import type { TournamentHost } from '../../../tournaments/domain';
import { forget } from '../../cache';
import { useWorldCopy } from '../../copy';

/** Follow a tournament's organiser (their new tournaments reach Home); a guest is asked to sign in first. */
export function FollowHost({ host }: { host: TournamentHost }) {
    const t = useWorldCopy();
    const { status } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [following, setFollowing] = useState(host.following);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const follow = async () => {
        if (status !== 'authenticated') return navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
        setBusy(true);
        try {
            setFollowing((await setTournamentHostFollow(host.kind, host.id, !following)).following);
            setError('');
            forget(`tournament-host:${host.kind}:${host.id}`);
        } catch (cause) { setError(extractApiErrorMessage(cause, t('Following could not be updated.'))); }
        finally { setBusy(false); }
    };
    return <>
        <Button size="sm" aria-pressed={following} disabled={busy} onClick={follow}>
            {following ? <><Check aria-hidden="true" />{t('Following')}</> : <><Plus aria-hidden="true" />{t('Follow')}</>}
        </Button>
        {error && <span role="alert" className="gk-result-error">{error}</span>}
    </>;
}
