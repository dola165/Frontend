import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { usePageEdit, SETUP_PANEL } from '../edit/context';
import { usePagesCopy } from '../copy';
import { stepWords } from '../edit/words';
import type { SetupKey } from '../model/kinds';
import { GuidedFlow, type GuideTask } from './GuidedFlow';
import { QuickAnswer } from './QuickAnswer';
import { isQuick } from './quick';
import { answerPanel, panelListens, usePetHint } from './bridge';
import { runGuideTask, useGuideTask, useGuideTaskAdapter } from './taskBridge';
import { useGuideCopy } from './copy';

const WORDS: Record<string, [string, string]> = {
  crest: ['Choose your crest', 'Pick your colours, or upload your badge.'],
  about: ['Tell parents about your club', 'Keep this suggestion or write your own.'],
  grounds: ['Where do you play?', 'Choose a ground on the map, or type its name.'],
  squads: ['Which teams do you have?', 'Choose birth years and boys or girls. Training comes later on each team’s page.'],
  contact: ['How can parents reach you?', 'Confirm the phone number for your page.'],
  fees: ['What does a month cost?', 'Confirm the range, or choose Free.'],
  players: ['Invite your players', 'Share a team’s join link when you are ready.'],
};

/** Club adapter for the shared runner. Page owners retain forms, version checks and mutations. */
export function DolaPet() {
  const { user, sessionId } = useAuth();
  const edit = usePageEdit();
  if (!edit.page || !edit.editing || edit.page.status !== 'DRAFT' || !user) return null;
  return <ClubGuide key={`${user.id}:${sessionId}:${edit.page.ref.type}:${edit.page.ref.id}`} />;
}
function ClubGuide() {
  const t = useGuideCopy(), pageCopy = usePagesCopy();
  const { page, panel, goLive } = usePageEdit();
  const { user } = useAuth();
  const location = useLocation(), navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const registered = useGuideTaskAdapter(selected && isQuick(selected) ? `quick:${selected}` : `input:${selected ?? ''}`);
  if (!page || !user) return null;
  const flowId = `club:${user.id}:${page.ref.type}:${page.ref.id}`;
  const enter = (key: SetupKey | 'ready') => {
    const query = new URLSearchParams(location.search);
    ['steps', 'new', 'tab', 'rearrange'].forEach(item => query.delete(item));
    if (key !== 'ready' && !isQuick(key)) query.set('panel', SETUP_PANEL[key]); else query.delete('panel');
    navigate({ pathname: location.pathname, search: `?${query}`, hash: location.hash }, { replace: true });
  };
  const tasks: GuideTask[] = page.setup.items.map(item => {
    const key = item.key;
    const words = WORDS[key];
    const quick = isQuick(key);
    return {
      id: key,
      title: words ? t(words[0]) : pageCopy(stepWords(page.kind, key)),
      description: words ? t(words[1]) : undefined,
      target: !quick && panel === SETUP_PANEL[key] ? '.gk-dialog' : undefined,
      enter: () => enter(key),
      content: quick ? <QuickAnswer step={key} page={page} /> : <PanelAnswer panelKey={SETUP_PANEL[key]} open={panel === SETUP_PANEL[key]} reopen={() => enter(key)} />,
      nextLabel: selected === key ? registered?.nextLabel : undefined,
      disabled: selected === key && registered?.disabled,
      next: async () => {
        if (!quick && panel !== SETUP_PANEL[key]) { enter(key); return { status: 'stay' }; }
        return runGuideTask(quick ? `quick:${key}` : `input:${SETUP_PANEL[key]}`);
      },
    };
  });
  tasks.push({
    id: 'ready', title: t(page.goLive.ready ? 'Ready to go live' : 'Name your club'),
    description: t('Only the name is required. You can add the rest later.'),
    enter: () => enter('ready'), nextLabel: t('Go live'), canSkip: false,
    content: !page.goLive.ready ? <QuickAnswer step="name" page={page} /> : undefined,
    next: async () => {
      if (!page.goLive.ready && (await runGuideTask('quick:name')).status !== 'complete') return { status: 'stay' };
      return await goLive() ? { status: 'complete' } : { status: 'stay', message: 'Save not confirmed. Your answer is still here. Try Next again.' };
    },
  });
  // A different ordinary editor stays usable. Merely closing it never advances the guide.
  const expected = selected && selected !== 'ready' ? SETUP_PANEL[selected as SetupKey] : null;
  const suspended = Boolean(selected && panel && panel !== expected);
  return <GuidedFlow flowId={flowId} title={t('Set up your club')} tasks={tasks} initialTaskId={page.setup.next ?? 'ready'} onTaskChange={setSelected} suspended={suspended} />;
}
function PanelAnswer({ panelKey, open, reopen }: { panelKey: string; open: boolean; reopen: () => void }) {
  const t = useGuideCopy();
  const hint = usePetHint(panelKey);
  const editor = useGuideTaskAdapter(panelKey);
  const [reply, setReply] = useState('');
  useGuideTask(`input:${panelKey}`, {
    disabled: !reply.trim() && editor?.disabled,
    nextLabel: reply.trim() ? t('Next') : editor?.nextLabel,
    next: async () => {
      if (reply.trim()) {
        let understood: string | null = null;
        // Commit the editor's own state before its save callback reads it. No DOM clicks or timing guesses.
        flushSync(() => { understood = answerPanel(panelKey, reply); });
        if (!understood) return { status: 'stay', message: 'Choose a matching option in the editor.' };
        setReply('');
      }
      const result = await runGuideTask(panelKey);
      return result.status === 'stay' && !result.message
        ? { status: 'stay', message: hint?.quiet && hint.line ? hint.line : 'Save not confirmed. Your answer is still here. Try Next again.' }
        : result;
    },
  });
  if (!open) return <button type="button" onClick={reopen}>{t('Reopen this step')}</button>;
  return <div className="gk-guide__reply">
    {(hint?.line || hint?.said) && <p aria-live="polite">{hint?.line || hint?.said}</p>}
    {panelListens(panelKey) && !hint?.quiet && <>
      <label>{t(panelKey === 'grounds' ? 'Your ground’s name' : 'Birth years, like 2015, 2016 boys')}
        <input value={reply} onChange={event => setReply(event.target.value)} maxLength={120} />
      </label>
    </>}
  </div>;
}
