// frontend/static/js/ui/form-handler.js
import { DataManager } from './data-manager.js';
import { ApiClient } from './api-client.js';

export class FormHandler {
    constructor() {
      this.selectedIngredients = [];
      this.unmatchedIngredients = [];
      this.recipeLoaded = false;
      this.initializeElements();
      this.setupEventListeners();
    }
  
    initializeElements() {
      this.elements = {
        form: document.getElementById('ingredient-form'),
        categoryInput: document.getElementById('category-input'),
        ingredientInput: document.getElementById('ingredient-input'),
        amountInput: document.getElementById('amount-input'),
        unitInput: document.getElementById('unit-input'),
        sourceInput: document.getElementById('source-input'),
        addButton: document.getElementById('add-ingredient-btn'),
        tableBody: document.getElementById('ingredients-table-body'),
        errorContainer: document.getElementById('form-errors')
      };

      if (!this.elements.tableBody) {
        console.error('Table body element not found! Check HTML ID');
        this.elements.tableBody = document.createElement('tbody');
      }
    }
  
    createDummyInput() {
      const dummy = document.createElement('input');
      dummy.type = 'text';
      return dummy;
    }

    createErrorContainer() {
      const container = document.createElement('div');
      container.id = 'form-errors';
      document.querySelector('form').prepend(container);
      return container;
    }
   
    static updateCategory(selectedCategory) {
      const categoryInput = document.getElementById('category-input');
      if (categoryInput) {
        categoryInput.value = selectedCategory || '';
      }
    }
    
    static updateSourceCountries(commCode) {
      const countries = DataManager.getTopImportCountries(commCode);
      FoodCalculatorApp.autocompleteInstances.source.updateDataset(countries);
    }
    
    static updateImportCountries(countries) {
      const sourceDropdown = document.getElementById("source-input");
      if (sourceDropdown) {
        sourceDropdown.innerHTML = `
          ${countries.map(c => `<option>${c}</option>`).join('')}
        `;
      }
    }
    
