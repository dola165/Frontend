/** Open the group's saved training place, with only the caller's authorized participant selection. */
export function opportunityMapPath(groupId: number, playerId?: number) {
    const params = new URLSearchParams({ tab: 'groups', group: String(groupId), selected: String(groupId) });
    if (playerId) params.set('player', String(playerId));
    return `/world/opportunities?${params}`;
}
