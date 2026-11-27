// Reference data: food catalogue, recipes, the Be Ready kit list and guidance links.
// Nutrition is a typical figure per pack from common UK labels (approximate).
// `portions` = Eatwell-style portions of the item's food group in one pack.

export type GroupId = "water" | "fruitveg" | "starchy" | "protein" | "dairy" | "oils" | "other";

export interface CatalogueItem {
  id: string;
  name: string;
  pack: string;
  group: GroupId;
  kind: string;
  kcal: number;
  protein: number;
  fibre: number;
  portions: number;
  litres?: number;
}

export interface Ingredient {
  /** Store-cupboard kinds that satisfy this ingredient (any brand). */
  k: string[];
  q: string;
  opt?: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  serves: number;
  cook: boolean;
  /** Extra litres of water needed to cook. */
  water: number;
  ings: Ingredient[];
  steps: string[];
}

export interface KitItem {
  id: string;
  label: string;
  /** Ticked automatically from the store totals. */
  auto?: "water" | "food";
  /** What a photo scan should look for. */
  look?: string;
  /** Only listed for homes with pets, or with a baby or toddler. */
  when?: "pets" | "baby";
}

// Typical figures per pack (approximate, from common UK supermarket labels).
// portions = Eatwell-style portions of the item's food group in one pack.
export const GROUPS: Record<GroupId, { label: string; perDay: number }> = {
  fruitveg: { label: "Fruit and veg", perDay: 5 },
  starchy:  { label: "Starchy carbs", perDay: 3 },
  protein:  { label: "Beans, fish, meat, nuts", perDay: 2 },
  dairy:    { label: "Dairy and alternatives", perDay: 2 },
  oils:     { label: "Oils and spreads", perDay: 0 },
  other:    { label: "Treats and extras", perDay: 0 },
  water:    { label: "Water", perDay: 0 }
};
export const GROUP_ORDER: GroupId[] = ["water", "fruitveg", "starchy", "protein", "dairy", "oils", "other"];

export const KINDS: Record<string, string> = {
  fish: "Tinned fish", meat: "Tinned meat", beans: "Baked beans", pulses: "Tinned pulses",
  veg: "Tinned veg", tomatoes: "Tinned tomatoes", potatoes: "Tinned potatoes", fruit: "Tinned fruit",
  driedfruit: "Dried fruit", nuts: "Nuts or seeds", nutbutter: "Nut butter", crackers: "Crackers or oatcakes",
  oats: "Oats", cereal: "Breakfast cereal", wraps: "Long-life wraps", pasta: "Dried pasta", rice: "Rice pouch",
  noodles: "Instant noodles", milk: "Long-life milk", pudding: "Rice pudding or custard", soup: "Tinned soup",
  oil: "Cooking oil", honey: "Honey or jam", snack: "Cereal bars or chocolate", water: "Bottled water", juice: "Long-life juice"
};

