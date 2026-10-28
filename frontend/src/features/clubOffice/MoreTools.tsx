import { Link } from 'react-router-dom';
import { Eye, Lock } from 'lucide-react';
import { EmptyNote, PageFrame, PageHeader, Panel } from '../../design/primitives';
import { AskAdmin } from '../../components/access/AskAdmin';
import type { Bootstrap } from '../clubOperations/api';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { officeToolPath, type OfficeTool } from './officeLinks';
import { moreToolGroups, toolIcon, toolName, type ToolState } from './officeTools';

/**
 * More tools: every tool with no page of its own yet, grouped by the page it will move to. Admins see every group;
 * everyone else only the tools they open today, with Ask the admin for more. A locked drawer shows its lock.
 */
export function MoreTools({ clubId, states, boot, leader, admin }: {
    clubId: number; states: Map<OfficeTool, ToolState>; boot: Bootstrap | null; leader: boolean; admin: { userId: number; name: string } | null;
}) {
    const copy = useJourneyCopy();
    const groups = moreToolGroups(states, boot, leader);
    const locked = (tool: OfficeTool) => tool === 'medical' ? copy('Only the club’s medical staff open this', 'ამას მხოლოდ კლუბის სამედიცინო პერსონალი ხსნის')
        : tool === 'welfare' ? copy('Only the welfare officer opens this', 'ამას მხოლოდ ბავშვთა დაცვის ოფიცერი ხსნის')
            : copy('Not open for your job', 'თქვენი სამუშაოსთვის დახურულია');
    return <PageFrame className="cw-page office-tools">
        <PageHeader title={copy('More tools', 'სხვა ინსტრუმენტები')} subtitle={copy('Each group moves to its own page when that page is built.', 'თითოეული ჯგუფი თავის გვერდზე გადავა, როცა ის გვერდი შეიქმნება.')} />
        {groups.length ? <div className="office-tools__groups">{groups.map(group => <section key={group.id} className="office-tools__group" aria-labelledby={`office-tools-${group.id}`}>
            <h2 id={`office-tools-${group.id}`} className="office-tools__page">{copy(group.page[0], group.page[1])}</h2>
            <ul className="office-tools__list">{group.tools.map(tool => {
                const state = states.get(tool), Icon = toolIcon(tool), name = toolName(tool);
                return <li key={tool}>{state === 'open' || state === 'view'
                    ? <Link className="office-tool" to={officeToolPath(clubId, tool)}><Icon aria-hidden="true" /><span>{name}</span>
                        {state === 'view' && <Eye className="office-tool__mark" role="img" aria-label={copy('View only', 'მხოლოდ ნახვა')} />}</Link>
                    : <span className="office-tool" aria-disabled="true" title={locked(tool)}><Icon aria-hidden="true" /><span>{name}</span>
                        <Lock className="office-tool__mark" role="img" aria-label={locked(tool)} /></span>}</li>;
            })}</ul>
        </section>)}</div>
            : <Panel><EmptyNote title={copy('No tools for your job here', 'თქვენს სამუშაოს აქ ხელსაწყოები არ აქვს')} /></Panel>}
        {!leader && admin && <div className="office-tools__ask"><AskAdmin admin={admin} reason={copy('Need another tool? The admin gives jobs.', 'სხვა ინსტრუმენტი გჭირდებათ? სამუშაოს ადმინი გასცემს.')} /></div>}
    </PageFrame>;
}
