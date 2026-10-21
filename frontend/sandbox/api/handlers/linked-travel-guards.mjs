import * as F from '../world-football.mjs';
import { planReadable, publicationOf } from './map-planning-access.mjs';
import { conflict, denied } from './workspace-context.mjs';

/** Resolve stored facts in both directions; request data never establishes or removes a connection. */
function connection(ctx, record) {
  const trip = record.kind === 'PASSENGER'
    ? ctx.state.records.find(row => row.id === record.related_record_id && row.kind === 'TRIP' && row.club_id === ctx.clubId)
    : record;
  if (!trip) return { error: conflict('The linked travel record is unavailable. Review the existing connection.') };
  const linked = F.plans.filter(plan => plan.trip_id === trip.id);
  if (!linked.length && trip.map_plan_id == null) return null; // Existing standalone workflow.
  const plan = linked[0];
  if (linked.length !== 1 || !plan || trip.map_plan_id != null && trip.map_plan_id !== plan.id
    || trip.club_id !== ctx.clubId || plan.club_id !== ctx.clubId || plan.squad_id !== trip.squad_id || record.squad_id !== trip.squad_id) {
    return { error: conflict('The linked journey connection cannot be confirmed for this club and squad.') };
  }
  return { plan };
}

/** Called only after the existing actor, revision and allowed-transition checks, before any write. */
export function validateLinkedTravelTransition(ctx, record, status, headers) {
  if (!(record.kind === 'PASSENGER' && status === 'BOARDED' || record.kind === 'TRIP' && ['READY', 'DEPARTED'].includes(status))) return null;
  const linked = connection(ctx, record);
  if (!linked) return null;
  if (linked.error) return linked.error;
  const { plan } = linked;
  if (!planReadable(plan, headers)) return denied();
  if (!Number.isSafeInteger(plan.published_version) || plan.published_version < 1 || plan.published_revision !== plan.revision || !publicationOf(plan)) {
    return conflict('Publish the current linked itinerary before boarding or departure.');
  }
  // Java also requires the connection fingerprint, canonical itinerary/passenger facts and
  // current permission/guardian evidence. The sandbox has no verified shared representation
  // for that contract yet; GOING, a client reference or a GRANTED label is not that evidence.
  return conflict('This linked journey’s travel checks and current permission cannot be confirmed. No status was changed.');
}

export function validateLinkedTravelEdit(ctx, record, headers) {
  if (record.kind !== 'TRIP') return null;
  const linked = connection(ctx, record);
  if (!linked) return null;
  if (linked.error) return linked.error;
  if (!planReadable(linked.plan, headers)) return denied();
  // Legacy departureAt/transport-choice fields cannot verify Java's linked itinerary mapping.
  return conflict('Edit this journey in its connected map plan. Linked itinerary fields cannot yet be verified here.');
}
