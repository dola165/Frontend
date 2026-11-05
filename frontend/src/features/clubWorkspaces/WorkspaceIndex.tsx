import { ArrowRight } from 'lucide-react';
import { Badge, EmptyNote, PageFrame, PageHeader, Panel } from '../../design/primitives';
import type { JobWorkspace, JobWorkspaceManifest } from './types';
import { workspaceDestinationPath } from './paths';
import { WorkspaceLink } from './WorkspaceLink';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { workspaceTitle } from './copy';

export function WorkspaceIndex({ manifest }: { manifest: JobWorkspaceManifest }) {
    const copy = useJourneyCopy();
    const working = manifest.workspaces.filter(item => item.maturity === 'working');
    const previews = manifest.workspaces.filter(item => item.maturity === 'prototype');
    const list = (items: JobWorkspace[]) => <ul className="job-workspaces__destinations">{items.map(workspace => <li key={workspace.key}>
        <WorkspaceLink to={workspaceDestinationPath(workspace)}><span><strong>{workspaceTitle(workspace, copy)}</strong>
            <span className="job-workspaces__jobs">{workspace.jobTitles.map(title => <span key={title}>{title}</span>)}</span></span><ArrowRight aria-hidden="true" /></WorkspaceLink>
    </li>)}</ul>;
    return <PageFrame className="job-workspaces__page">
        <PageHeader title={copy('Your club work', 'თქვენი სამუშაო კლუბში')} subtitle={manifest.clubName} />
        {working.length > 0 && <Panel title={copy('Workspaces', 'სამუშაო სივრცეები')} flush>{list(working)}</Panel>}
        {!manifest.workspaces.length && <EmptyNote title={copy('No workspaces are available for your current responsibilities', 'თქვენი მიმდინარე მოვალეობებისთვის სამუშაო სივრცეები ხელმისაწვდომი არ არის')}>
            {copy('Your current club access has no work destination to open. You can still use Inbox and the club page.', 'კლუბში თქვენი მიმდინარე უფლებებით სამუშაო სივრცე ხელმისაწვდომი არ არის. შეგიძლიათ გამოიყენოთ შემოსულები და კლუბის გვერდი.')}
        </EmptyNote>}
        {previews.length > 0 && <details className="job-workspaces__previews"><summary>{copy('Preview job workspaces', 'სამუშაო სივრცეების წინასწარი ნახვა')} <Badge>{copy('Prototype', 'პროტოტიპი')}</Badge></summary>
            <p>{copy('These layouts are being developed. Existing permitted tools and source records still work.', 'ამ სამუშაო სივრცეებზე მუშაობა გრძელდება. თქვენთვის ნებადართული ინსტრუმენტები და არსებული ჩანაწერები კვლავ მუშაობს.')}</p>{list(previews)}
        </details>}
    </PageFrame>;
}
