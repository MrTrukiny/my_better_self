/** Devices that do part of the cleaning. `guidance` tells the AI how each one changes the work. */
export const HELPERS = [
  {
    id: "robot-vacuum",
    label: "Robot vacuum",
    guidance:
      "A robot vacuum cleans open floor areas regularly. Don't propose full vacuuming; propose only corners, edges, under furniture it can't reach, and emptying and cleaning the robot itself.",
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
