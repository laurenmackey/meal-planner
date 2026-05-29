// Unit conversion: convert compatible units to a common base before aggregating
// Volume (US): base = tsp  (1 tbsp = 3 tsp, 1 cup = 48 tsp)
// Weight (US): base = oz   (1 lb = 16 oz)
// Metric weight: base = g  (no other metric weight units currently)
// Metric volume: base = ml (1 l = 1000 ml)
export const UNIT_GROUPS: Record<string, { base: string; units: Record<string, number> }> = {
  volume: { base: "tsp", units: { tsp: 1, tbsp: 3, cups: 48 } },
  weight: { base: "oz", units: { oz: 1, lb: 16 } },
  metric_weight: { base: "g", units: { g: 1 } },
  metric_volume: { base: "ml", units: { ml: 1, l: 1000 } },
};

// Map each unit to its group
export const UNIT_TO_GROUP: Record<string, { group: string; factor: number }> = {};
for (const [groupName, group] of Object.entries(UNIT_GROUPS)) {
  for (const [unit, factor] of Object.entries(group.units)) {
    UNIT_TO_GROUP[unit] = { group: groupName, factor };
  }
}

// Pick the best display unit: use the largest unit where quantity >= 1
export function bestDisplayUnit(baseQuantity: number, groupName: string): { quantity: number; unit: string } {
  const group = UNIT_GROUPS[groupName];
  const sorted = Object.entries(group.units).sort((a, b) => b[1] - a[1]); // largest first
  for (const [unit, factor] of sorted) {
    const converted = baseQuantity / factor;
    if (converted >= 1) {
      return { quantity: Math.round(converted * 100) / 100, unit };
    }
  }
  return { quantity: Math.round(baseQuantity * 100) / 100, unit: group.base };
}
