import type { ItemTypeId } from "@/lib/inventory/item-types";

/**
 * What cleaning each item type needs and roughly how often. Sent to the model for the types in the
 * home, so its proposals follow the household's standards instead of generic defaults.
 */
export const CLEANING_GUIDE: Record<ItemTypeId, string> = {
  window: "Wipe the glass inside every 14 days; clean frames, tracks, and sills every 30 days.",
  door: "Wipe handles and switches around it every 7 days; wipe the whole door every 30 days.",
  mirror: "Wipe the glass every 7 days (every 3 days in bathrooms).",
  floor: "Sweep or vacuum and mop; the frequency depends on the room and on helpers.",
  rug: "Vacuum every 7 days; deep clean every 90 days.",
  "light-fixture": "Dust every 30 days.",
  shelf: "Dust each shelf and the objects on it every 7 days.",
  desk: "Dust and wipe the surface every 7 days.",
  table: "Wipe the surface after use (routine); clean the legs and underside every 30 days.",
  sofa: "Vacuum the seats, cushions, and crevices every 7 days; spot-clean the fabric every 90 days.",
  bed: "Make it daily (routine); change the sheets every 7 days; vacuum under it every 14 days.",
  closet:
    "Dust the shelves, the rod, and the top every 14 days; empty and wipe the inside every 90 days.",
  cabinet: "Dust the outside every 7 days; empty and wipe the inside every 60 days.",
  countertop: "Wipe after cooking (routine); degrease and disinfect every 7 days.",
  appliance:
    "Wipe the outside every 7 days; clean the inside following the kind of appliance its name suggests.",
  sink: "Scrub the basin and faucet every 3 days; descale and clean the drain every 30 days.",
  toilet:
    "Light clean (bowl, seat, and lid) every 3 days; deep clean (base, behind, and tank) every 10 days.",
  shower: "Wipe walls and glass every 7 days; scrub grout, drain, and fixtures every 14 days.",
  bathtub: "Rinse and wipe every 7 days; scrub and descale every 14 days.",
  other: "Infer what it is from its name and note, and plan the cleaning it needs.",
};