export const CATALOGUE: CatalogueItem[] = [
  { id: "water2", name: "Bottled water", pack: "2 L", group: "water", kind: "water", kcal: 0, protein: 0, fibre: 0, portions: 0, litres: 2 },
  { id: "water5", name: "Bottled water", pack: "5 L", group: "water", kind: "water", kcal: 0, protein: 0, fibre: 0, portions: 0, litres: 5 },
  { id: "tuna", name: "Tuna chunks", pack: "145 g tin", group: "protein", kind: "fish", kcal: 110, protein: 25, fibre: 0, portions: 1 },
  { id: "sardines", name: "Sardines in oil", pack: "120 g tin", group: "protein", kind: "fish", kcal: 260, protein: 23, fibre: 0, portions: 1 },
  { id: "mackerel", name: "Mackerel in tomato sauce", pack: "125 g tin", group: "protein", kind: "fish", kcal: 250, protein: 18, fibre: 0, portions: 1 },
  { id: "cornedbeef", name: "Corned beef", pack: "340 g tin", group: "protein", kind: "meat", kcal: 730, protein: 85, fibre: 0, portions: 4 },
  { id: "chicken", name: "Chicken breast in brine", pack: "200 g tin", group: "protein", kind: "meat", kcal: 280, protein: 40, fibre: 0, portions: 2 },
  { id: "bakedbeans", name: "Baked beans", pack: "415 g tin", group: "protein", kind: "beans", kcal: 340, protein: 20, fibre: 15, portions: 2 },
  { id: "chickpeas", name: "Chickpeas", pack: "400 g tin", group: "protein", kind: "pulses", kcal: 280, protein: 17, fibre: 12, portions: 2 },
  { id: "kidney", name: "Red kidney beans", pack: "400 g tin", group: "protein", kind: "pulses", kcal: 250, protein: 17, fibre: 15, portions: 2 },
  { id: "lentils", name: "Green lentils", pack: "400 g tin", group: "protein", kind: "pulses", kcal: 270, protein: 20, fibre: 10, portions: 2 },
  { id: "nuts", name: "Mixed nuts", pack: "200 g bag", group: "protein", kind: "nuts", kcal: 1200, protein: 40, fibre: 14, portions: 6 },
  { id: "pb", name: "Peanut butter", pack: "340 g jar", group: "protein", kind: "nutbutter", kcal: 2000, protein: 85, fibre: 23, portions: 10 },
  { id: "sweetcorn", name: "Sweetcorn", pack: "198 g tin", group: "fruitveg", kind: "veg", kcal: 130, protein: 4, fibre: 4, portions: 2 },
  { id: "peas", name: "Garden peas", pack: "300 g tin", group: "fruitveg", kind: "veg", kcal: 140, protein: 10, fibre: 10, portions: 2 },
  { id: "carrots", name: "Sliced carrots", pack: "300 g tin", group: "fruitveg", kind: "veg", kcal: 60, protein: 1, fibre: 5, portions: 2 },
  { id: "tomatoes", name: "Chopped tomatoes", pack: "400 g tin", group: "fruitveg", kind: "tomatoes", kcal: 80, protein: 4, fibre: 4, portions: 4 },
  { id: "peaches", name: "Peach slices in juice", pack: "410 g tin", group: "fruitveg", kind: "fruit", kcal: 190, protein: 2, fibre: 5, portions: 3 },
  { id: "fruitcocktail", name: "Fruit cocktail in juice", pack: "410 g tin", group: "fruitveg", kind: "fruit", kcal: 200, protein: 1, fibre: 4, portions: 3 },
  { id: "raisins", name: "Raisins", pack: "250 g bag", group: "fruitveg", kind: "driedfruit", kcal: 750, protein: 6, fibre: 8, portions: 8 },
  { id: "apricots", name: "Dried apricots", pack: "250 g bag", group: "fruitveg", kind: "driedfruit", kcal: 450, protein: 10, fibre: 15, portions: 8 },
  { id: "juice", name: "Orange juice, long-life", pack: "1 L carton", group: "fruitveg", kind: "juice", kcal: 450, protein: 6, fibre: 1, portions: 3 },
  { id: "vegsoup", name: "Vegetable soup", pack: "400 g tin", group: "fruitveg", kind: "soup", kcal: 180, protein: 6, fibre: 6, portions: 2 },
  { id: "tomsoup", name: "Tomato soup", pack: "400 g tin", group: "fruitveg", kind: "soup", kcal: 240, protein: 4, fibre: 2, portions: 1 },
  { id: "potatoes", name: "New potatoes", pack: "560 g tin", group: "starchy", kind: "potatoes", kcal: 230, protein: 6, fibre: 6, portions: 3 },
  { id: "oats", name: "Porridge oats", pack: "1 kg bag", group: "starchy", kind: "oats", kcal: 3700, protein: 110, fibre: 90, portions: 25 },
  { id: "oatcakes", name: "Oatcakes", pack: "250 g pack", group: "starchy", kind: "crackers", kcal: 1150, protein: 28, fibre: 20, portions: 8 },
  { id: "crackers", name: "Crackers", pack: "200 g pack", group: "starchy", kind: "crackers", kcal: 900, protein: 20, fibre: 6, portions: 6 },
  { id: "wheatbisks", name: "Wholewheat cereal biscuits", pack: "24 pack", group: "starchy", kind: "cereal", kcal: 1600, protein: 54, fibre: 45, portions: 12 },
  { id: "wraps", name: "Tortilla wraps, long-life", pack: "8 pack", group: "starchy", kind: "wraps", kcal: 1500, protein: 40, fibre: 15, portions: 8 },
  { id: "pasta", name: "Dried pasta", pack: "500 g bag", group: "starchy", kind: "pasta", kcal: 1750, protein: 60, fibre: 15, portions: 6 },
  { id: "ricepouch", name: "Microwave rice pouch", pack: "250 g pouch", group: "starchy", kind: "rice", kcal: 400, protein: 8, fibre: 2, portions: 2 },
  { id: "noodles", name: "Instant noodles", pack: "85 g pack", group: "starchy", kind: "noodles", kcal: 380, protein: 8, fibre: 2, portions: 1 },
  { id: "uht", name: "UHT semi-skimmed milk", pack: "1 L carton", group: "dairy", kind: "milk", kcal: 460, protein: 34, fibre: 0, portions: 5 },
  { id: "oatdrink", name: "Oat drink, long-life", pack: "1 L carton", group: "dairy", kind: "milk", kcal: 450, protein: 10, fibre: 8, portions: 5 },
  { id: "milkpowder", name: "Dried skimmed milk", pack: "340 g tin", group: "dairy", kind: "milk", kcal: 1200, protein: 120, fibre: 0, portions: 17 },
  { id: "ricepud", name: "Rice pudding", pack: "400 g tin", group: "dairy", kind: "pudding", kcal: 360, protein: 13, fibre: 1, portions: 2 },
  { id: "custard", name: "Custard", pack: "400 g tin", group: "dairy", kind: "pudding", kcal: 400, protein: 12, fibre: 0, portions: 2 },
  { id: "oil", name: "Olive oil", pack: "500 ml bottle", group: "oils", kind: "oil", kcal: 4100, protein: 0, fibre: 0, portions: 0 },
  { id: "honey", name: "Honey", pack: "340 g jar", group: "other", kind: "honey", kcal: 1100, protein: 1, fibre: 0, portions: 0 },
  { id: "jam", name: "Strawberry jam", pack: "340 g jar", group: "other", kind: "honey", kcal: 850, protein: 1, fibre: 2, portions: 0 },
  { id: "bars", name: "Cereal bars", pack: "6 pack", group: "other", kind: "snack", kcal: 800, protein: 12, fibre: 10, portions: 0 },
  { id: "choc", name: "Dark chocolate", pack: "100 g bar", group: "other", kind: "snack", kcal: 550, protein: 8, fibre: 10, portions: 0 }
];
export const CAT: Record<string, CatalogueItem> = Object.fromEntries(CATALOGUE.map((c) => [c.id, c]));

