import { Outlet } from 'react-router-dom';
import { GkRoot, PageFrame } from '../../design/primitives';
import { WorldNav } from './WorldNav';
import './world.css';

/** Every World page except the full map: the shared World navigation above the page. */
export function WorldLayout() {
    return (
        <GkRoot className="gk-page gk-world">
            <PageFrame>
                <WorldNav />
                <Outlet />
            </PageFrame>
        </GkRoot>
    );
}
