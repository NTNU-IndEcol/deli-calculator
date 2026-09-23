import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { DataManager } from '../app/frontend/static/js/data-manager.js';
import { FormHandler } from '../app/frontend/static/js/form-handler.js';
import { buildConversionMap, resolveMassConversion } from '../app/frontend/static/js/unit-converter.js';

const conversionMap = new Map([
  ['wheat flour-cup', {
    amount: 1,
    grams: 136,
    gramsPerUnit: 136,
    source: 'test-source'
  }],
  ['garlic-clove', {
    amount: 1,
    grams: 5,
    gramsPerUnit: 5,
    source: 'test-source'
  }]
]);

function convert(amount, unit, ingredientName = 'Unlisted ingredient') {
  return resolveMassConversion({ amount, unit, ingredientName, conversionMap });
}

test('direct mass units use exact identities', () => {
  assert.equal(convert(250, 'g').tons, 0.00025);
  assert.equal(convert(2, 'kg').tons, 0.002);
});

test('ingredient-specific factors take priority over volume fallbacks', () => {
  const result = convert(2, 'cup', 'Wheat flour');
  assert.equal(result.grams, 272);
  assert.equal(result.route, 'ingredient-specific-conversion-factor');
  assert.equal(result.fallback, false);
  assert.equal(result.source, 'test-source');
});

test('volume fallbacks use a water-equivalent density', () => {
  assert.equal(convert(1000, 'ml').tons, 0.001);
  assert.equal(convert(10, 'dl').tons, 0.001);
  assert.equal(convert(1, 'l').tons, 0.001);
  assert.equal(convert(1, 'cup').grams, 236.588);
  assert.equal(convert(1, 'ml').route, 'water-equivalent-fallback');
  assert.equal(convert(1, 'ml').fallback, true);
});

test('ingredient-specific count factors are accepted', () => {
  const result = convert(3, 'clove', 'Garlic');
  assert.equal(result.grams, 15);
  assert.equal(result.tons, 0.000015);
});

test('unsupported count units do not silently receive a universal mass', () => {
  const result = convert(1, 'unit');
  assert.equal(result.tons, null);
  assert.equal(result.route, 'quantitatively-unsupported');
  assert.match(result.error, /No mass conversion is available/);
});

test('zero mass is neutral and negative mass is rejected', () => {
  assert.equal(convert(0, 'unit').tons, 0);
  assert.equal(convert(-1, 'g').tons, null);
});

test('the archived CSV builds a complete usable conversion map', async () => {
  const csvUrl = new URL('../app/backend/data/Conversion_factors.csv', import.meta.url);
  const databaseUrl = new URL('../app/backend/data/food_item_poore_and_nemecek_fabio.csv', import.meta.url);
  const csvText = await readFile(csvUrl, 'utf8');
  const databaseText = await readFile(databaseUrl, 'utf8');
  const rows = DataManager.parseCSV(csvText);
  const databaseRows = DataManager.parseCSV(databaseText);
  const realMap = buildConversionMap(rows);
  const databaseNames = new Set(databaseRows.map(row => row.Ingredient.trim().toLowerCase()));

  assert.equal(rows.length, 261);
  assert.equal(realMap.size, 220);
  assert.equal(rows.filter(row => !databaseNames.has(row.Ingredient.trim().toLowerCase())).length, 0);
  assert.equal(realMap.has('beer-dl'), false);
  assert.equal(realMap.get('wheat flour-cup').gramsPerUnit, 136);
  assert.equal(realMap.get('wheat flour-unit').gramsPerUnit, 400);
  assert.equal(realMap.get('garlic-clove').gramsPerUnit, 5);
  assert.equal(realMap.get('seaweed-unit').gramsPerUnit, 3);

  const seaweed = resolveMassConversion({
    amount: 4,
    unit: 'unit',
    ingredientName: 'Seaweed',
    conversionMap: realMap
  });
  assert.equal(seaweed.grams, 12);
  assert.equal(seaweed.route, 'ingredient-specific-conversion-factor');

  const result = resolveMassConversion({
    amount: 2,
    unit: 'cup',
    ingredientName: 'Wheat flour',
    conversionMap: realMap
  });
  assert.equal(result.grams, 272);
  assert.equal(result.route, 'ingredient-specific-conversion-factor');

  const reclassifiedDl = resolveMassConversion({
    amount: 1,
    unit: 'dl',
    ingredientName: 'Beer',
    conversionMap: realMap
  });
  assert.equal(reclassifiedDl.grams, 100);
  assert.equal(reclassifiedDl.route, 'water-equivalent-fallback');
  assert.equal(reclassifiedDl.fallback, true);
});

test('known generic ingredients resolve to the intended database entries', async () => {
  const databaseUrl = new URL('../app/backend/data/food_item_poore_and_nemecek_fabio.csv', import.meta.url);
  const databaseText = await readFile(databaseUrl, 'utf8');
  DataManager.datasets.database = DataManager.parseCSV(databaseText);

  const matcher = Object.create(FormHandler.prototype);
  assert.equal(matcher.getIngredientAliases('Cheese'), 'Cow cheese');
  assert.equal(matcher.getIngredientAliases('dried seaweed'), 'Seaweed');
  assert.equal(matcher.getIngredientAliases('spring onions'), 'Onions');
  assert.equal(matcher.getIngredientAliases('plain flour'), 'Wheat flour');
  assert.equal(matcher.extractIngredientName('Sweet pepper').core, 'sweet pepper');
  assert.equal(matcher.extractIngredientName('Dumpling skins/wrappers , 만두피').core, 'wheat flour');
  assert.equal(matcher.findBestMatch('Cheese').Ingredient, 'Cow cheese');
  assert.equal(matcher.findBestMatch('Sweet pepper').Ingredient, 'Sweet pepper');
  assert.equal(matcher.findBestMatch('만두피'), null);
  assert.equal(matcher.findBestMatch('Water'), null);
});
