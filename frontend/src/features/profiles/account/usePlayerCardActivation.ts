import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { activatePlayerCard, fetchMyPlayerCards, type PlayerCard } from '../../clubs/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { ageFromDob } from '../../../utils/age';

/** Guardian activation of a linked player card. The typed birth date and email outlive closing the dialog. */
export function usePlayerCardActivation(setMyCards: Dispatch<SetStateAction<PlayerCard[]>>) {
    const { t } = useTranslation();
    const [activatingCard, setActivatingCard] = useState<PlayerCard | null>(null);
    const [childDob, setChildDob] = useState('');
    const [childEmail, setChildEmail] = useState('');
    const [activationCreds, setActivationCreds] = useState<{ username: string; email: string; status: string } | null>(null);
    const [activationError, setActivationError] = useState<string | null>(null);
    const [activating, setActivating] = useState(false);

    const submitActivation = async (e: FormEvent) => {
        e.preventDefault();
        if (!activatingCard) return;
        if (!childDob || !Number.isFinite(ageFromDob(childDob)) || ageFromDob(childDob) < 13 || ageFromDob(childDob) >= 18) {
            setActivationError(t('minors.account.childTooYoung'));
            return;
        }
        setActivating(true);
        setActivationError(null);
        try {
            const creds = await activatePlayerCard(activatingCard.id, childDob, childEmail.trim());
            setActivationCreds(creds);
        } catch (err) {
            setActivationError(extractApiErrorMessage(err, t('minors.account.activationFailed')));
        } finally {
            setActivating(false);
        }
    };

    const close = () => {
        setActivatingCard(null);
        setActivationCreds(null);
        setActivationError(null);
    };

    const finish = () => {
        setActivatingCard(null);
        setActivationCreds(null);
        void fetchMyPlayerCards().then(setMyCards);
    };

    return {
        activatingCard, setActivatingCard, childDob, setChildDob, childEmail, setChildEmail,
        activationCreds, activationError, activating, submitActivation, close, finish,
    };
}

export type PlayerCardActivation = ReturnType<typeof usePlayerCardActivation>;
