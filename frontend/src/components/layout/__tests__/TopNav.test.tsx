import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TopNav } from "../TopNav";
import { normalizeNavigationCapabilities, type NavigationCapabilities } from '../../../context/navigationCapabilities';

type NavigationUser = { id: number; username: string; role: string; navigationCapabilities?: NavigationCapabilities };
const auth = vi.hoisted(() => ({ user: null as NavigationUser | null }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, sessionId: 'navigation-test' }) }));
vi.mock('../../../features/requests/RequestsCentre', () => ({ RequestsLink: () => <a href="/requests">Requests</a> }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) =>
      fallback ??
      (
        {
          "nav.explore": "Shortcuts",
          "nav.mobileNavigation": "Explore GrassKickZ",
          "nav.preview": "Preview",
        } as Record<string, string>
      )[_key] ??
      _key,
    i18n: {
      language: "en",
      resolvedLanguage: "en",
      options: { resources: { en: {}, ka: {} } },
      changeLanguage: vi.fn(),
    },
  }),
}));

vi.mock("../../search/GlobalSearchBar", () => ({
  GlobalSearchBar: () => <div data-testid="global-search" />,
}));

vi.mock("../../notifications/NotificationBell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock("../GrasskickzLogo", () => ({
  GrasskickzLogo: () => <span>GrassKickZ</span>,
}));

