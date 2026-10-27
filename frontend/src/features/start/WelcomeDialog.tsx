import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { readPreferences, type StartPreferences, type WelcomeProgress } from '../preferences/preferencesStore';
import { saveStart } from './startApi';
import { BusinessStep } from './steps/BusinessStep';
import { ClubStep } from './steps/ClubStep';
import { FollowStep } from './steps/FollowStep';
import { PlayStep } from './steps/PlayStep';
import { WhatBringsStep } from './steps/WhatBringsStep';
import { WorkStep } from './steps/WorkStep';
import { useWelcomeFacts } from './useWelcomeFacts';
import { choicesFor, finished, opened, PART_PARAM, partFromParam, stepFromStored, WELCOME_PARAM, type Choice, type Part, type Step } from './welcomeSteps';
import type { WelcomeStepProps } from './WelcomeFrame';

/**
 * The welcome over Home (F7): step 1 "What brings you to GrassKickZ?", then one screen for the answer, then the person
 * lands where that answer leads. Skip, Escape and X count as following football; nothing is forced. A click beside it
 * never closes it, and the profile's "Change what brings you here" opens it again.
 */
export function WelcomeDialog({ step: asked }: { step: Step }) {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const userId = useAuth().user?.id ?? 0;
    const facts = useWelcomeFacts();
    const choices = choicesFor(facts);
    // An answer this person is not offered (under 18) opens step 1 instead.
    const step: Step = asked === 'start' || choices.includes(asked) ? asked : 'start';

    // The welcome is up at this step: a first visit starts it, an open one remembers where it is. A finished one opened
    // again is left as it is, decided on the preferences as they arrive (they may not have loaded yet).
    useEffect(() => {
        const current = readPreferences(userId).start?.welcome;
        if (!current || (current.state === 'OPEN' && stepFromStored(current.at) !== step))
            void saveStart(userId, start => (start.welcome?.state === 'DONE' ? {} : { welcome: opened(start.welcome, step) })).catch(() => undefined);
    }, [step, userId]);

    const address = (to: Step | null, part: Part | null = null) => {
        const search = new URLSearchParams(params);
        if (to) search.set(WELCOME_PARAM, to); else search.delete(WELCOME_PARAM);
        if (to && part) search.set(PART_PARAM, part); else search.delete(PART_PARAM);
        const query = search.toString();
        return `/home${query ? `?${query}` : ''}`;
    };
    // A screen opened inside the step on this visit is left with Back; one the address arrived with is replaced.
    const pushedPart = useRef(false);
    const part = partFromParam(params.get(PART_PARAM));
    useEffect(() => { if (!part) pushedPart.current = false; }, [part]);
    const finish = (choice: Choice, extra: Partial<StartPreferences> = {}) =>
        void saveStart(userId, current => ({ ...extra, welcome: finished(current.welcome as WelcomeProgress | null, choice) })).catch(() => undefined);
    const props: WelcomeStepProps = {
        facts,
        finish: choice => finish(choice),
        land: (choice, to, extra) => { finish(choice, extra); navigate(to ?? address(null), { replace: true }); },
        back: () => navigate(address('start')),
        // X and Skip only (never a click beside it); Back brings the welcome back, and the profile reopens it any time.
        // Closing a welcome that was already answered (opened again) changes nothing: the answer and its first week stay.
        close: () => { if (readPreferences(userId).start?.welcome?.state !== 'DONE') finish('follow'); navigate(address(null)); },
        part,
        openPart: part => {
            if (part) { pushedPart.current = true; navigate(address(step, part)); }
            else if (pushedPart.current) { pushedPart.current = false; navigate(-1); }
            else navigate(address(step), { replace: true });
        },
    };

    switch (step) {
        case 'start': return <WhatBringsStep choices={choices} onPick={choice => navigate(address(choice))} onSkip={props.close} />;
        case 'me': case 'child': return <PlayStep key={step} who={step} {...props} />;
        case 'club': return <ClubStep {...props} />;
        case 'work': return <WorkStep {...props} />;
        case 'business': return <BusinessStep {...props} />;
        case 'follow': return <FollowStep {...props} />;
    }
}
