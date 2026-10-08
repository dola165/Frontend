import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { getAuthSessionId, isCurrentAuthSession, subscribeAuthSession } from '../../utils/authStorage';
import { extractApiErrorCode, extractApiErrorMessage } from '../../utils/apiError';

export type PrimaryLoginProof = { kind: 'password'; email: string; password: string } | { kind: 'google'; token: string };
export type CompletedLogin = { accessToken: string; mustChangePassword?: boolean; newAccount?: boolean };

export function secondFactorError(error: unknown, fallback: string) {
    switch (extractApiErrorCode(error)) {
        case 'second_factor_locked': return 'Too many incorrect codes. Wait five minutes before trying again.';
        case 'second_factor_invalid': return 'Use a new authenticator code or an unused recovery code.';
        case 'second_factor_unavailable': return 'Authenticator verification is temporarily unavailable. Please try again later.';
        default: return extractApiErrorMessage(error, fallback);
    }
}

/** Primary proof lives only in this mounted flow; no token is accepted at the challenge step. */
export function useSecondFactorLogin() {
    const [challenge, setChallenge] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mounted = useRef(true);
    const flow = useRef<{
        proof: PrimaryLoginProof;
        session: ReturnType<typeof getAuthSessionId>;
        resolve: (login: CompletedLogin | null) => void;
        reject: (error: unknown) => void;
        controller: AbortController | null;
    } | null>(null);

    const cancel = () => {
        const old = flow.current;
        flow.current = null;
        old?.controller?.abort();
        old?.resolve(null);
        setChallenge(false); setPending(false); setError(null);
    };
    useEffect(() => {
        mounted.current = true;
        const retire = () => { if (flow.current && !isCurrentAuthSession(flow.current.session)) cancel(); };
        const unsubscribe = subscribeAuthSession(retire);
        return () => {
            mounted.current = false;
            unsubscribe();
            const old = flow.current;
            flow.current = null;
            old?.controller?.abort();
            old?.resolve(null);
        };
    }, []);

    const request = async (code?: string) => {
        const current = flow.current;
        if (!current || current.controller || !isCurrentAuthSession(current.session)) return;
        const controller = new AbortController();
        current.controller = controller;
        setPending(true); setError(null);
        const proof = current.proof;
        try {
            const response = await apiClient.post<CompletedLogin & { twoFactorRequired?: boolean }>(
                proof.kind === 'password' ? '/auth/login' : '/auth/google',
                { ...(proof.kind === 'password' ? { email: proof.email, password: proof.password } : { token: proof.token }), ...(code ? { oneTimeCode: code.trim() } : {}) },
                { signal: controller.signal },
            );
            if (controller.signal.aborted || flow.current !== current || !isCurrentAuthSession(current.session)) return;
            if (response.data?.twoFactorRequired === true) {
                setChallenge(true);
                if (code) setError('Enter an authenticator code or an unused recovery code to continue.');
                return;
            }
            if (typeof response.data?.accessToken !== 'string' || !response.data.accessToken.trim()) {
                throw new Error('The server did not complete sign-in. Please try again.');
            }
            flow.current = null;
            setChallenge(false);
            current.resolve(response.data);
        } catch (requestError) {
            if (controller.signal.aborted || flow.current !== current || !isCurrentAuthSession(current.session)) return;
            if (code) setError(secondFactorError(requestError, 'Could not verify your code. Try again or cancel sign-in.'));
            else { flow.current = null; current.reject(requestError); }
        } finally {
            if (!controller.signal.aborted && (flow.current === current || flow.current === null)) {
                current.controller = null;
                setPending(false);
            }
        }
    };

    const authenticate = (proof: PrimaryLoginProof): Promise<CompletedLogin | null> => {
        if (!mounted.current || flow.current) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            flow.current = { proof, session: getAuthSessionId(), resolve, reject, controller: null };
            void request();
        });
    };
    return { challenge, pending, error, authenticate, cancel, submit: (code: string) => request(code) };
}