vi.mock("../AppPageShell", () => ({
  AppPageFrame: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

const renderTopNav = (
  user: NavigationUser | null,
  entry = '/',
) => {
  auth.user = user;
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <TopNav
        user={user}
        myClubId={null}
        themePreference="dark"
        setThemePreference={vi.fn()}
        handleLogout={vi.fn()}
      />
    </MemoryRouter>,
  );
};

it('keeps Matches & Competitions and My work on their own destinations', async () => {
  const user = userEvent.setup();
  renderTopNav({ id: 9, username: 'luka', role: 'COACH', navigationCapabilities: { version: 1, workspaces: [
    { id: 'club.workspace', context: { type: 'club', id: 1, label: 'Dinamo' } },
    { id: 'tournament.workspace', context: { type: 'tournament', id: 31, label: 'Cup' } },
  ] } }, '/tournaments');
  const tournaments = screen.getByRole('link', { name: 'Matches & Competitions' });
  const work = screen.getByRole('link', { name: 'My work' });
  expect(tournaments).toHaveAttribute('href', '/matches');
  expect(tournaments).toHaveAttribute('aria-current', 'page');
  expect(work).toHaveAttribute('href', '/workspaces');
  expect(work).not.toHaveAttribute('aria-current');
  await user.click(screen.getByRole('button', { name: 'nav.openMenu' }));
  const menu = screen.getByRole('menu');
  expect(within(menu).getByRole('menuitem', { name: 'Matches & Competitions' })).toHaveAttribute('href','/matches');
  expect(within(menu).getByRole('menuitem', { name: 'Tournament workspace — Cup' })).toHaveAttribute('href', '/tournaments/31/workspace');
});

it('marks a second approved club as the personal club destination', () => {
  renderTopNav({ id: 9, username: 'luka', role: 'COACH', navigationCapabilities: { version: 1, workspaces: [
    { id: 'club.workspace', context: { type: 'club', id: 1, label: 'Dinamo' } },
    { id: 'club.workspace', context: { type: 'club', id: 121, label: 'Second club' } },
  ] } }, '/clubs/121/workspace');
  expect(screen.getByRole('link', { name: 'My Clubs' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Clubs' })).not.toHaveAttribute('aria-current');
});
it('marks My Venues when entering a venue workspace directly', async () => {
  renderTopNav({ id: 9, username: 'owner', role: 'FAN', navigationCapabilities: { version: 1, workspaces: [
    { id: 'venue.workspace', context: { type: 'organization', id: 133, label: 'Sports Park' } },
  ] } }, '/stadiums/133/manage');
  expect(screen.getByRole('link', { name: 'My Venues' })).toHaveAttribute('aria-current', 'page');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Shortcuts' }));
  expect(screen.getByRole('menuitem', { name: 'Stadium workspace — Sports Park' })).toHaveAttribute('aria-current', 'page');
});
it('opens the account menu from the keyboard, moves among actions and restores focus on Escape', async () => {
  const user = userEvent.setup();
  renderTopNav({ id: 9, username: 'alex', role: 'FAN', navigationCapabilities: { version: 1, workspaces: [] } });
  const trigger = screen.getByRole('button', { name: 'nav.openMenu' });
  trigger.focus(); await user.keyboard('{ArrowUp}');
  expect(screen.getByRole('menuitem', { name: 'nav.signOut' })).toHaveFocus();
  await user.keyboard('{Home}');
  expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
});

describe("TopNav secondary navigation", () => {
  it('gives a venue owner direct navigation without irrelevant squads, including the mobile menu', async () => {
    const user = userEvent.setup();
    renderTopNav({ id: 9, username: 'owner', role: 'FAN', navigationCapabilities: { version: 1, workspaces: [
      { id: 'venue.workspace', context: { type: 'organization', id: 133, label: 'Sports Park' } },
      { id: 'organization.workspace', context: { type: 'organization', id: 133, label: 'Sports Park' } },
    ] } });
    expect(screen.getByRole('link', { name: 'My Venues' })).toHaveAttribute('href', '/my-organizations?kind=VENUE');
    expect(screen.queryByRole('link', { name: 'My Club' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Shortcuts' }));
    expect(screen.queryByRole('menuitem', { name: 'My squads' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Shortcuts' }));
    await user.click(screen.getByRole('button', { name: 'nav.openMenu' }));
    expect(screen.getByRole('menuitem', { name: 'My Venues' })).toHaveAttribute('href', '/my-organizations?kind=VENUE');
    expect(screen.queryByRole('menuitem', { name: 'My squads' })).not.toBeInTheDocument();
  });
  it('uses scoped server contexts in the shared desktop and mobile menu', async () => {
    const user = userEvent.setup();
    const navigationCapabilities = normalizeNavigationCapabilities({ version: 1, workspaces: [
      { id: 'parent.hub', context: { type: 'user', id: 9, label: 'Parent Hub' } },
      { id: 'referee.workspace', context: { type: 'user', id: 9, label: 'Referee workspace' } },
      { id: 'club.workspace', context: { type: 'club', id: 21, label: 'Academy' } },
      { id: 'tournament.workspace', context: { type: 'tournament', id: 31, label: 'Cup' } },
    ] }, 9);
    renderTopNav({ id: 9, username: 'alex', role: 'FAN', navigationCapabilities });
    await user.click(screen.getByRole('button', { name: 'Shortcuts' }));
    expect(screen.getByRole('menuitem', { name: 'Workspace — Academy' })).toHaveAttribute('href', '/clubs/21/workspace');
    expect(screen.getByRole('menuitem', { name: 'Tournament workspace — Cup' })).toHaveAttribute('href', '/tournaments/31/workspace');
    expect(screen.getAllByRole('menuitem', { name: 'Parent Hub' })).toHaveLength(1);
    expect(screen.getAllByRole('menuitem', { name: 'Referee workspace' })).toHaveLength(1);
  });

  it('keeps all personal and club destinations visible together after navigating to a personal workspace', () => {
    renderTopNav({ id:9, username:'tamar', role:'REFEREE', navigationCapabilities:{version:1,workspaces:[
      {id:'club.operations',context:{type:'club',id:121,label:'Grasskickz chveni'}},
      {id:'referee.workspace',context:{type:'user',id:9,label:'Referee workspace'}},
      {id:'parent.hub',context:{type:'user',id:9,label:'Parent Hub'}},
      {id:'agent.hub',context:{type:'user',id:9,label:'Agent Hub'}},
    ]}}, '/referees/me');
    expect(screen.getByRole('link',{name:'My Club'})).toHaveAttribute('href','/my-club');
    expect(screen.getByRole('link',{name:'Officiating'})).toHaveAttribute('href','/referees/me');
    expect(screen.getByRole('link',{name:'Parent Hub'})).toHaveAttribute('href','/parent');
    expect(screen.getByRole('link',{name:'Agent Hub'})).toHaveAttribute('href','/agent');
    expect(screen.queryByRole('combobox',{name:'Switch football activity'})).not.toBeInTheDocument();
  });
  it('does not recreate omitted contexts from an account role', async () => {
    const user = userEvent.setup();
    renderTopNav({ id: 9, username: 'alex', role: 'REFEREE', navigationCapabilities: { version: 1, workspaces: [] } });
    await user.click(screen.getByRole('button', { name: 'Shortcuts' }));
    expect(screen.queryByRole('menuitem', { name: 'Referee workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Parent Hub' })).not.toBeInTheDocument();
  });
  it("places Matches & Competitions in the primary navigation between My Club and Schedule", async () => {
    const user = userEvent.setup();
    renderTopNav({ id: 9, username: "alex", role: "PLAYER", navigationCapabilities: { version: 1, workspaces: [{ id: 'club.player', context: { type: 'club', id: 21, label: 'Academy' } }] } });

    const navigation = screen.getByRole("navigation");
    const links = within(navigation)
      .getAllByRole("link")
      .filter((link) =>
        [
          "Home",
          "Map",
          "Clubs",
          "My Club",
          "Matches & Competitions",
          "Schedule",
        ].includes(link.textContent?.trim() ?? ""),
      );
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      "Home",
      "Map",
      "Clubs",
      "My Club",
      "Matches & Competitions",
      "Schedule",
    ]);
    expect(
      within(navigation).getByRole("link", { name: "Matches & Competitions" }),
    ).toHaveAttribute("href", "/matches");
    await user.click(screen.getByRole("button", { name: "Shortcuts" }));
    expect(
      screen
        .getByRole("menu", { name: "Shortcuts" })
        .querySelector('a[href="/matches"]'),
    ).toBeNull();
  });

  it("supports keyboard opening, arrow navigation, Escape and focus return", async () => {
    const user = userEvent.setup();
    renderTopNav(null);
    const trigger = screen.getByRole("button", { name: "Shortcuts" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const first = screen.getByRole("menuitem", { name: "Store" });
    const last = screen.getByRole("menuitem", {
      name: "Roles",
    });
    expect(first).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Stadiums" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(first).toHaveFocus();
    await user.keyboard("{End}");
    expect(last).toHaveFocus();
    await user.keyboard("{Home}");
    expect(first).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("menu", { name: "Shortcuts" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(
      screen.getByRole("menuitem", { name: "Roles" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      screen.queryByRole("menu", { name: "Shortcuts" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "nav.useGeorgian" }),
    ).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "nav.signIn" })).toHaveFocus();
  });

  it("closes after choosing a destination and can reopen on that destination", async () => {
    const user = userEvent.setup();
    renderTopNav(null);
    await user.click(screen.getByRole("button", { name: "Shortcuts" }));
    await user.keyboard("{Enter}");
    expect(
      screen.queryByRole("menu", { name: "Shortcuts" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Shortcuts" }));
    await user.click(
      screen.getByRole("menuitem", { name: "Stadiums" }),
    );
    expect(
      screen.queryByRole("menu", { name: "Shortcuts" }),
    ).not.toBeInTheDocument();
  });

  it("gives guests a Shortcuts menu with released public destinations", async () => {
    const user = userEvent.setup();
    renderTopNav(null);

    const trigger = screen.getByRole("button", { name: "Shortcuts" });
    expect(trigger.className).not.toContain("hidden");
    await user.click(trigger);

    const menu = screen.getByRole("menu", { name: "Shortcuts" });
    const tournaments = within(menu).getByRole("menuitem", {
      name: "Stadiums",
    });
    const jobs = within(menu).getByRole("menuitem", {
      name: "Roles",
    });
    expect(tournaments).toHaveAttribute("href", "/stadiums");
    expect(jobs).toHaveAttribute("href", "/jobs");
    expect(
      within(menu).queryByRole("menuitem", { name: "Messages" }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: "Parent Hub" }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: "Payment demo" }),
    ).not.toBeInTheDocument();
  });

  it("keeps signed-in secondary destinations in the same Shortcuts menu", async () => {
    const user = userEvent.setup();
    renderTopNav({ id: 9, username: "alex", role: "PLAYER" });

    await user.click(screen.getByRole("button", { name: "Shortcuts" }));
    const menu = screen.getByRole("menu", { name: "Shortcuts" });
    expect(
      within(menu).getByRole("menuitem", { name: "Messages" }),
    ).toHaveAttribute("href", "/messages");
    expect(
      within(menu).getByRole("menuitem", { name: "Parent Hub" }),
    ).toHaveAttribute("href", "/parent");
    expect(
      within(menu).queryByRole("menuitem", { name: "Payment demo" }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Stadiums" }),
    ).toHaveAttribute("href", "/stadiums");
  });
});
