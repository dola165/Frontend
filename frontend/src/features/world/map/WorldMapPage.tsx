import { useAuth } from '../../../context/AuthContext';
import { GkRoot, PageFrame } from '../../../design/primitives';
import { WorldNav } from '../WorldNav';
import { WorldMapView } from './WorldMapView';
import '../world.css';

/** World's full map: the map under the World navigation. */
export default function WorldMapPage() {
    const { status } = useAuth();
    return (
        <div className="world-mapview">
            <GkRoot className="gk-world gk-world-mapbar"><PageFrame><WorldNav /></PageFrame></GkRoot>
            <GkRoot className="world-mapview__canvas">
                {status !== 'bootstrapping' && <WorldMapView signedIn={status === 'authenticated'} />}
            </GkRoot>
        </div>
    );
}
