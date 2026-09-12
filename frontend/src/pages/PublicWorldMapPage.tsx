import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapExperience } from '../components/map/MapExperience';
export const PublicWorldMapPage = () => {
    const navigate = useNavigate();
    return <div className="relative h-full min-h-0 w-full">
        <MapExperience darkMode={false} context="guest" mapTheme="light" />
        <button type="button" onClick={() => navigate('/')} aria-label="Return to landing page" className="atlas-return"><ArrowLeft size={16} /><span>Return</span></button>
    </div>;
};
