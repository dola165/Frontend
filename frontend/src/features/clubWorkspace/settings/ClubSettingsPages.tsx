import { SettingsTab } from '../../../components/workspace/tabs/SettingsTab';
import { ClubPresentationSettings } from '../../../components/workspace/tabs/ClubPresentationSettings';
import { LegacyFrame } from '../LegacyFrame';

export function ClubProfileSettings({ clubId, pendingKey, darkMode }: { clubId: number; pendingKey: string | null; darkMode: boolean }) {
    return <LegacyFrame darkMode={darkMode} area="settings" tab="settings"><SettingsTab clubId={clubId} pendingKey={pendingKey} /></LegacyFrame>;
}
export function ProgrammesSettings({ clubId }: { clubId: number }) {
    return <LegacyFrame darkMode area="business" tab="programmes"><ClubPresentationSettings clubId={clubId} /></LegacyFrame>;
}
