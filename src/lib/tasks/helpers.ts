/** Devices that do part of the cleaning. `guidance` tells the AI how each one changes the work. */
export const HELPERS = [
  {
    id: "robot-vacuum",
    label: "Robot vacuum",
    guidance:
      "A robot vacuum sweeps and mops the floors daily. Don't propose sweeping, vacuuming, or mopping, and propose no room tasks at all (no quick, deep, baseboard, wall, or switch passes) for the rooms it reaches. Propose one manual floor touch-up for the whole home every 3 to 4 days (tough stains, corners, edges, and under furniture it can't reach), and emptying and cleaning the robot itself. Rooms it can't reach, like balconies and terraces, still get manual quick and deep passes.",
  },
  {
    id: "dishwasher",
    label: "Dishwasher",
    guidance:
      "A dishwasher washes most dishes. Propose loading and unloading it, hand-washing what can't go in, and cleaning its filter now and then.",
  },
  {
    id: "washing-machine",
    label: "Washing machine",
    guidance:
      "A washing machine handles laundry. Propose loading it, hanging or folding, and occasionally cleaning the drum and the detergent drawer.",
  },
  {
    id: "dryer",
    label: "Dryer",
    guidance:
      "A dryer replaces hanging clothes to dry. Propose moving clothes into it, folding, and cleaning the lint filter.",
  },
  {
    id: "other",
    label: "Other",
    guidance:
      "The owner has another helper; read the home note for what it is and adjust the tasks it covers.",
  },
] as const;

export type HelperId = (typeof HELPERS)[number]["id"];

export const HELPER_IDS = HELPERS.map((helper) => helper.id) as [HelperId, ...HelperId[]];

export function getHelper(id: string) {
  return HELPERS.find((helper) => helper.id === id);
}
