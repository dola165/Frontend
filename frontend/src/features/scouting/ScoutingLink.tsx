import type { ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';
import { ButtonLink } from '../../design/primitives';
import { guardScoutingLink } from './scoutingNavigation';
export function ScoutingLink(props: ComponentProps<typeof ButtonLink>) {
    const navigate = useNavigate();
    return <ButtonLink {...props} onClick={event => guardScoutingLink(event, navigate)} />;
}
