import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LeftSidebar } from "../LeftSidebar";
import { normalizeNavigationCapabilities } from '../../../context/navigationCapabilities';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';

vi.mock("../../profile/ConnectionsDialog", () => ({
  ConnectionsDialog: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Following">
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

describe("LeftSidebar", () => {
  it('lists authorized work without repeating header destinations', () => {
    const caps = normalizeNavigationCapabilities({ version: 1, workspaces: [
      { id: 'referee.workspace', context: { type: 'user', id: 9, label: 'Referee' } },
      { id: 'agent.hub', context: { type: 'user', id: 9, label: 'Agent' } },
    ] }, 9);
    render(<MemoryRouter><LeftSidebar user={{ id: 9, fullName: 'Alex Morgan', navigationCapabilities: caps }} /></MemoryRouter>);
    // Someone without a page of their own is offered one; My Schedule came back to Home's rail (owner, 10 October).
    expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([
      '/profile/9', '/?create=any&from=home', '/admissions', '/referees/me', '/agent', '/calendar?scope=personal',
    ]);
    expect(screen.queryByRole('link', { name: /My squads/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Agent Dola/ })).not.toBeInTheDocument();
  });
  it('keeps a family-only club connection in Parent Hub', () => {
    render(<MemoryRouter><LeftSidebar user={{id:9,navigationCapabilities:{version:1,workspaces:[{id:'club.family',context:{type:'club',id:21,label:'Academy'}}]}}}/></MemoryRouter>);
    expect(screen.getByRole('link',{name:/Parent Hub/})).toHaveAttribute('href','/parent');
    expect(screen.getAllByRole('link').some(link=>link.getAttribute('href')==='/clubs/21/workspace')).toBe(false);
  });
  it('removes squads when current access is revoked', () => {
    const venue = { id: 'venue.workspace', context: { type: 'organization', id: 133, label: 'Sports Park' } };
    const squad = { id: 'squad.workspace', context: { type: 'squad', id: 18, label: 'U12' } };
    const { rerender } = render(<MemoryRouter><LeftSidebar user={{ id: 9, navigationCapabilities: { version: 1, workspaces: [venue, squad] } }} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /My squads/ })).toBeInTheDocument();
    rerender(<MemoryRouter><LeftSidebar user={{ id: 9, navigationCapabilities: { version: 1, workspaces: [venue] } }} /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: /My squads/ })).not.toBeInTheDocument();
  });

  it('keeps general navigation on old responses without deriving workspaces from labels', () => {
    render(<MemoryRouter><LeftSidebar user={{ id: 9 }} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /My squads/ })).toHaveAttribute('href', '/squads');
    expect(screen.queryByRole('link', { name: 'Referee workspace' })).not.toBeInTheDocument();
    // Unknown links are never shown as "no links": Explore waits for the server's answer.
    expect(screen.queryByRole('button', { name: /Following/ })).not.toBeInTheDocument();
  });
  it.each([
    { language: 'en', profile: 'Alex Morgan. View your profile', following: 'Following. People you keep up with', clubs: 'Followed clubs. Clubs you keep up with', schedule: 'My schedule. Your personal calendar' },
    { language: 'ka', profile: 'Alex Morgan. პროფილის ნახვა', following: 'გამოწერილი. ადამიანები, ვისაც ადევნებთ თვალს', clubs: 'გამოწერილი კლუბები. კლუბები, რომლებსაც ადევნებთ თვალს', schedule: 'ჩემი განრიგი. თქვენი პირადი კალენდარი' },
  ])("offers Following in $language to someone nobody has linked yet, while other shortcuts remain navigation links", async ({ language, profile, following, clubs, schedule }) => {
    const i18n = createInstance();
    await i18n.init({ lng: language, resources: { en: { translation: {} }, ka: { translation: {} } } });
    const user = userEvent.setup();
    render(<I18nextProvider i18n={i18n}><MemoryRouter><LeftSidebar user={{ id: 9, fullName: "Alex Morgan", navigationCapabilities: { version: 1, workspaces: [] } }} /></MemoryRouter></I18nextProvider>);
    expect(screen.getByRole("link", { name: profile })).toHaveAttribute("href", "/profile/9");
    expect(screen.queryByRole("link", { name: following })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: following }));
    expect(screen.getByRole("dialog", { name: "Following" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Following" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: clubs })).toHaveAttribute("href", "/clubs/following");
    expect(screen.queryByRole("link", { name: /Map.*Find football near you/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: schedule })).toHaveAttribute("href", "/calendar?scope=personal");
    expect(screen.queryByRole("link", { name: /Match Exchange/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /My club|Club workspace|Find clubs|Find people/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Events/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Roles/ })).not.toBeInTheDocument();
  });

  it("does not render followed clubs as an embedded club list", () => {
    render(<MemoryRouter><LeftSidebar user={{ id: 9, fullName: "Alex Morgan", navigationCapabilities: { version: 1, workspaces: [] } }} /></MemoryRouter>);
    expect(screen.queryByText("See all")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Followed clubs" })).not.toBeInTheDocument();
  });
});

it.each([
    ['a coach', { id: 'squad.workspace', context: { type: 'squad', id: 18, label: 'U12' } }],
    ['a player', { id: 'club.player', context: { type: 'club', id: 21, label: 'Academy' } }],
    ['a parent', { id: 'parent.hub', context: { type: 'user', id: 9, label: 'Family' } }],
    ['a referee', { id: 'referee.workspace', context: { type: 'user', id: 9, label: 'Referee' } }],
    ['an agent', { id: 'agent.hub', context: { type: 'user', id: 9, label: 'Agent' } }],
])('omits following and map from the left rail for %s', (_, workspace) => {
    render(<MemoryRouter><LeftSidebar user={{ id: 9, navigationCapabilities: { version: 1, workspaces: [workspace] } }} /></MemoryRouter>);
    expect(screen.queryByRole('button',{name:/Following/})).not.toBeInTheDocument();
    expect(screen.queryByRole('link',{name:/Followed clubs/})).not.toBeInTheDocument();
    expect(screen.queryByRole('link',{name:/^Map/})).not.toBeInTheDocument();
});
