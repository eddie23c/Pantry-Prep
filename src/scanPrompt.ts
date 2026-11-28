// The photo-scan prompt and reply schema. Shared by the app (own-key scans) and the
// scan worker (worker/), so both ask Claude exactly the same thing. No browser APIs here.
import { CATALOGUE, GROUPS, KINDS, KIT } from "./data";

/** Frames pulled from one short video of a pile. Kept low: each frame costs about as much as a small photo. */
export const VIDEO_FRAMES = 6;

/** `video`: the images are frames from one video panning across a single pile. */
export function scanPrompt(opts: { video?: boolean } = {}): string {
  const cat = CATALOGUE.map((c) => `${c.id}: ${c.name} (${c.pack})`).join("\n");
  const kit = KIT.filter((k) => k.look).map((k) => `${k.id}: ${k.look}`).join("\n");
  const intro = opts.video
    ? [
        "These images are frames, in order, from one short video that pans slowly across a single pile, shelf or cupboard of a UK household's emergency food store. Items may be stacked, overlapping, on their side or partly hidden. Do two things.",
        "The same pack appears in several frames as the camera moves. Count each physical pack once across all the frames, never once per frame. Use whichever frame shows a label or date most clearly.",
      ]
    : ["Each photo shows a pile, shelf or cupboard of a UK household's emergency food store. Items may be stacked, overlapping, on their side or partly hidden. Do two things."];
  return [
    ...intro,
    "",
    "1. List every food or drink product you can see, one entry per distinct product (same product and pack size = one entry with a count).",
    "Work across each photo systematically (left to right, front to back) so nothing is missed. Read labels where you can; use the shape, colour and size of the pack where you cannot.",
    'If it is the same kind of product as a catalogue item below, set "id" to that catalogue id. Otherwise set "id" to "" and estimate nutrition for one pack from typical UK labels.',
    'Count every visible pack. If packs are stacked or partly hidden, give your best count and set confidence to "low". If you are unsure what a product is, still list it with your best guess and confidence "low".',
    'If a best-before or use-by date is clearly legible on a pack, set "bb" to it as YYYY-MM-DD. If only a month and year are shown (for example "BB END 03 2027" or "03/27"), use the last day of that month. If packs of one product show different dates, use the earliest. If no date is readable, set "bb" to "". Never guess a date.',
    opts.video
      ? "Do not list the same product twice because it appears in more than one frame."
      : "Do not list the same product twice if it appears in more than one photo from the same angle; if photos clearly show different shelves, count each.",
    "",
    "Catalogue:",
    cat,
    "",
    `"kind" is one of: ${Object.keys(KINDS).join(", ")}, or "" if none fits.`,
    `"group" is one of: ${Object.keys(GROUPS).join(", ")}.`,
    "",
    "2. List which of these emergency kit items are clearly visible. Only include an id if you can actually see that item:",
    kit,
  ].join("\n");
}

export const SCAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["food", "kit"],
  properties: {
    food: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "pack", "count", "kind", "group", "kcal", "protein", "fibre", "litres", "portions", "bb", "seen", "confidence"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          pack: { type: "string" },
          count: { type: "integer" },
          kind: { type: "string" },
          group: { type: "string", enum: Object.keys(GROUPS) },
          kcal: { type: "number" },
          protein: { type: "number" },
          fibre: { type: "number" },
          litres: { type: "number" },
          portions: { type: "number" },
          bb: { type: "string" },
          seen: { type: "integer" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    kit: { type: "array", items: { type: "string" } },
  },
};
