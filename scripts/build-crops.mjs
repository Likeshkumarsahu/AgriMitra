/**
 * AgriMitra — build data/crops.json (22 crops × 15-section structured guides).
 * Usage: node scripts/build-crops.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { CROPS } from "./cropProfiles.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const SECTIONS = [
  ["crop-basics", "Crop Basics & Plant Biology"],
  ["climate", "Climate Requirements"],
  ["soil", "Soil Requirements"],
  ["land-preparation", "Land Preparation"],
  ["seed-planting-material", "Seed & Planting Material"],
  ["sowing-planting", "Sowing & Planting"],
  ["water-irrigation", "Water & Irrigation Management"],
  ["nutrients", "Nutrient Management"],
  ["weeds", "Weed Management"],
  ["pests", "Pest Management"],
  ["diseases", "Disease Management"],
  ["growth-management", "Plant Growth Management"],
  ["monitoring", "Crop Monitoring"],
  ["harvest-post-harvest", "Harvest & Post-harvest"],
  ["economics-marketing", "Economics & Marketing"],
];

function units(range, suffix = "") {
  const [lo, hi] = range;
  return lo === hi ? `${lo}${suffix}` : `${lo}–${hi}${suffix}`;
}

function buildDetails(c) {
  const cond = c.conditions;
  const [t0, t1] = cond.temp;
  const [h0, h1] = cond.humidity;
  const [p0, p1] = cond.ph;

  const details = {
    "crop-basics":
      `**${c.name} (${c.nameHi})** is a ${c.categoryName.toLowerCase()} belonging to the family **${c.family}** (scientific name *${c.scientificName}*). ` +
      `It completes its crop cycle in about **${c.duration}**. Growth stages follow the sequence germination → seedling → vegetative growth → ` +
      `reproductive phase (flowering/fruiting) → maturity. Main growing states: **${c.states.join(", ")}**. ` +
      `Popular varieties/ hybrids: **${c.varieties}**.`,
    climate:
      `**${c.name}** thrives in a ${c.climate} climate with ${c.sunlight.toLowerCase()} conditions. ` +
      `Ideal temperature range is **${t0}–${t1} °C**, relative humidity **${h0}–${h1}%**, and annual rainfall ` +
      `**${units(cond.rainfall, " mm")}**. Extreme conditions (frost, heat waves, hail or waterlogging) at sensitive stages lower yield and quality.`,
    soil:
      `The crop grows best in **${c.soilType.toLowerCase()}**. Suitable soil pH ranges from **${p0}–${p1}**, ` +
      `electrical conductivity (EC) below **${c.ec}**, and organic matter of about **${c.om}**. ` +
      `Adequate soil depth, good drainage, and balanced nutrient status of the soil are prerequisites for a healthy stand.`,
    "land-preparation":
      `Land preparation includes **${c.landPrep.toLowerCase()}**. ` +
      `A well-tilled but properly levelled seedbed ensures uniform germination and stand establishment; drainage channels protect ` +
      `against waterlogging in heavy soil and during monsoons.`,
    "seed-planting-material":
      `Use certified material: **${c.seedQuality}**. Seed/variant rate for main season is **${c.seedRate}**. ` +
      `Treat seed against soil-borne diseases and, where applicable, inoculate with beneficial rhizobia/PSB before sowing for legumes.`,
    "sowing-planting":
      `**Sowing/planting season:** ${c.sowingTime}. Optimum sowing depth **${c.depth}**, spacing **${c.spacing}**, ` +
      `maintaining a plant population of **${c.population}**. Correct spacing balances canopy (sunlight) and aeration. ` +
      `Depth and timing should follow regional package-of-practice recommendations.`,
    "water-irrigation":
      `Irrigation method: **${c.irrigation.method}**. Critical stages — ${c.irrigation.stages}. ` +
      `Typical frequency/quantity: **${c.irrigation.no}**. ` +
      `Do not let the crop suffer at the most sensitive growth phases (${c.irrigation.stages.toLowerCase()}); avoid both drought and waterlogging.`,
    nutrients:
      `Nutrient schedule: **${c.nutrition.npk}** together with **${c.nutrition.manure.toLowerCase()}** and ` +
      `micronutrients **${c.nutrition.micronutrients.toLowerCase()}**. ` +
      `Apply nutrients in splits as per ${c.nutrition.split.toLowerCase()} for efficient uptake; ` +
      `for legumes the fixed nitrogen reduces external nitrogen requirement.`,
    weeds: `**${c.weeds} Control follows an integrated approach: **${c.herbControl}**. ` +
      `Weed-free first 30–60 days (critical period) gives maximum yield advantage.`,
    pests:
      `Major pests: **${c.pests}** Integrated Pest Management (IPM): monitor with traps/visual scouting, conserve natural enemies, ` +
      `and apply need-based pesticides at economic threshold levels.`,
    diseases: `Common diseases: **${c.diseases}** Prevention: disease-free seed/planting material, sanitation, resistant varieties, ` +
      `need-based fungicides/bio-control and balanced irrigation to keep foliage dry.`,
    "growth-management":
      `Plant-growth management includes **${c.growthMgt.toLowerCase()}**. ` +
      `Remove off-types/diseased plants (roguing), avoid over-crowding, and provide support (staking/training) suited to the crop habit.`,
    monitoring:
      `Monitor periodically: **${c.monitoring}** Record observations stage-wise and act early on ` +
      `pest/disease thresholds rather than after damage becomes visible.`,
    "harvest-post-harvest":
      `Harvest at **${c.harvest.maturity.toLowerCase()}**. **${c.harvest.method}**; expected yield about **${c.harvest.yield}**. ` +
      `Handle produce carefully to avoid bruising; dry to safe moisture and **${c.harvest.store}**.`,
    "economics-marketing":
      `Typical input cost: **${c.economics.cost}**. Prevailing market price **${c.economics.price}**; expected net ` +
      `**${c.economics.profit}**. **${c.economics.market}**`,
  };

  return SECTIONS.map(([id, title]) => ({ id, title, content: details[id] }));
}

const crops = CROPS.map((c) => {
  const cond = c.conditions;
  return {
    id: c.id,
    slug: c.id,
    name: c.name,
    nameHi: c.nameHi,
    emoji: c.emoji,
    scientificName: c.scientificName,
    family: c.family,
    category: c.category,
    categoryName: c.categoryName,
    states: c.states,
    duration: c.duration,
    image: null,
    conditions: {
      n: { min: cond.n[0], max: cond.n[1] },
      p: { min: cond.p[0], max: cond.p[1] },
      k: { min: cond.k[0], max: cond.k[1] },
      temperature: { min: cond.temp[0], max: cond.temp[1] },
      humidity: { min: cond.humidity[0], max: cond.humidity[1] },
      ph: { min: cond.ph[0], max: cond.ph[1] },
      rainfall: { min: cond.rainfall[0], max: cond.rainfall[1] },
    },
    details: buildDetails(c),
  };
});

fs.writeFileSync(path.join(ROOT, "data", "crops.json"), JSON.stringify(crops, null, 2), "utf8");
console.log(`✓ data/crops.json written — ${crops.length} crops × ${SECTIONS.length} sections`);