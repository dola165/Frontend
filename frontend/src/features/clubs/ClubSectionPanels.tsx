import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClubPreviewActiveContext, ClubPreviewQueryContext } from './clubProfilePreviewContext';
import type { ClubTab } from '../../pages/ClubProfilePage';

/** Keep visited sections and their controls in place for this club/auth session. */
export function ClubSectionPanels({ activeTab, children }: { activeTab: ClubTab; children: (tab: ClubTab) => ReactNode }) {
  const [params, update] = useSearchParams();
  const query = params.toString();
  const [sections, setSections] = useState<Record<string, string>>({ [activeTab]: query });
  if (sections[activeTab] !== query) setSections({ ...sections, [activeTab]: query });
  return <>{Object.entries(sections).map(([tab, savedQuery]) => <section key={tab} data-club-section={tab} tabIndex={-1} hidden={tab !== activeTab} inert={tab !== activeTab} aria-label={`${tab} section`}>
    <ClubPreviewActiveContext.Provider value={tab === activeTab}>
      <ClubPreviewQueryContext.Provider value={[new URLSearchParams(tab === activeTab ? query : savedQuery), update]}>
        {children(tab as ClubTab)}
      </ClubPreviewQueryContext.Provider>
    </ClubPreviewActiveContext.Provider>
  </section>)}</>;
}
