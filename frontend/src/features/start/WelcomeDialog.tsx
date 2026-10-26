import { useEffect } from 'react';
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
import { choicesFor, finished, opened, stepFromStored, WELCOME_PARAM, type Choice, type Step } from './welcomeSteps';
import type { WelcomeStepProps } from './WelcomeFrame';

/**
 * The welcome over Home (F7): step 1 "What brings you to GrassKickZ?", then one screen for the answer, then the person
 * lands where that answer leads. Skip, Escape and closing count as following football; nothing is forced.
 */
export function WelcomeDialog({ step: asked }: { step: Step }) {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const userId = useAuth().user?.id ?? 0;
    const facts = useWelcomeFacts();
    const choices = choicesFor(facts);
    // An answer this person is not offered (under 16) opens step 1 instead.
    const step: Step = asked === 'start' || choices.includes(asked) ? asked : 'start';

    // The welcome is up at this step: a first visit starts it, an open one remembers where it is.
    useEffect(() => {
        const current = readPreferences(userId).start?.welcome;
        if (!current || (current.state === 'OPEN' && stepFromStored(current.at) !== step))
            void saveStart(userId, start => ({ welcome: opened(start.welcome, step) })).catch(() => undefined);
    }, [step, userId]);

    const address = (to: Step | null) => {
        const search = new URLSearchParams(params);
        if (to) search.set(WELCOME_PARAM, to); else search.delete(WELCOME_PARAM);
        const query = search.toString();
        return `/home${query ? `?${query}` : ''}`;
    };
    const finish = (choice: Choice, extra: Partial<StartPreferences> = {}) =>
        void saveStart(userId, current => ({ ...extra, welcome: finished(current.welcome as WelcomeProgress | null, choice) })).catch(() => undefined);
    const props: WelcomeStepProps = {
        facts,
        land: (choice, to, extra) => { finish(choice, extra); navigate(to ?? address(null), { replace: true }); },
        back: () => navigate(address('start')),
        close: () => { finish('follow'); navigate(address(null), { replace: true }); },
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