// Recipes: ingredients name store-cupboard kinds, so any brand matches.
export const RECIPES: Recipe[] = [
  { id: "r1", title: "Tuna and sweetcorn crackers", serves: 2, cook: false, water: 0,
    ings: [{ k: ["fish"], q: "1 tin" }, { k: ["veg"], q: "1 small tin sweetcorn" }, { k: ["crackers"], q: "8 crackers" }, { k: ["oil"], q: "a drizzle", opt: true }],
    steps: ["Drain the fish and the sweetcorn.", "Mix them in a bowl with a drizzle of oil if you have it.", "Pile onto crackers and eat straight away."] },
  { id: "r2", title: "Three-bean chilli salad", serves: 3, cook: false, water: 0,
    ings: [{ k: ["pulses"], q: "2 tins (kidney beans, chickpeas)" }, { k: ["tomatoes"], q: "1 tin" }, { k: ["veg"], q: "1 tin sweetcorn" }, { k: ["oil"], q: "1 tbsp", opt: true }],
    steps: ["Drain and rinse the beans with a little bottled water, or skip rinsing to save water.", "Stir in the chopped tomatoes and drained sweetcorn.", "Season with any dried herbs or chilli you have and add oil.", "Serve cold, with crackers or wraps if you have them."] },
  { id: "r3", title: "Chickpea and tomato wraps", serves: 2, cook: false, water: 0,
    ings: [{ k: ["pulses"], q: "1 tin chickpeas" }, { k: ["tomatoes"], q: "half a tin" }, { k: ["wraps"], q: "4 wraps" }],
    steps: ["Drain the chickpeas and crush them roughly with a fork.", "Stir in the chopped tomatoes.", "Spoon into wraps, roll up and eat."] },
  { id: "r4", title: "Overnight oats with dried fruit", serves: 2, cook: false, water: 0,
    ings: [{ k: ["oats"], q: "100 g" }, { k: ["milk"], q: "300 ml" }, { k: ["driedfruit"], q: "2 handfuls" }, { k: ["honey"], q: "1 tsp", opt: true }],
    steps: ["Mix oats and long-life milk (or made-up milk powder) in a bowl or jar.", "Stir in the dried fruit.", "Cover and leave for at least 2 hours or overnight.", "Sweeten with honey or jam if you like."] },
  { id: "r5", title: "Peanut butter oatcakes and apricots", serves: 2, cook: false, water: 0,
    ings: [{ k: ["nutbutter"], q: "4 tbsp" }, { k: ["crackers"], q: "8 oatcakes" }, { k: ["driedfruit"], q: "a handful" }, { k: ["honey"], q: "a drizzle", opt: true }],
    steps: ["Spread peanut butter on the oatcakes.", "Top with chopped dried fruit and a little honey.", "A filling, high-energy meal with no cooking."] },
  { id: "r6", title: "Mackerel potato salad", serves: 2, cook: false, water: 0,
    ings: [{ k: ["potatoes"], q: "1 tin" }, { k: ["fish"], q: "1 tin mackerel or sardines" }, { k: ["veg"], q: "1 tin peas", opt: true }],
    steps: ["Drain the potatoes and cut into chunks. Tinned potatoes are already cooked.", "Flake the fish over the top with its sauce.", "Add drained peas if you have them and mix gently."] },
  { id: "r7", title: "Corned beef hash", serves: 3, cook: true, water: 0,
    ings: [{ k: ["meat"], q: "1 tin corned beef" }, { k: ["potatoes"], q: "1 tin" }, { k: ["oil"], q: "1 tbsp" }, { k: ["beans"], q: "1 tin, to serve", opt: true }],
    steps: ["Heat the oil in a pan on a camping stove.", "Add drained, chopped potatoes and fry until golden.", "Crumble in the corned beef and fry until crisp at the edges.", "Serve with baked beans, warm or cold."] },
  { id: "r8", title: "Sardines and tomatoes on crackers", serves: 2, cook: false, water: 0,
    ings: [{ k: ["fish"], q: "1 tin sardines" }, { k: ["tomatoes"], q: "half a tin" }, { k: ["crackers"], q: "8 crackers" }],
    steps: ["Mash the sardines with their oil.", "Spoon on the chopped tomatoes.", "Serve on crackers or oatcakes."] },
  { id: "r9", title: "Hearty lentil soup", serves: 3, cook: false, water: 0,
    ings: [{ k: ["soup"], q: "2 tins" }, { k: ["pulses"], q: "1 tin lentils" }, { k: ["veg"], q: "1 tin carrots or peas", opt: true }],
    steps: ["Tip the soup into a pan or bowl.", "Add drained lentils and any tinned veg.", "Warm on a stove if you can. Tinned soup is safe to eat cold."] },
  { id: "r10", title: "Fruit and custard pots", serves: 3, cook: false, water: 0,
    ings: [{ k: ["fruit"], q: "1 tin" }, { k: ["pudding"], q: "1 tin custard" }],
    steps: ["Drain the fruit, keeping the juice to drink.", "Layer fruit and custard in cups.", "Eat cold."] },
  { id: "r11", title: "Rice pudding with peaches", serves: 2, cook: false, water: 0,
    ings: [{ k: ["pudding"], q: "1 tin rice pudding" }, { k: ["fruit"], q: "1 tin peaches" }, { k: ["nuts"], q: "a handful, chopped", opt: true }],
    steps: ["Spoon rice pudding into bowls.", "Top with peach slices and a little juice.", "Scatter chopped nuts on top if you have them."] },
  { id: "r12", title: "Bean and corn tortillas", serves: 2, cook: false, water: 0,
    ings: [{ k: ["beans"], q: "1 tin" }, { k: ["veg"], q: "1 tin sweetcorn" }, { k: ["wraps"], q: "4 wraps" }],
    steps: ["Mix the beans and drained sweetcorn.", "Spread down the middle of each wrap.", "Roll up. Good cold, better warmed in a dry pan."] },
  { id: "r13", title: "Trail mix energy bags", serves: 4, cook: false, water: 0,
    ings: [{ k: ["nuts"], q: "200 g" }, { k: ["driedfruit"], q: "200 g" }, { k: ["snack"], q: "a bar of chocolate, chopped", opt: true }],
    steps: ["Mix nuts and dried fruit in a bowl.", "Add chopped chocolate if you have it.", "Split into four portions for snacks between meals."] },
  { id: "r14", title: "Cereal biscuits with fruit", serves: 2, cook: false, water: 0,
    ings: [{ k: ["cereal"], q: "4 biscuits" }, { k: ["milk"], q: "300 ml" }, { k: ["fruit", "driedfruit"], q: "half a tin or a handful" }],
    steps: ["Crumble the cereal biscuits into bowls.", "Pour over long-life milk.", "Top with tinned or dried fruit."] },
  { id: "r15", title: "Chicken and pea pasta", serves: 3, cook: true, water: 1,
    ings: [{ k: ["pasta"], q: "250 g" }, { k: ["meat"], q: "1 tin chicken" }, { k: ["veg"], q: "1 tin peas" }, { k: ["oil"], q: "1 tbsp" }],
    steps: ["Boil the pasta in about 1 litre of water on a camping stove.", "Drain, keeping a splash of the water.", "Stir in drained chicken, peas and oil.", "Warm through for 2 minutes and serve."] },
  { id: "r16", title: "Noodles with peanut sauce", serves: 2, cook: true, water: 0.6,
    ings: [{ k: ["noodles"], q: "2 packs" }, { k: ["nutbutter"], q: "2 tbsp" }, { k: ["veg"], q: "1 tin sweetcorn or peas", opt: true }],
    steps: ["Cook the noodles in about 600 ml of boiling water.", "Stir the peanut butter into a little of the hot water to make a sauce.", "Drain the noodles, toss in the sauce and add any veg."] }
];