    setupEventListeners() {
      this.elements.addButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleAddIngredient();
      });
  
      this.elements.tableBody.addEventListener('input', (e) => {
        if (e.target.classList.contains('amount-input')) {
          this.handleAmountChange(e);
        }
      });
  
      this.elements.tableBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('source-select')) {
          this.handleSourceChange(e);
        }
      });
  
      this.elements.tableBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('unit-input')) {
          this.handleUnitChange(e);
        }
      });

      this.elements.tableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
          this.handleRemoveIngredient(e);
        }
      });
    }
  
    validateInputs() {
      const errors = [];
      const currentInputs = {
        category: this.elements.categoryInput.value.trim(),
        ingredient: this.elements.ingredientInput.value.trim(),
        amount: parseFloat(this.elements.amountInput.value),
        unit: this.elements.unitInput.value,
        source: this.elements.sourceInput.value.trim()
      };

      if (!currentInputs.category) errors.push('Category is required');
      if (!currentInputs.ingredient) errors.push('Ingredient is required');
      if (isNaN(currentInputs.amount)) errors.push('Valid amount is required');
      if (!currentInputs.source) errors.push('Country source is required');

      return {
        valid: errors.length === 0,
        errors,
        data: currentInputs
      };
    }
  
    handleAddIngredient() {
      const validation = this.validateInputs();
      if (!validation.valid) {
        this.showErrors(validation.errors);
        return;
      }
    
      const commCode = document.getElementById('ingredient-input').dataset.commCode;
  
      const newIngredient = {
        id: Date.now()+ Math.random(),
        category: validation.data.category,
        name: validation.data.ingredient,
        amount: validation.data.amount,
        unit: validation.data.unit,
        source: validation.data.source,
        comm_code: commCode || 'UNKNOWN',
        matched: false
      };
    
      this.processNewIngredient(newIngredient);
      this.updateTable();
      this.clearForm();
    }
  
    // Process new ingredient with improved matching
    processNewIngredient(ingredient) {
      const ingredientName = ingredient.name || ingredient.mainIngredient;
      
      if (!ingredientName) {
        console.error('Ingredient missing name:', ingredient);
        return;
      }

      const cleanInputName = ingredientName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    
      // Use improved matching algorithm
      const match = this.findBestMatch(cleanInputName);
    
      if (match) {
        const possibleSources = [match.Top1, match.Top2, match.Top3, match.Top4, match.Top5].filter(Boolean);
        this.selectedIngredients.push({
          ...ingredient,
          name: ingredientName,
          comm_code: match.comm_code,
          matched: true,
          possibleSources: possibleSources,
          source: ingredient.source || possibleSources[0] || ''
        });
        console.log(`✅ Matched "${ingredientName}" to "${match.Ingredient}" (${match.comm_code})`);
      } else {
        this.unmatchedIngredients.push({
          ...ingredient,
          name: ingredientName,
          comm_code: 'UNKNOWN',
          matched: false,
          possibleSources: DataManager.getAllCountries() || [''],
          source: ingredient.source || ''
        });
        console.log(`⚠️ No match found for "${ingredientName}"`);
      }
    }

    static getCommCodeByCategory(category) {
      const cleanCategory = category.toLowerCase().replace(/\s+/g, ' ');
      return DataManager.database.find(item => 
        item["Food group"].toLowerCase().replace(/\s+/g, ' ') === cleanCategory
      )?.comm_code;
    }

    normalizeUnit(unit) {
      const unitAliases = {
        'oz': 'ounce',
        'ounces': 'ounce',
        'pound': 'lb',
        'lbs': 'lb',
        'teaspoon': 'tsp',
        'teaspoons': 'tsp',
        'tablespoon': 'tbsp',
        'tablespoons': 'tbsp',
        'cup': 'cup',
        'cups': 'cup'
      };
      
      const cleanUnit = String(unit || 'unit')
        .toLowerCase()
        .replace(/s$/, '')
        .trim();
    
      return unitAliases[cleanUnit] ?? 
        (['g', 'kg', 'cup', 'tbsp', 'tsp', 'ounce', 'lb'].includes(cleanUnit) 
          ? cleanUnit 
          : 'unit');
    }

    async loadRecipe() {
      if (this.recipeLoaded) return;

      try {
        const savedIngredients = await DataManager.loadSavedRecipe();
        const processedIngredients = savedIngredients.map(ing => ({
          ...ing,
          id: Date.now() + Math.random(),
          category: ing.category,
          name: this.cleanIngredientName(ing.mainIngredient || ing.name),
          amount: this.parseAmount(ing.amount),
          unit: this.normalizeUnit(ing.unit),
          source: ing.source?.trim() || '',
          matched: false
        }));

        this.initDatabaseMatching(processedIngredients);
        this.recipeLoaded = true;
        this.updateTable();

      } catch (error) {
        console.error('Failed to load recipe:', error);
        this.showErrors([error.message]);
      }
    }
  
    updateTable() {
      const fragment = document.createDocumentFragment();
      const allIngredients = [...this.selectedIngredients, ...this.unmatchedIngredients];
      
      allIngredients.forEach((ingredient, index) => {
        const row = this.createTableRow(ingredient, index);
        fragment.appendChild(row);
      });
      
      this.elements.tableBody.innerHTML = '';
      this.elements.tableBody.appendChild(fragment);
      this.setupRowInteractions();
    }
 
    createTableRow(ingredient, index) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td data-label="Category" class="${!ingredient.matched ? 'unmatched' : ''}">
            ${ingredient.matched ? 
                `<span class="editable-category">${ingredient.category}</span>` :
                `<input type="text" class="category-input" value="${ingredient.category}">`
            }
        </td>
        <td data-label="Ingredient" class="${!ingredient.matched ? 'unmatched' : ''}">
            ${ingredient.matched ? 
                `<span class="editable-name">${ingredient.name}</span>` :
                `<input type="text" class="name-input" value="${ingredient.name}">`
            }
        </td>
        <td data-label="Amount">
            <input type="number" class="amount-input" 
                   value="${ingredient.amount}" min="0" step="0.1"
                    data-id="${ingredient.id}">
        </td>
        <td data-label="Unit">
            <select class="unit-input" data-index="${index}">
                ${['g', 'kg', 'ounce', 'lb', 'cup', 'tbsp', 'tsp', 'unit'].map(unit => `
                    <option value="${unit}" ${unit === ingredient.unit ? 'selected' : ''}>
                        ${unit}
                    </option>
                `).join('')}
            </select>
        </td>
        <td data-label="Source" class="source-cell" style="text-align: center;">
            ${this.createSourceInput(ingredient)}
        </td>
        <td data-label="Action">
            <button class="remove-btn" data-id="${ingredient.id}">🗑️</button>
        </td>
    `;
    return row;
    }

    createSourceInput(ingredient) {
      let sources = ingredient.matched 
        ? ingredient.possibleSources 
        : DataManager.getAllCountries();
    
      if (!sources || sources.length === 0) {
        sources = [''];
      }
    
      return `
        <select class="source-select centered-select" data-id="${ingredient.id}">
          ${sources.map(country => `
            <option value="${country}" ${country === ingredient.source ? 'selected' : ''}>
              ${country}
            </option>
          `).join('')}
        </select>
      `;
    }

    // Improved fuzzy matching with scoring
    fuzzyMatch(dbName, inputName) {
      const cleanDb = dbName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
      const cleanInput = inputName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
      
      // Exact match (highest priority)
      if (cleanDb === cleanInput) return 3;
      
      // Input contains full database name (e.g., "chicken eggs" contains "eggs")
      if (cleanInput.includes(cleanDb)) return 2;
      
      // Database name contains input (e.g., "poultry meat" contains "meat")
      if (cleanDb.includes(cleanInput)) return 1;
      
      return 0;
    }
    
    // Find best match using scoring
    findBestMatch(inputName) {
      let bestMatch = null;
      let bestScore = 0;
      
      for (const item of DataManager.database) {
        const dbName = item.Ingredient.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
        const score = this.fuzzyMatch(dbName, inputName);
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }
      }
      
      return bestScore > 0 ? bestMatch : null;
    }
  
    createMatchedIngredient(dbEntry) {
      return {
        matched: true,
        category: dbEntry["Food group"],
        comm_code: dbEntry.comm_code,
        possibleSources: [
          dbEntry.Top1, dbEntry.Top2, dbEntry.Top3, dbEntry.Top4, dbEntry.Top5
        ].filter(Boolean)
      };
    }
  
    setupRowInteractions() {
      document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const id = Number(e.target.dataset.id);
          const ingredient = this.unmatchedIngredients.find(item => item.id === id);
          
          if (ingredient) {
            const row = e.target.closest('tr');
            ingredient.category = row.querySelector('.category-input').value;
            ingredient.name = row.querySelector('.name-input').value;
            
            const cleanName = ingredient.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
            const match = this.findBestMatch(cleanName);
            
            if (match) {
              this.selectedIngredients.push({ ...ingredient, ...this.createMatchedIngredient(match) });
              this.unmatchedIngredients = this.unmatchedIngredients.filter(item => item.id !== id);
            }
            this.updateTable();
          }
        });
      });
    }
    
    initDatabaseMatching(newIngredients = []) {
      const newlyMatched = [];
      const stillUnmatched = [];
    
      newIngredients.forEach(ingredient => {
        const ingredientName = ingredient.name || ingredient.mainIngredient;

        if (!ingredientName) {
          console.warn('Skipping ingredient without name:', ingredient);
          stillUnmatched.push(ingredient);
          return;
        }
        
        const cleanName = ingredientName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
        const match = this.findBestMatch(cleanName);
        
        if (match) {
          const possibleSources = [
            match.Top1, match.Top2, match.Top3, match.Top4, match.Top5
          ].filter(Boolean);
          
          newlyMatched.push({ 
            ...ingredient,
            name: ingredientName,
            ...this.createMatchedIngredient(match),
            comm_code: match.comm_code,
            matched: true,
            possibleSources: possibleSources,
            source: ingredient.source || possibleSources[0] || ''
          });
          console.log(`✅ Matched "${ingredientName}" to "${match.Ingredient}" (${match.comm_code})`);
        } else {
          stillUnmatched.push({
            ...ingredient,
            name: ingredientName
          });
          console.log(`⚠️ No match found for "${ingredientName}"`);
        }
      });
      
      this.selectedIngredients = [...this.selectedIngredients, ...newlyMatched];
      this.unmatchedIngredients = [...this.unmatchedIngredients, ...stillUnmatched];
    }
    
    handleDatabaseMatch(index, dbEntry) {
        this.selectedIngredients[index] = {
            ...this.selectedIngredients[index],
            matched: true,
            commCode: dbEntry.comm_code,
            possibleSources: [
                dbEntry.Top1,
                dbEntry.Top2,
                dbEntry.Top3,
                dbEntry.Top4,
                dbEntry.Top5
            ].filter(Boolean)
        };
    
        const sourceCell = document.querySelector(`[data-index="${index}"] .source-input`);
        if (sourceCell) {
            this.updateSourceOptions(index, sourceCell);
        }
    }
  
    updateSourceOptions(index, container) {
        const ingredient = this.selectedIngredients[index];
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'source-input';
        input.placeholder = 'Select source country';
        
        new AutocompleteHandler({
            input: input,
            dataset: ingredient.possibleSources,
            onSelect: (selectedCountry) => {
                this.selectedIngredients[index].source = selectedCountry;
                this.updateTable();
            }
        });
    
        container.innerHTML = '';
        container.appendChild(input);
    }

    getCategory(ingredientName) {
      return DataManager.categories.find(cat => 
          ingredientName.toLowerCase().includes(cat.toLowerCase())
      ) || 'Other';
    }

    cleanIngredientName(name) {
      return name
        .replace(/(optional|divided|to taste|see note|,)/gi, '')
        .replace(/[^a-zA-Z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    parseAmount(amount) {
      return typeof amount === 'string' ? 
          parseFloat(amount.replace(/[^0-9.]/g, '')) || 0 : 
          amount || 0;
    }

    extractSource(text) {
      const countryMatch = text.match(/\((.*?)\)/);
      return countryMatch ? countryMatch[1] : '';
    }
  
    handleSourceChange(event) {
      const id = Number(event.target.dataset.id);
      const newSource = event.target.value;

      const allIngredients = [...this.selectedIngredients, ...this.unmatchedIngredients];
      const ingredient = allIngredients.find(item => item.id === id);

      if (ingredient) {
        ingredient.source = newSource;
        console.log('Source updated:', ingredient);
      } else {
        console.warn('Ingredient not found. ID:', id, 'All IDs:', allIngredients.map(i => i.id));
      }
    }
  
    handleUnitChange(event) {
      const index = Number(event.target.dataset.index);
      const newUnit = event.target.value;
      
      const allIngredients = [...this.selectedIngredients, ...this.unmatchedIngredients];
      const ingredient = allIngredients[index];
      
      if (ingredient) {
        ingredient.unit = newUnit;
        console.log('Unit updated:', ingredient);
      }
    }

    handleAmountChange(event) {
      const id = Number(event.target.dataset.id);
      const newValue = parseFloat(event.target.value);
      
      const allIngredients = [...this.selectedIngredients, ...this.unmatchedIngredients];
      const ingredient = allIngredients.find(item => item.id === id);
      
      if (ingredient && !isNaN(newValue)) {
        ingredient.amount = newValue;
        console.log('Amount updated:', ingredient);
      }
    }
    
    handleRemoveIngredient(event) {
      const id = Number(event.target.dataset.id);
      
      let index = this.selectedIngredients.findIndex(item => item.id === id);
      if (index !== -1) {
        this.selectedIngredients.splice(index, 1);
      } else {
        index = this.unmatchedIngredients.findIndex(item => item.id === id);
        if (index !== -1) {
          this.unmatchedIngredients.splice(index, 1);
        }
      }
      
      this.updateTable();
    }
  
    showErrors(errors) {
      this.elements.errorContainer.innerHTML = `
        <div class="alert error">
          <h4>Validation Errors</h4>
          <ul>
            ${errors.map(error => `<li>${error}</li>`).join('')}
          </ul>
        </div>
      `;
    }
  
    clearErrors() {
      this.elements.errorContainer.innerHTML = '';
    }
  
    clearForm() {
      this.elements.categoryInput.value = '';
      this.elements.ingredientInput.value = '';
      this.elements.sourceInput.value = '';
    }
  
    getIngredients() {
      return this.selectedIngredients.map(ingredient => ({
        ...ingredient,
      }));
    }

    async calculateImpact() {
      const ingredients = this.selectedIngredients;
      
      if (ingredients.length === 0) {
        console.warn('No ingredients selected');
        return null;
      }
      
      console.log('🧮 Calculating environmental impact for', ingredients.length, 'ingredients...');
      
      const lookupItems = [];
      const ingredientMeta = [];
      
      for (const ing of ingredients) {
          const importCountryCode = DataManager.getFabioCountryCode(ing.source);
          
          if (!importCountryCode) {
            console.warn(`⚠️ No FABIO country code found for: ${ing.source}`);
            continue;
          }
          
          const commodityCode = ing.comm_code || this.getCommCode(ing);
          
          if (!commodityCode) {
            console.warn(`⚠️ No commodity code found for: ${ing.name}`);
            continue;
          }
          
          const amountInTons = this.convertToTons(ing.amount || 0, ing.unit);

          lookupItems.push({
            importCountryCode: importCountryCode,
            commodityCode: commodityCode
          });
          
          ingredientMeta.push({
            name: ing.name,
            source: ing.source,
            amount: amountInTons,
            unit: ing.unit,
            originalAmount: ing.amount || 0,
            importCountryCode: importCountryCode,
            commodityCode: commodityCode
          });
        }
      
      if (lookupItems.length === 0) {
        console.warn('No valid ingredients to calculate');
        return null;
      }
      
      console.log(`📊 Looking up impacts for ${lookupItems.length} items...`);
      
      const results = await DataManager.batchGetEnvImpacts(lookupItems);
      
      let totals = {
        biodiv: 0,
        co2e: 0,
        landUse: 0,
        waterUse: 0
      };
      
      const ingredientImpacts = [];
      
      results.forEach((result, index) => {
        const meta = ingredientMeta[index];
        const amount = meta.amount;
        const impacts = result.impacts;
        
        const ingredientImpact = {
          name: meta.name,
          source: meta.source,
          amount: amount,
          biodiv: impacts.biodiv * amount,
          co2e: impacts.gwp100 * amount,
          landUse: impacts.landuse * amount,
          waterUse: impacts.water * amount
        };
        
        ingredientImpacts.push(ingredientImpact);
        
        totals.biodiv += ingredientImpact.biodiv;
        totals.co2e += ingredientImpact.co2e;
        totals.landUse += ingredientImpact.landUse;
        totals.waterUse += ingredientImpact.waterUse;
        
        console.log(`  ✔ ${meta.name} (${meta.source}): biodiv=${ingredientImpact.biodiv.toFixed(3)}, co2e=${ingredientImpact.co2e.toFixed(2)}`);
      });
      
      console.log('✅ Total impact calculated:', {
        biodiv: totals.biodiv.toFixed(3),
        co2e: totals.co2e.toFixed(2),
        landUse: totals.landUse.toFixed(2),
        waterUse: totals.waterUse.toFixed(2)
      });
      
      this._ingredientImpacts = ingredientImpacts;
      
      return {
        ...totals,
        ingredientCount: results.length,
        details: ingredientImpacts
      };
    }

    async getImpactByCountry() {
      const ingredients = this.selectedIngredients;
      
      if (ingredients.length === 0) {
        console.warn('No ingredients selected');
        return [];
      }
      
      console.log('🗺️ Calculating impact by PRODUCING country for map...');
      
      const allProducers = [];
      
      for (const ing of ingredients) {
        const importCountryCode = DataManager.getFabioCountryCode(ing.source);
        
        if (!importCountryCode) {
          console.warn(`⚠️ No FABIO code for: ${ing.source}`);
          continue;
        }
        
        const commodityCode = ing.comm_code || this.getCommCode(ing);
        
        if (!commodityCode) {
          console.warn(`⚠️ No commodity code for: ${ing.name}`);
          continue;
        }
        
        const amountInTons = this.convertToTons(ing.amount || 0, ing.unit);
        
        try {
          const response = await fetch('/api/env-impacts/breakdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              import_country_code: importCountryCode,
              commodity_code: commodityCode
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error(`Backend error for ${ing.name}:`, errorData);
            continue;
          }
          
          const breakdown = await response.json();
          
          if (!breakdown.success) {
            console.warn(`No breakdown data for ${ing.name}`);
            continue;
          }
          
          breakdown.producing_countries.forEach(producer => {
            allProducers.push({
              producingCountryCode: String(producer.area_code),
              importFrom: ing.source,
              commodity: ing.name,
              amount: amountInTons,
              biodiv: producer.biodiv * amountInTons,
              co2e: producer.gwp100 * amountInTons,
              landUse: producer.landuse * amountInTons,
              waterUse: producer.water * amountInTons
            });
          });
          
        } catch (error) {
          console.error(`Failed to get breakdown for ${ing.name}:`, error);
        }
      }
      
      if (allProducers.length === 0) {
        console.warn('No producer data found');
        return [];
      }
      
      const countryTotals = new Map();
      
      allProducers.forEach(item => {
        const producerCode = item.producingCountryCode;
        
        if (!countryTotals.has(producerCode)) {
          countryTotals.set(producerCode, {
            producerCode: producerCode,
            biodiv: 0,
            co2e: 0,
            landUse: 0,
            waterUse: 0,
            commodities: []
          });
        }
        
        const totals = countryTotals.get(producerCode);
        totals.biodiv += item.biodiv;
        totals.co2e += item.co2e;
        totals.landUse += item.landUse;
        totals.waterUse += item.waterUse;
        totals.commodities.push(`${item.commodity} (for ${item.importFrom})`);
      });
      
      const mapData = Array.from(countryTotals.values()).map(data => {
        const region = DataManager.datasets.regions.find(r => {
          const regionCode = parseInt(String(r.CountryCode).trim());
          const producerCode = parseInt(String(data.producerCode).trim());
          
          if (isNaN(regionCode) || isNaN(producerCode)) {
            return false;
          }
          
          return regionCode === producerCode;
        });
        
        if (!region) {
          console.warn(`❌ No region found for FABIO code ${data.producerCode}`);
          return null;
        }
        
        return {
          country: region.CountryName,
          countryCode: region.iso3c,
          fabioCode: data.producerCode,
          biodiv: data.biodiv,
          co2e: data.co2e,
          land: data.landUse,
          water: data.waterUse,
          commodities: [...new Set(data.commodities)]
        };
      }).filter(Boolean);
      
      mapData.sort((a, b) => b.biodiv - a.biodiv);
      
      return mapData;
    }

    getCommCode(ingredient) {
      if (ingredient.comm_code) {
        return ingredient.comm_code;
      }
      
      const dbEntry = DataManager.database.find(item => 
        item.Ingredient?.trim().toLowerCase() === ingredient.name?.trim().toLowerCase()
      );
      
      return dbEntry?.comm_code || null;
    }

    formatNumber(value) {
      return Number(value.toFixed(3));
    }

    convertToKilograms(amount, unit) {
      const conversions = {
        'g': amount => amount / 1000,
        'kg': amount => amount,
        'ml': amount => amount * 0.001,
        'l': amount => amount * 1.0,
        'ton': amount => amount * 1000
      };

      if (!conversions[unit]) {
        console.error(`Invalid unit: ${unit}`);
        return 0;
      }

      return conversions[unit](Number(amount));
    }

    convertToTons(amount, unit) {
      const conversions = {
        'g': amount => amount / 1e6,
        'kg': amount => amount / 1000,
        'ounce': amount => amount * 0.0000283495,
        'lb': amount => amount * 0.000453592,
        'cup': amount => amount * 0.000236588,
        'tbsp': amount => amount * 0.0000147868,
        'tsp': amount => amount * 0.00000492892,
        'unit': amount => amount / 1000/50
      };
    
      return conversions[unit]?.(Number(amount)) || 0;
    }
}