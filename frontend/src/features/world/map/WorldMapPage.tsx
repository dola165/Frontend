import { MapExperience } from '../../../components/map/MapExperience';
import { useAuth } from '../../../context/AuthContext';
import { GkRoot, PageFrame } from '../../../design/primitives';
import { WorldNav } from '../WorldNav';
import '../world.css';

/** World's full-map view: the map experience under the World navigation. */
export default function WorldMapPage({ darkMode }: { darkMode: boolean }) {
    const { status } = useAuth();
    return (
        <div className="world-mapview">
            <GkRoot className="gk-world gk-world-mapbar"><PageFrame><WorldNav /></PageFrame></GkRoot>
            <div className="world-mapview__canvas">
                {status !== 'bootstrapping' && <MapExperience darkMode={darkMode} context={status === 'authenticated' ? 'authenticated' : 'guest'} />}
            </div>
        </div>
    );
}
