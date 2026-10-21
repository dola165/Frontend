import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CreditCard, Pencil, Trash2 } from 'lucide-react';
import { Avatar, Badge, Button, Field, Panel, Section } from '../../../design/primitives';
import { PlayerCard } from './PlayerCard';
import type { SquadRosterGroup, SquadRosterPlayer } from '../../../components/squads/SquadRosterTable';
import type { UpdateRosterPlayer } from '../../../components/squads/squadRosterPresentation';
import { squadLabel } from '../../../components/squads/squadLabels';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import './squads.css';

export type RosterSort = 'number' | 'name' | 'age';
export interface RosterActions {
    onOpenPlayer?: (player: SquadRosterPlayer) => void; onRemovePlayer: (userId: number, name: string) => void; onUpdatePlayer: UpdateRosterPlayer;
    removingPlayerId: number | null; cardUserIds: Set<number>; onEditCard: (userId: number) => void;
}

const TRIAL_LIMIT_DAYS = 14;
const trialDays = (joinedAt?: string | null) => joinedAt ? Math.max(0, Math.floor((Date.now() - new Date(joinedAt).getTime()) / 86_400_000)) : null;
const compare = (sort: RosterSort) => (a: SquadRosterPlayer, b: SquadRosterPlayer) => {
    const x = a[sort], y = b[sort];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
};

/** Status the coach needs at a glance: trial length, a card without an account, a squad role such as captain. */
function PlayerBadges({ player }: { player: SquadRosterPlayer }) {
    const { t } = useTranslation();
    const days = player.status === 'TRIALIST' ? trialDays(player.joinedAt) : null;
    const role = player.squadRole && !['PLAYER', 'TRIALIST'].includes(player.squadRole) && player.squadRole !== player.position ? squadLabel(player.squadRole, t) : null;
    return <>
        {role && <Badge tone="accent">{role}</Badge>}
        {player.status === 'TRIALIST' && <Badge tone={days !== null && days > TRIAL_LIMIT_DAYS ? 'danger' : 'warning'}>{days === null ? t('squadDesign.trialist', { defaultValue: 'Trialist' }) : t('squadDesign.roster.trialDays', { defaultValue: 'Trial · day {{count}}', count: days })}</Badge>}
        {player.isRegistered === false && <Badge>{t('squadDesign.roster.cardOnly', { defaultValue: 'Player card' })}</Badge>}
    </>;
}

/** Shirt number and squad role, edited in place under the player. */
function PlayerEditor({ player, onSave, onClose }: { player: SquadRosterPlayer; onSave: UpdateRosterPlayer; onClose: () => void }) {
    const { t } = useTranslation();
    const [number, setNumber] = useState(String(player.number ?? '')), [role, setRole] = useState(player.squadRole || 'PLAYER');
    const [saving, setSaving] = useState(false), [error, setError] = useState('');
    const lock = useRef(false);
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (lock.current) return;
        const parsed = number.trim() ? Number(number) : null;
        if ((parsed != null && (!Number.isInteger(parsed) || parsed < 1 || parsed > 99)) || (player.number != null && parsed == null)) { setError(t('squadDesign.roster.numberHint', { defaultValue: 'Use a shirt number from 1 to 99.' })); return; }
        lock.current = true; setSaving(true); setError('');
        try { await onSave(player.id, parsed, role); onClose(); }
        catch { setError(t('squadDesign.roster.saveFailed', { defaultValue: 'Could not save these changes. Please try again.' })); }
        finally { lock.current = false; setSaving(false); }
    };
    const roles = ['PLAYER', 'CAPTAIN', 'TRIALIST'];
    return <form className="sq-editor" onSubmit={event => void submit(event)} aria-label={t('squadDesign.roster.editPlayer', { defaultValue: 'Edit {{name}}', name: player.name })}>
        <Field label={t('squadDesign.roster.shirtNumber', { defaultValue: 'Shirt number' })} htmlFor={`sq-number-${player.id}`} error={error || undefined}>
            <input id={`sq-number-${player.id}`} className="gk-input" type="number" min={1} max={99} required={player.number != null} value={number} onChange={event => setNumber(event.target.value)} disabled={saving} autoFocus />
        </Field>
        <Field label={t('squadDesign.roster.squadRole', { defaultValue: 'Squad role' })} htmlFor={`sq-role-${player.id}`}>
            <select id={`sq-role-${player.id}`} className="gk-input" value={role} onChange={event => setRole(event.target.value)} disabled={saving}>
                {!roles.includes(role) && <option value={role}>{squadLabel(role, t)}</option>}
                {roles.map(value => <option key={value} value={value}>{squadLabel(value, t)}</option>)}
            </select>
        </Field>
        <div className="gk-row sq-editor__actions">
            <Button type="submit" variant="primary" disabled={saving}>{saving ? t('squadDesign.roster.saving', { defaultValue: 'Saving…' }) : t('squadDesign.roster.save', { defaultValue: 'Save changes' })}</Button>
            <Button variant="ghost" onClick={onClose} disabled={saving}>{t('squadDesign.roster.cancel', { defaultValue: 'Cancel' })}</Button>
        </div>
    </form>;
}

