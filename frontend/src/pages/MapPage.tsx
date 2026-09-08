import { MapExperience } from '../components/map/MapExperience';

export type { MapExperienceContext, MapExperienceProps, MapMode } from '../components/map/MapExperience';

/**
 * Authenticated route adapter. The map rendering/state now lives in the shared
 * MapExperience component so the landing page can opt into a guest-safe map
 * without importing this route or its app-level protection.
 */
export const MapPage = ({ darkMode }: { darkMode: boolean }) => (
    <MapExperience darkMode={darkMode} context="authenticated" />
);
