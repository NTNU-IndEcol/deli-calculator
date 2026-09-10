const DIRECT_MASS_GRAMS_PER_UNIT = {
  g: 1,
  kg: 1000,
  ounce: 28.3495,
  lb: 453.592
};

const WATER_EQUIVALENT_GRAMS_PER_UNIT = {
  ml: 1,
  dl: 100,
  l: 1000,
  cup: 236.588,
  tbsp: 14.7868,
  tsp: 4.92892
};

function conversionKey(ingredientName, unit) {
  if (!ingredientName || !unit) return null;
  return `${String(ingredientName).trim().toLowerCase()}-${unit}`;
}

export function buildConversionMap(rows) {
  return new Map(rows.flatMap(row => {
    const ingredient = String(row.Ingredient || '').trim().toLowerCase();
    const unit = String(row.Unit || '').trim().toLowerCase();
    const amount = Number.parseFloat(row.Amount);
    const grams = Number.parseFloat(row.Grams);
    const conversionClass = String(row.ConversionClass || 'ingredient_specific_candidate').trim();

    if (
      conversionClass !== 'ingredient_specific_candidate'
      || !ingredient
      || !unit
      || !Number.isFinite(amount)
      || amount <= 0
      || !Number.isFinite(grams)
      || grams <= 0
    ) {
      return [];
    }

    return [[`${ingredient}-${unit}`, {
      amount,
      grams,
      gramsPerUnit: grams / amount,
      source: row.Source || null
    }]];
  }));
}

export function resolveMassConversion({ amount, unit, ingredientName, conversionMap }) {
  const numericAmount = Number(amount);
  const normalizedUnit = String(unit || '').trim().toLowerCase();

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return {
      tons: null,
      error: `Invalid amount "${amount}" for ${ingredientName || 'ingredient'}.`
    };
  }

  if (numericAmount === 0) {
    return {
      tons: 0,
      grams: 0,
      route: 'zero-mass',
      factorGramsPerUnit: 0,
      source: null,
      fallback: false
    };
  }

  const directFactor = DIRECT_MASS_GRAMS_PER_UNIT[normalizedUnit];
  if (directFactor) {
    const grams = numericAmount * directFactor;
    return {
      tons: grams / 1e6,
      grams,
      route: 'direct-mass-unit',
      factorGramsPerUnit: directFactor,
      source: 'SI/avoirdupois unit identity',
      fallback: false
    };
  }

  const key = conversionKey(ingredientName, normalizedUnit);
  const tableRecord = key ? conversionMap?.get(key) : null;
  const tableFactor = Number(tableRecord?.gramsPerUnit);
  if (Number.isFinite(tableFactor) && tableFactor > 0) {
    const grams = numericAmount * tableFactor;
    return {
      tons: grams / 1e6,
      grams,
      route: 'ingredient-specific-conversion-factor',
      factorGramsPerUnit: tableFactor,
      source: tableRecord.source || null,
      fallback: false
    };
  }

  const fallbackFactor = WATER_EQUIVALENT_GRAMS_PER_UNIT[normalizedUnit];
  if (fallbackFactor) {
    const grams = numericAmount * fallbackFactor;
    return {
      tons: grams / 1e6,
      grams,
      route: 'water-equivalent-fallback',
      factorGramsPerUnit: fallbackFactor,
      source: 'Assumed density: 1 kg/L',
      fallback: true
    };
  }

  return {
    tons: null,
    grams: null,
    route: 'quantitatively-unsupported',
    factorGramsPerUnit: null,
    source: null,
    fallback: false,
    error: `No mass conversion is available for "${ingredientName || 'ingredient'}" in ${normalizedUnit || 'an unspecified unit'}. Please enter a mass or add a validated ingredient-specific factor.`
  };
}
