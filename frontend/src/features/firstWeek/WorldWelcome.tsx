import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { WORLD_BRAND } from '../../components/brand/worldBrand';
import { WorldMark } from '../../components/brand/WorldMark';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../design/primitives';
import { completeTutorial, loadPreferences } from '../preferences/preferencesStore';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { saveStart } from '../start/startApi';
import { doneSteps, markDone } from './steps';
import './first-week.css';

/** Kept with the person's finished guides once World has greeted them. */
const WORLD_GREETED = 'world';

/**
 * The first time a person opens World, from the first week or the top bar: one closable line in World's own top area
 * naming it ("GrassKickZ World") and what it is for. It never comes back once that visit happened. Opening World also
 * ticks "Meet GrassKickZ World" in the first week.
 */
export function WorldWelcome() {
    const copy = useJourneyCopy();
    const userId = useAuth().user?.id;
    const [shown, setShown] = useState(false);
    useEffect(() => {
        if (!userId) return;
        let live = true;
        loadPreferences(userId).then(doc => {
            if (!live) return;
            const welcome = doc.start?.welcome;
            if (welcome?.state === 'DONE' && !welcome.cardDismissed && !doneSteps(welcome).has('world'))
                void saveStart(userId, current => ({ welcome: markDone(current.welcome, 'world') })).catch(() => undefined);
            if (doc.tutorials?.completed.includes(WORLD_GREETED)) return;
            setShown(true);
            completeTutorial(userId, WORLD_GREETED);
        }).catch(() => undefined);
        return () => { live = false; };
    }, [userId]);
    if (!shown) return null;
    return <div className="gk-world-hello" role="note">
        <WorldMark size={32} />
        <p><strong>{copy(...WORLD_BRAND.name)}</strong><span>{copy(...WORLD_BRAND.tagline)}</span></p>
        <Button variant="ghost" size="sm" iconOnly aria-label={copy('Close', 'დახურვა')} onClick={() => setShown(false)}><X aria-hidden="true" /></Button>
    </div>;
}
