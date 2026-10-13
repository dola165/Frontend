import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LeftSidebar } from "../LeftSidebar";
import { normalizeNavigationCapabilities } from '../../../context/navigationCapabilities';

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
    expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([
      '/profile/9', '/admissions', '/referees/me', '/agent',
    ]);
    expect(screen.queryByRole('link', { name: /My squads/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Agent Dola/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /My Schedule/ })).not.toBeInTheDocument();
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
  it("offers Following to someone nobody has linked yet, while other shortcuts remain navigation links", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LeftSidebar user={{ id: 9, fullName: "Alex Morgan", navigationCapabilities: { version: 1, workspaces: [] } }} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /Alex Morgan.*View your profile/ })).toHaveAttribute("href", "/profile/9");
    expect(screen.queryByRole("link", { name: /Following.*People you keep up with/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Following.*People you keep up with/ }));
    expect(screen.getByRole("dialog", { name: "Following" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Following" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Followed clubs.*Clubs you keep up with/ })).toHaveAttribute("href", "/clubs/following");
    expect(screen.queryByRole("link", { name: /Map.*Find football near you/ })).not.toBeInTheDocument();
    // Schedule lives in the account menu, profile and club pages now.
    expect(screen.queryByRole("link", { name: /My Schedule/ })).not.toBeInTheDocument();
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
