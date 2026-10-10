import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DecisionNoteModal } from './recruitment/DecisionNoteModal';
import type { ClubMembership } from './useClubMembership';

/** Notes and confirmations for membership decisions: accepting or declining applications and tryouts, and releasing players. */
export function ClubDecisionDialogs({ membership }: { membership: ClubMembership }) {
    const { t } = useTranslation();
    const { decisions: d, actions, pendingKey } = membership;
    const saving = (prefix: string) => !!pendingKey && pendingKey.startsWith(prefix);
    const pending = d.pendingStatus;
    return <>
        {d.acceptTarget && <DecisionNoteModal
            title={t('decisions.acceptTitle')}
            subtitle={t(d.acceptTarget.role === 'PLAYER' ? 'decisions.acceptSubtitle' : 'decisions.staffAcceptSubtitle', { name: d.acceptTarget.fullName || d.acceptTarget.username })}
            templateKey={d.acceptTarget.role === 'PLAYER' ? 'decisions.template' : 'decisions.staffTemplate'}
            saving={saving('accept-')} onClose={() => d.setAcceptTarget(null)} onConfirm={message => void actions.acceptConfirm(message)} />}
        {d.tryoutAcceptTarget && <DecisionNoteModal
            title={t('decisions.tryoutAcceptTitle')} subtitle={t('decisions.acceptSubtitle', { name: d.tryoutAcceptTarget.name })}
            saving={saving('tryout-')} onClose={() => d.setTryoutAcceptTarget(null)} onConfirm={message => void actions.tryoutAcceptConfirm(message)} />}
        {d.declineTarget && <DecisionNoteModal
            title={t('decisions.declineTitle')} subtitle={t('decisions.declineSubtitle', { name: d.declineTarget.fullName || d.declineTarget.username })}
            saving={saving('decline-')} confirmLabel={t('applications.declineConfirm')} danger
            templateKey={d.declineTarget.role === 'PLAYER' ? 'decisions.declineTemplate' : 'decisions.declineApplicationTemplate'}
            onClose={() => d.setDeclineTarget(null)} onConfirm={message => void actions.declineConfirm(message)} />}
        {d.tryoutDeclineTarget && <DecisionNoteModal
            title={t('decisions.tryoutDeclineTitle')} subtitle={t('decisions.declineSubtitle', { name: d.tryoutDeclineTarget.name })}
            saving={saving('tryout-')} confirmLabel={t('applications.declineConfirm')} danger templateKey="decisions.declineTemplate"
            onClose={() => d.setTryoutDeclineTarget(null)} onConfirm={message => void actions.tryoutDeclineConfirm(message)} />}
        <ConfirmDialog
            open={d.showStatusConfirm}
            title={pending?.status === 'PAST' ? 'Mark as past player' : 'Remove player'}
            message={pending?.status === 'PAST'
                ? `Mark "${pending?.playerName || 'this player'}" as a past player? They will be removed from all squads.`
                : `Remove "${pending?.playerName || 'this player'}" from the club? They will be removed from all squads.`}
            confirmLabel={pending?.status === 'PAST' ? 'Mark as past' : 'Remove'}
            variant="danger"
            noteField={{ label: t('decisions.releaseNoteLabel'), placeholder: t('decisions.releaseNotePlaceholder'), maxLength: 1000, value: d.releaseMessage, onChange: d.setReleaseMessage }}
            onConfirm={() => void actions.confirmStatus()}
            onCancel={actions.cancelStatus}
        />
    </>;
}
