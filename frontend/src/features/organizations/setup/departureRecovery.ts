export interface OrganizationDeparture { requestId: string; snapshot: string }
interface StoredDeparture { actorId: number; organizationId: number; command: OrganizationDeparture }
const key = (actorId: number, organizationId: number) => `organization-departure:${actorId}:${organizationId}`;
export function loadDeparture(actorId: number | null, organizationId: number): OrganizationDeparture | null {
  if (actorId === null) return null;
  try {
    const raw = sessionStorage.getItem(key(actorId, organizationId));
    if (!raw) return null;
    const record = JSON.parse(raw) as StoredDeparture;
    return record.actorId === actorId && record.organizationId === organizationId
      && /^[0-9a-f]{64}$/.test(record.command?.snapshot ?? '')
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.command?.requestId ?? '') ? record.command : null;
  } catch { return null; }
}
export function storeDeparture(actorId: number, organizationId: number, command: OrganizationDeparture) {
  sessionStorage.setItem(key(actorId, organizationId), JSON.stringify({ actorId, organizationId, command } satisfies StoredDeparture));
}
export function clearDeparture(actorId: number, organizationId: number) { sessionStorage.removeItem(key(actorId, organizationId)); }
