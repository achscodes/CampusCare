import { formatQueueTicket } from "./hsoQueueDisplaySnapshot";

/**
 * Standard spoken scripts for lobby / queue display (same wording everywhere).
 * @param {'nurse'|'physician'|'dentist'} stationKey
 * @param {unknown} queueNumber — raw queue number from appointment or waitlist row
 */
export function buildStationAnnouncement(stationKey, queueNumber) {
  const ticket = formatQueueTicket(queueNumber);
  if (ticket === "—") return "";

  switch (stationKey) {
    case "nurse":
      return `Now serving ticket number ${ticket} at the Nurse Station.`;
    case "physician":
      return `Patient with ticket number ${ticket}, please proceed to the Physician Station.`;
    case "dentist":
      return `Ticket number ${ticket}, please proceed to the Dentist Station.`;
    default:
      return `Now serving ticket number ${ticket} at the station.`;
  }
}