/** Edit, player card and remove, each a 44px icon button named for the player. */
function RowActions({ player, actions, editing, onEdit }: { player: SquadRosterPlayer; actions: RosterActions; editing: boolean; onEdit: () => void }) {
    const { t } = useTranslation();
    return <span className="sq-row-actions">
        <Button variant="ghost" iconOnly aria-expanded={editing} aria-label={t('squadDesign.roster.editPlayer', { defaultValue: 'Edit {{name}}', name: player.name })} title={t('squadDesign.roster.edit', { defaultValue: 'Edit' })} onClick={onEdit}><Pencil aria-hidden="true" /></Button>
        {actions.cardUserIds.has(player.id) && <Button variant="ghost" iconOnly aria-label={t('squadDesign.roster.editCard', { defaultValue: 'Edit player card for {{name}}', name: player.name })} onClick={() => actions.onEditCard(player.id)}><CreditCard aria-hidden="true" /></Button>}
        <Button variant="ghost" iconOnly className="sq-remove" disabled={actions.removingPlayerId === player.id} aria-label={t('squadDesign.roster.removePlayer', { defaultValue: 'Remove {{name}} from squad', name: player.name })} onClick={() => actions.onRemovePlayer(player.id, player.name)}><Trash2 aria-hidden="true" /></Button>
    </span>;
}

/** The player's name: opens their notes and tools in the workspace, or their public profile. */
function PlayerName({ player, onOpen }: { player: SquadRosterPlayer; onOpen?: (player: SquadRosterPlayer) => void }) {
    const { t } = useTranslation();
    if (onOpen) return <button type="button" className="sq-name" onClick={() => onOpen(player)} aria-label={t('squadDesign.roster.openPlayer', { defaultValue: 'Open {{name}}: notes and tools', name: player.name })}>{player.name}</button>;
    if (player.isRegistered === false) return <span className="sq-name">{player.name}</span>;
    return <Link className="sq-name" to={`/profile/${player.id}`}>{player.name}</Link>;
}

/**
 * A squad's players grouped by position, as rows (number, player, badges, actions) or as cards.
 * Every management action of the old roster stays: open a player, edit number and role, edit a player card, remove.
 */
export function SquadRosterList({ groups, cardView, sort, actions }: { groups: SquadRosterGroup[]; cardView: boolean; sort: RosterSort | null; actions: RosterActions }) {
    const { t } = useTranslation();
    const [editing, setEditing] = useState<number | null>(null);
    const sorted = useMemo(() => groups.filter(group => group.players.length).map(group => ({ ...group, players: sort ? [...group.players].sort(compare(sort)) : group.players })), [groups, sort]);
    const facts = (player: SquadRosterPlayer) => [squadLabel(player.position, t), player.age != null ? t('squadDesign.roster.ageValue', { defaultValue: 'Age {{age}}', age: player.age }) : null].filter(Boolean).join(' · ');
    const editor = (player: SquadRosterPlayer): ReactNode => editing === player.id && <PlayerEditor player={player} onSave={actions.onUpdatePlayer} onClose={() => setEditing(null)} />;
    const toggle = (player: SquadRosterPlayer) => setEditing(value => value === player.id ? null : player.id);

    return <div className="sq-roster">{sorted.map(group => <Section key={group.label} title={squadLabel(group.label, t)} hint={String(group.players.length)}>
        {cardView ? <ul className="pc-grid" aria-label={squadLabel(group.label, t)}>{group.players.map(player => <li key={player.id}>
            <PlayerCard player={player} onOpen={actions.onOpenPlayer ? () => actions.onOpenPlayer!(player) : undefined}
                signs={player.isRegistered === false ? <span className="pc-sign">{t('squadDesign.roster.cardOnly', { defaultValue: 'Player card' })}</span> : undefined}
                actions={<RowActions player={player} actions={actions} editing={editing === player.id} onEdit={() => toggle(player)} />}>{editor(player)}</PlayerCard>
        </li>)}</ul>
            : <Panel flush><ul className="gk-list" aria-label={squadLabel(group.label, t)}>{group.players.map(player => <li key={player.id}>
                <div className="gk-list-row sq-row">
                    <span className="sq-row__number gk-num" aria-label={t('squadDesign.roster.shirtNumber', { defaultValue: 'Shirt number' })}>{player.number ?? '–'}</span>
                    <Avatar src={resolveMediaUrl(player.photoUrl) || null} name={player.name} size={36} />
                    <span className="gk-list-row__main"><PlayerName player={player} onOpen={actions.onOpenPlayer} /><span className="gk-list-row__meta">{facts(player)}</span></span>
                    <span className="sq-row__badges"><PlayerBadges player={player} /></span>
                    <RowActions player={player} actions={actions} editing={editing === player.id} onEdit={() => toggle(player)} />
                </div>
                {editor(player)}
            </li>)}</ul></Panel>}
    </Section>)}</div>;
}