export const EXAMPLE: [string, number][] = [
  ["water5", 3], ["water2", 2], ["tuna", 3], ["bakedbeans", 4], ["chickpeas", 2], ["sweetcorn", 2],
  ["tomatoes", 2], ["peaches", 1], ["crackers", 2], ["oats", 1], ["uht", 2], ["pb", 1], ["potatoes", 1], ["vegsoup", 2]
];

export const KIT: KitItem[] = [
  { id: "water", label: "Bottled water, 3 L per person per day", auto: "water" },
  { id: "food", label: "Non-perishable food for every day", auto: "food" },
  { id: "torch", label: "Torch (battery or wind-up)", look: "torch, flashlight or head torch" },
  { id: "batteries", label: "Spare batteries", look: "packs of AA, AAA or other batteries" },
  { id: "radio", label: "Battery or wind-up FM radio", look: "battery, solar or wind-up radio" },
  { id: "powerbank", label: "Charged power bank", look: "portable power bank or battery pack for phones" },
  { id: "cash", label: "Cash and cards", look: "banknotes, coins or a wallet set aside" },
  { id: "documents", label: "Copies of ID and key documents", look: "document wallet, folder or waterproof pouch of papers" },
  { id: "firstaid", label: "First aid kit", look: "first aid kit or box" },
  { id: "medication", label: "Essential medication", look: "medicine boxes, tablets or prescription bags" },
  { id: "warmth", label: "Blankets, sleeping bags, warm clothes", look: "blankets, sleeping bags, foil blankets or warm clothing" },
  { id: "hygiene", label: "Hand sanitiser, wet wipes, toiletries", look: "hand sanitiser, wet wipes, toilet roll or toiletries" },
  { id: "baby", label: "Baby formula, nappies and wipes", look: "baby formula, nappies or baby wipes", when: "baby" },
  { id: "pets", label: "Pet food and water", look: "pet food tins, bags or pouches", when: "pets" }
];
export const LINKS: [url: string, title: string, note: string][] = [
  ["https://beready.campaign.gov.uk/be-ready-for-emergencies/", "Be Ready: be ready for emergencies", "UK Government. The 3-day checklist for every household."],
  ["https://beready.campaign.gov.uk/wp-content/uploads/sites/252/2026/10/Be-Ready-Checklist_English.pdf", "Be Ready checklist (PDF)", "The same list, ready to print."],
  ["https://beready.campaign.gov.uk/be-informed-about-hazards/water-supply-interruptions-or-outages/", "Be Ready: water supply interruptions", "Extra water for formula, medical devices and pets."],
  ["https://www.gov.uk/government/news/households-encouraged-to-take-small-simple-steps-to-stay-prepared-in-an-emergency", "GOV.UK: small, simple steps", "Campaign announcement, 22 October 2026."],
  ["https://redcross.org.uk/get-help/prepare-for-emergencies/prepare-an-emergency-kit", "British Red Cross: emergency kit", "Home and car kit lists."],
  ["https://www.nidirect.gov.uk/articles/household-emergency-kit", "nidirect: household emergency kit", "Northern Ireland guidance and contacts."],
  ["https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/the-eatwell-guide/", "NHS: the Eatwell Guide", "The food groups behind the balance check."]
];

/** Shown in feedback so reports can be matched to a release. Keep in step with package.json. */
export const APP_VERSION = "0.1.0";

/** Where beta feedback goes. Leave the email empty to use a GitHub issue instead. */
export const FEEDBACK = {
  email: "",
  issues: "https://github.com/eddie23c/Pantry-Prep/issues/new",
};
