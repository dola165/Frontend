import { useState } from 'react';
import { CalendarPlus, Plus, Users } from 'lucide-react';
import {
    Avatar, Badge, Button, ButtonLink, Chip, EmptyNote, Field, FixtureRow, GkRoot, List, ListRow, PageFrame, PageHeader,
    Panel, SearchInput, Section, StatTile,
} from './primitives';
import { Tabs } from './Tabs';

/** Living reference for the design system. Every redesigned screen is built from these parts. */
export default function DesignSystemPage() {
    const [tab, setTab] = useState<'players' | 'staff' | 'parents'>('players');
    const [age, setAge] = useState('U12');
    return (
        <GkRoot className="gk-page">
            <PageFrame>
                <PageHeader
                    crumbs={[{ label: 'FC Dinamo Tbilisi Academy', to: '/clubs/1' }, { label: 'Workspace' }]}
                    title="U16 Boys"
                    subtitle="11 players, two coaches, next session tomorrow at 18:00."
                    actions={<><Button><Users />Add players</Button><Button variant="primary"><CalendarPlus />Plan session</Button></>}
                />
                <div className="gk-stack">
                    <div className="gk-stats">
                        <StatTile label="Active players" value={86} to="/clubs/1/workspace?tab=players" />
                        <StatTile label="Trialists" value={5} hint="2 decisions due this week" tone="attention" />
                        <StatTile label="Staff" value={15} />
                        <StatTile label="Attendance, last 4 weeks" value="92%" tone="good" />
                    </div>
                    <div className="gk-grid gk-grid--split">
                        <Section title="Coming up" hint="Next 7 days" action={{ label: 'Full schedule', to: '/calendar' }}>
                            <Panel flush>
                                <List label="Coming up">
                                    <FixtureRow tone="training" time="18:00" day="Today" title="Possession and pressing" meta="U16 Boys, Pitch 2, Dinamo Academy Training Centre" trail={<Badge tone="info">Training</Badge>} to="/calendar" />
                                    <FixtureRow tone="match" time="11:00" day="Sat 17" title="FC Dinamo Tbilisi Academy v Saburtalo Youth FC" meta="GFF U16 Youth League, home" trail={<Badge tone="accent">League</Badge>} to="/calendar" />
                                    <FixtureRow tone="trial" time="16:00" day="Tue 20" title="U14 Girls open trial" meta="12 places, 4 booked" trail={<Badge tone="warning">Trial</Badge>} />
                                    <FixtureRow tone="match" time="2 – 1" day="Sun 4" title="Telavi Valley FC v FC Dinamo Tbilisi Academy" meta="Result confirmed" trail={<Badge>Played</Badge>} />
                                </List>
                            </Panel>
                        </Section>
                        <Section title="Needs you" action={{ label: 'Work queue', to: '/clubs/1/workspace?tab=actions' }}>
                            <Panel flush>
                                <List label="Needs you">
                                    <ListRow lead={<Avatar name="Beka Maisuradze" size={32} />} title="First aid certificate expired" meta="Beka Maisuradze, physiotherapist" trail={<Badge tone="danger">Overdue</Badge>} to="/" />
                                    <ListRow lead={<Avatar name="Ana Kapanadze" size={32} />} title="Membership application" meta="Ana Kapanadze for U14 Girls" trail={<Badge tone="warning">Decide</Badge>} to="/" />
                                    <ListRow lead={<Avatar name="Gabriel Chakvetadze" size={32} />} title="October membership unpaid" meta="Gabriel Chakvetadze, U12 Mixed" trail={<Badge>Due Fri</Badge>} to="/" />
                                </List>
                            </Panel>
                        </Section>
                    </div>
                    <Section title="People">
                        <Tabs label="People" value={tab} onChange={setTab} items={[{ id: 'players', label: 'Players', count: 11 }, { id: 'staff', label: 'Staff', count: 2 }, { id: 'parents', label: 'Parents', count: 9 }]} />
                        <div className="gk-row" style={{ flexWrap: 'wrap' }}>
                            <SearchInput placeholder="Search players or shirt number" aria-label="Search players" style={{ width: 320 }} />
                            <div className="gk-chips" role="group" aria-label="Age group">
                                {['U12', 'U14', 'U16', 'U18'].map(value => <Chip key={value} pressed={age === value} onClick={() => setAge(value)}>{value}</Chip>)}
                            </div>
                        </div>
                        <Panel flush>
                            <List label="Players">
                                <ListRow lead={<Avatar name="Saba Lomidze" size={36} />} title="Saba Lomidze" meta="Striker, 9, right foot" trail={<Badge tone="accent">Available</Badge>} to="/profile/30" />
                                <ListRow lead={<Avatar name="Nika Beridze" size={36} />} title="Nika Beridze" meta="Goalkeeper, 1" trail={<Badge tone="warning">Restricted</Badge>} to="/" />
                            </List>
                        </Panel>
                    </Section>
                    <div className="gk-grid gk-grid--split">
                        <Panel padded title="Session details" action={<Button size="sm" variant="ghost">Cancel</Button>}>
                            <div className="gk-stack gk-stack--tight">
                                <Field label="Title" htmlFor="ds-title"><input id="ds-title" className="gk-input" defaultValue="Possession and pressing" /></Field>
                                <Field label="Pitch" htmlFor="ds-pitch" hint="Pitches come from your club's venues."><select id="ds-pitch" className="gk-input"><option>Pitch 2</option></select></Field>
                                <Field label="Notes for families" htmlFor="ds-notes"><textarea id="ds-notes" className="gk-input" placeholder="What should players bring?" /></Field>
                                <div className="gk-row"><Button variant="primary">Save session</Button><Button variant="ghost">Discard</Button><Button variant="danger" size="sm">Delete</Button></div>
                            </div>
                        </Panel>
                        <Panel title="Empty states">
                            <EmptyNote title="No trials planned" action={<ButtonLink size="sm" to="/" variant="secondary"><Plus />Plan a trial</ButtonLink>}>Open a trial to let new players book a place.</EmptyNote>
                        </Panel>
                    </div>
                </div>
                <div style={{ height: 48 }} />
            </PageFrame>
        </GkRoot>
    );
}
