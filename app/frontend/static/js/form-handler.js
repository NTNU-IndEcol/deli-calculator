// frontend/static/js/ui/form-handler.js
import { DataManager } from './data-manager.js'; // Add this line
import { ApiClient } from './api-client.js'; // Add proper import

export class FormHandler {
    constructor() {
      this.selectedIngredients = [];
      this.unmatchedIngredients = [];
      this.recipeLoaded = false; // Track load state
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
        errorContainer: document.getElementById('form-errors') //|| this.createErrorContainer(),
                    
      };

        // Add validation
      if (!this.elements.tableBody) {
        console.error('Table body element not found! Check HTML ID');
        this.elements.tableBody = document.createElement('tbody'); // Fallback
      }
      
    }
  
    createDummyInput() {
      const dummy = document.createElement('input');
      dummy.type = 'text';
      return dummy;
    }

    // Add this new method
    createErrorContainer() {
      const container = document.createElement('div');
      container.id = 'form-errors';
      document.querySelector('form').prepend(container);
      return container;
    }
   
    static updateCategory(selectedCategory) { // Parameter name matches
      const categoryInput = document.getElementById('category-input');
      if (categoryInput) {
        categoryInput.value = selectedCategory || '';
      }
    }
    
    static updateSourceCountries(commCode) {
      const countries = DataManager.getTopImportCountries(commCode);
      // Update the source autocomplete dataset
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
  
      // Event delegation for dynamic elements
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
  
      this.elements.tableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
          this.handleRemoveIngredient(e);
        }
      });

     // this.elements.form.addEventListener('submit', (e) => e.preventDefault());
    }
  
    // Validate input
    validateInputs() {
      const errors = [];
      const currentInputs = {
        category: this.elements.categoryInput.value.trim(),
        ingredient: this.elements.ingredientInput.value.trim(),
        amount: parseFloat(this.elements.amountInput.value),
        unit: this.elements.unitInput.value,
        source: this.elements.sourceInput.value.trim() // Direct country value
      };

      if (!currentInputs.category) errors.push('Category is required');
      if (!currentInputs.ingredient) errors.push('Ingredient is required');
      if (isNaN(currentInputs.amount)) errors.push('Valid amount is required');
      if (!currentInputs.source) errors.push('Country source is required'); // New validation

      return {
        valid: errors.length === 0,
        errors,
        data: currentInputs
      };
    }
  
    // handle add ingredient
    handleAddIngredient() {
     
      const validation = this.validateInputs();
      if (!validation.valid) {
        this.showErrors(validation.errors);
        return;
      }
    
      // Get comm code from hidden data attribute
      const commCode = document.getElementById('ingredient-input').dataset.commCode;
  
      const newIngredient = {
        id: Date.now()+ Math.random(),
        category: validation.data.category,
        name: validation.data.ingredient,
        amount: validation.data.amount,
        unit: validation.data.unit,
        source: validation.data.source,
        comm_code: commCode || 'UNKNOWN', // Use stored code
        matched: false
      };
    
      // Process immediately without adding to unmatched first
      this.processNewIngredient(newIngredient);
      this.updateTable();
      this.clearForm();
    }
  
    // Process new ingredient
    processNewIngredient(ingredient) {

      // Handle both name and mainIngredient fields
      const ingredientName = ingredient.name || ingredient.mainIngredient;
      
      if (!ingredientName) {
        console.error('Ingredient missing name:', ingredient);
        return;
      }

      const cleanInputName = ingredientName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    
      // 1. Try partial match
      const match = DataManager.database.find(item => {
        const dbName = item.Ingredient.toLowerCase().replace(/[^a-z0-9]/g, ' ');
        return dbName.includes(cleanInputName) || cleanInputName.includes(dbName);
      });
    
      if (match) {
        // Handle matched ingredient
        const possibleSources = [match.Top1, match.Top2, match.Top3, match.Top4, match.Top5].filter(Boolean);
        this.selectedIngredients.push({
          ...ingredient,
          name: ingredientName, //Ensure name is set
          comm_code: match.comm_code,
          matched: true,
          possibleSources: possibleSources,
          source: ingredient.source || possibleSources[0] || ''
        });
      } else {
        // Handle unmatched ingredient
        this.unmatchedIngredients.push({
          ...ingredient,
          name: ingredientName,
          comm_code: 'UNKNOWN',
          matched: false,
          possibleSources: DataManager.getAllCountries() || [''],
          source: ingredient.source || ''
        });
      }
    }

    static getCommCodeByCategory(category) {
      // Normalize both input and database values
      const cleanCategory = category.toLowerCase().replace(/\s+/g, ' ');
      return DataManager.database.find(item => 
        item["Food group"].toLowerCase().replace(/\s+/g, ' ') === cleanCategory
      )?.comm_code;
    }


    // Update the normalizeUnit method
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
        .replace(/s$/, '') // Remove plural "s"
        .trim();
    
      // First check aliases, then allowed units
      return unitAliases[cleanUnit] ?? 
        (['g', 'kg', 'cup', 'tbsp', 'tsp', 'ounce', 'lb'].includes(cleanUnit) 
          ? cleanUnit 
          : 'unit');
    }
    

    // Updated loadRecipe method
    async loadRecipe() {
      if (this.recipeLoaded) return; // Prevent duplicate loads

      try {
        const savedIngredients = await DataManager.loadSavedRecipe();
        const processedIngredients = savedIngredients.map(ing => ({
          ...ing,
          id: Date.now() + Math.random(), // Ensure unique ID
          category: ing.category,
          name: this.cleanIngredientName(ing.mainIngredient || ing.name),
          amount: this.parseAmount(ing.amount),
          unit: this.normalizeUnit(ing.unit),
          source: ing.source?.trim() || '',
          matched: false
        }));

        // Append to existing ingredients instead of replacing
        this.initDatabaseMatching(processedIngredients);
 
        this.recipeLoaded = true; // Mark as loaded
        this.updateTable();

      } catch (error) {
        console.error('Failed to load recipe:', error);
        this.showErrors([error.message]);
      }
    }

  
    // Unified table update for both sources
    updateTable() {
      const fragment = document.createDocumentFragment(); // Use a fragment
      const allIngredients = [...this.selectedIngredients, ...this.unmatchedIngredients];
      
      allIngredients.forEach((ingredient, index) => {
        const row = this.createTableRow(ingredient, index);
        fragment.appendChild(row);
      });
      
      this.elements.tableBody.innerHTML = ''; // Clear once
      this.elements.tableBody.appendChild(fragment); // Batch update
      this.setupRowInteractions();
    }
 
    
    // create table row
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

    // Create source input
    createSourceInput(ingredient) {
      let sources = ingredient.matched 
        ? ingredient.possibleSources 
        : DataManager.getAllCountries();
    
      // Fallback if no sources are found
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


    fuzzyMatch(dbName, inputName) {
      const cleanDb = dbName.toLowerCase().replace(/[^a-z]/g, '');
      const cleanInput = inputName.toLowerCase().replace(/[^a-z]/g, '');
      return cleanDb.includes(cleanInput) || cleanInput.includes(cleanDb);
    }
  
    createMatchedIngredient(dbEntry) {
      return {
        matched: true,
        category: dbEntry["Food group"],
        comm_code: dbEntry.comm_code, // CORRECTED PROPERTY NAME
        possibleSources: [
          dbEntry.Top1, dbEntry.Top2, dbEntry.Top3, dbEntry.Top4, dbEntry.Top5
        ].filter(Boolean)
      };
    }
  
    setupRowInteractions() {
      document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const id = Number(e.target.dataset.id); // Convert to number
          const ingredient = this.unmatchedIngredients.find(item => item.id === id);
          
          if (ingredient) {
            // Update category/name from inputs
            const row = e.target.closest('tr');
            ingredient.category = row.querySelector('.category-input').value;
            ingredient.name = row.querySelector('.name-input').value;
            
            // Attempt re-matching
            const match = DataManager.database.find(item => 
              this.fuzzyMatch(item.Ingredient, ingredient.name)
            );
            if (match) {
              this.selectedIngredients.push({ ...ingredient, ...this.createMatchedIngredient(match) });
              this.unmatchedIngredients = this.unmatchedIngredients.filter(item => item.id !== id);
            }
            this.updateTable();
          }
        });
      });
    }
    
    // initDatabaseMatching methods with this single version
    initDatabaseMatching(newIngredients = []) {
      // Process new ingredients without clearing existing ones
      const newlyMatched = [];
      const stillUnmatched = [];
    
      newIngredients.forEach(ingredient => {
            
            const ingredientName = ingredient.name || ingredient.mainIngredient;
    
            if (!ingredientName) {
              console.warn('Skipping ingredient without name:', ingredient);
              stillUnmatched.push(ingredient);
              return;
            }
            
            const match = DataManager.database.find(item => 
            this.fuzzyMatch(item.Ingredient, ingredient.name)
          );
          
          if (match) {
            const possibleSources = [
              match.Top1, match.Top2, match.Top3, match.Top4, match.Top5
            ].filter(Boolean);
            
            newlyMatched.push({ 
              ...ingredient,
              name: ingredientName, // Ensure name is set
              ...this.createMatchedIngredient(match),
              comm_code: match.comm_code,
              matched: true,
              possibleSources: possibleSources,
              // Set default source if missing
              source: ingredient.source || possibleSources[0] || ''
            });
          } else {
            stillUnmatched.push({
              ...ingredient,
              name: ingredientName // Ensure name is set
            });
                    
          }
        });
      // Merge with existing ingredients instead of replacing
      this.selectedIngredients = [...this.selectedIngredients, ...newlyMatched];
      this.unmatchedIngredients = [...this.unmatchedIngredients, ...stillUnmatched];
    }
    
    // Handle database match
    handleDatabaseMatch(index, dbEntry) {
        // Update the ingredient with database info
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
    
        // Update the source dropdown
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
    // Helper methods
    getCategory(ingredientName) {
      return DataManager.categories.find(cat => 
          ingredientName.toLowerCase().includes(cat.toLowerCase())
      ) || 'Other';
    }

    cleanIngredientName(name) {
      return name
        .replace(/(optional|divided|to taste|see note|,)/gi, '')
        .replace(/[^a-zA-Z\s]/g, '') // Remove special characters
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
    const id = Number(event.target.dataset.id); // Convert to number
    const newSource = event.target.value;

    // Search across ALL ingredients (both matched and unmatched)
    const allIngredients = [...this.selectedIngredients, ...this.unmatchedIngredients];
    const ingredient = allIngredients.find(item => item.id === id);

    if (ingredient) {
      ingredient.source = newSource; // Directly update the source
      console.log('Source updated:', ingredient); // Debug log
    } else {
      console.warn('Ingredient not found. ID:', id, 'All IDs:', allIngredients.map(i => i.id));
    }
  }
  
    handleAmountChange(event) {
      const id = Number(event.target.dataset.id); // Convert to number
      const newValue = parseFloat(event.target.value);
      
      const ingredient = this.selectedIngredients.find(item => item.id === id);
      if (ingredient && !isNaN(newValue)) {
        ingredient.amount = newValue;
      }
    }
    
    handleRemoveIngredient(event) {
      const id = Number(event.target.dataset.id);
      
      // Remove from selectedIngredients
      let index = this.selectedIngredients.findIndex(item => item.id === id);
      if (index !== -1) {
        this.selectedIngredients.splice(index, 1);
      } else {
        // Remove from unmatchedIngredients if not found in selected
        index = this.unmatchedIngredients.findIndex(item => item.id === id);
        if (index !== -1) {
          this.unmatchedIngredients.splice(index, 1);
        }
      }
      
      this.updateTable(); // Refresh the table
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
  
    // Clear
    clearForm() {
      this.elements.categoryInput.value = '';
      this.elements.ingredientInput.value = '';
    //  this.elements.amountInput.value = '';
    //  this.elements.unitInput.value = '';
      this.elements.sourceInput.value = ''; // Only clear source input
    }
  
    getIngredients() {
      return this.selectedIngredients.map(ingredient => ({
        ...ingredient,
        // Add any necessary transformations here
      }));
    }
    
    // Calculate environmental impact
    calculateEnvironmentalImpact() {
      const totals = {
        landuse: 0,
        blue_water: 0,
        CO2: 0,
        CH4: 0,
        N2O: 0,
        total_bd:0
      };
      const errors = [];
      
      // Process ALL ingredients (both matched and unmatched)
      const allIngredients = [...this.selectedIngredients, ...this.unmatchedIngredients];
      console.log("selectedIngredients: ", this.selectedIngredients); // Debug log 
    
      allIngredients.forEach(ingredient => {
      //  console.log(`Processing: ${ingredient.name} (${ingredient.comm_code})`); // Debug

        if (!ingredient.comm_code || ingredient.comm_code === 'UNKNOWN') {
          errors.push(`${ingredient.name}: Missing commodity code`);
          return;
        }
    
        const finalSource = ingredient.source || ingredient.possibleSources?.[0];


        const countryCode = DataManager.getCountryCode(finalSource);
        if (!countryCode) {
          errors.push(`${ingredient.name}: Invalid country '${ingredient.source}'`);
          return;
        }
        console.log('finalSource:', `${ingredient.name}`, finalSource, countryCode)  //DEBUG

        const factors = DataManager.getEnvImpactFactors(countryCode, ingredient.comm_code);
      //  console.log(`Factors for ${ingredient.name}:`, factors); // Debug

        if (!factors) {
          errors.push(`${ingredient.name}: No impact data for ${ingredient.source} (${countryCode})`);
          return;
        }
    
 //       const kgAmount = this.convertToKilograms(ingredient.amount, ingredient.unit);
        const tonAmount = this.convertToTons(ingredient.amount, ingredient.unit);
      //  console.log(`Converted amount for ${ingredient.name}: ${tonAmount} tons`); // Debug


        // Accumulate all metrics
        totals.landuse += tonAmount * factors.landuse;
        totals.blue_water += tonAmount * factors.blue_water;
        totals.CO2 += tonAmount * factors.CO2;
        totals.CH4 += tonAmount * factors.CH4;
        totals.N2O += tonAmount * factors.N2O;
        totals.total_bd  += tonAmount * factors.total_bd;
      });
    
      return { totals, errors };
    }

    // ============================================================================
    // Calculate total environmental impact for all ingredients
    // ============================================================================

    async calculateImpact() {
      const ingredients = this.selectedIngredients;
      
      if (ingredients.length === 0) {
        console.warn('No ingredients selected');
        return null;
      }
      
      console.log('🧮 Calculating environmental impact for', ingredients.length, 'ingredients...');
      
      // Prepare batch lookup items
      const lookupItems = [];
      const ingredientMeta = []; // Keep track of amounts and names
      
      for (const ing of ingredients) {
          // Get FABIO code for import country (where we're importing FROM)
          const importCountryCode = DataManager.getFabioCountryCode(ing.source);
          
          if (!importCountryCode) {
            console.warn(`⚠️ No FABIO country code found for: ${ing.source}`);
            continue;
          }
          
          // Get base commodity code from ingredient
          const commodityCode = ing.comm_code || this.getCommCode(ing);
          
          if (!commodityCode) {
            console.warn(`⚠️ No commodity code found for: ${ing.name}`);
            continue;
          }
          
          // Convert amount to tons
          const amountInTons = this.convertToTons(ing.amount || 0, ing.unit);
          
          lookupItems.push({
            importCountryCode: importCountryCode,  // e.g., "33" for Canada
            commodityCode: commodityCode           // e.g., "c002" for wheat
          });
          
          ingredientMeta.push({
            name: ing.name,
            source: ing.source,
            amount: amountInTons,  // Store amount in tons
            unit: ing.unit,        // Keep original unit for logging
            originalAmount: ing.amount || 0,  // Keep original for reference
            importCountryCode: importCountryCode,
            commodityCode: commodityCode
          });
          
        //  console.log(`  📦 ${ing.name} from ${ing.source}: ${importCountryCode}_${commodityCode}, ${ing.amount}${ing.unit} (${amountInTons.toFixed(6)} tons)`);
        }
      
      if (lookupItems.length === 0) {
        console.warn('No valid ingredients to calculate');
        return null;
      }
      
      console.log(`📊 Looking up impacts for ${lookupItems.length} items...`);
      
      // Batch lookup all impacts at once
      const results = await DataManager.batchGetEnvImpacts(lookupItems);
      
      // Calculate totals
      let totals = {
        biodiv: 0,
        co2e: 0,
        landUse: 0,
        waterUse: 0
      };
      
      // Store individual ingredient impacts for detailed view
      const ingredientImpacts = [];
      
      // Calculate impact for each ingredient
      results.forEach((result, index) => {
        const meta = ingredientMeta[index];
        const amount = meta.amount;
        const impacts = result.impacts;
        
        // Calculate impact for this ingredient
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
        
        // Add to totals
        totals.biodiv += ingredientImpact.biodiv;
        totals.co2e += ingredientImpact.co2e;
        totals.landUse += ingredientImpact.landUse;
        totals.waterUse += ingredientImpact.waterUse;
        
        console.log(`  ✓ ${meta.name} (${meta.source}): biodiv=${ingredientImpact.biodiv.toFixed(3)}, co2e=${ingredientImpact.co2e.toFixed(2)}`);
      });
      
      console.log('✅ Total impact calculated:', {
        biodiv: totals.biodiv.toFixed(3),
        co2e: totals.co2e.toFixed(2),
        landUse: totals.landUse.toFixed(2),
        waterUse: totals.waterUse.toFixed(2)
      });
      
      // Store for later use
      this._ingredientImpacts = ingredientImpacts;
      
      return {
        ...totals,
        total_bd: totals.biodiv,
        ingredientCount: results.length,
        details: ingredientImpacts
      };
    }


    // ============================================================================
    // Calculate impact by PRODUCING country (for map visualization)
    // Shows which countries PRODUCE the commodities in your recipe
    // Each producing country's contribution is shown individually
    // ============================================================================

    async getImpactByCountry() {
      const ingredients = this.selectedIngredients;
      
      if (ingredients.length === 0) {
        console.warn('No ingredients selected');
        return [];
      }
      
      console.log('🗺️ Calculating impact by PRODUCING country for map...');
      console.log('   (Breaking down each commodity by producer)');
      
      const allProducers = [];
      
      // For each ingredient, get breakdown by producing country
      for (const ing of ingredients) {
        // Get FABIO code for import country
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
        
        // Convert amount to tons
        const amountInTons = this.convertToTons(ing.amount || 0, ing.unit);
        
        console.log(`  📦 ${ing.name} from ${ing.source} (${importCountryCode}_${commodityCode}), ${ing.amount}${ing.unit} (${amountInTons.toFixed(6)} tons)`);
        
        // Fetch breakdown by producing country from backend
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
          
          console.log(`     Found ${breakdown.total_producers} producing countries`);
          
          // Scale by ingredient amount (already in tons) and add to results
          breakdown.producing_countries.forEach(producer => {
            // Debug: Log the producer area_code type and value
          //  console.log(`     Producer area_code: ${producer.area_code} (type: ${typeof producer.area_code})`);
            
            allProducers.push({
              producingCountryCode: String(producer.area_code),  // Ensure it's a string
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
      
      // Group by producing country (sum all impacts for each producer)
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
      
      // Convert to array and add country names and ISO3 codes for map
    const mapData = Array.from(countryTotals.values()).map(data => {
        // Debug: Show what we're looking for and what's available
      //  console.log(`🔍 Looking for FABIO code: ${data.producerCode} (type: ${typeof data.producerCode})`);
      /*  
        if (DataManager.datasets.regions) {
          console.log(`   Available region codes (first 5):`, 
            DataManager.datasets.regions.slice(0, 5).map(r => 
              `${r.CountryCode} (${typeof r.CountryCode})`
            ).join(', ')
          );
        }
        */
        // Get country info from regions dataset using FABIO code (area_code)
        // Normalize both codes to integers for comparison
        const region = DataManager.datasets.regions.find(r => {
          const regionCode = parseInt(String(r.CountryCode).trim());
          const producerCode = parseInt(String(data.producerCode).trim());
          
          if (isNaN(regionCode) || isNaN(producerCode)) {
            console.warn(`   Invalid code comparison: regionCode=${regionCode}, producerCode=${producerCode}`);
            return false;
          }
          
          return regionCode === producerCode;
        });
        
        if (!region) {
          console.warn(`❌ No region found for FABIO code ${data.producerCode}`);
          return null;
        }
        
      //  console.log(`✅ Found region: ${region.CountryName} (${region.iso3c})`);
        
        return {
          country: region.CountryName,
          countryCode: region.iso3c,
          fabioCode: data.producerCode,
          biodiv: data.biodiv,
          co2e: data.co2e,
          land: data.landUse,
          water: data.waterUse,
          waterUse: data.waterUse,
          total_bd: data.biodiv,
          commodities: [...new Set(data.commodities)]
        };
      }).filter(Boolean);
      
      // Sort by biodiversity impact (highest first)
      mapData.sort((a, b) => b.biodiv - a.biodiv);
      
      /* Debug logging

      console.log(`✅ Impact breakdown by ${mapData.length} producing countries:`);
      mapData.forEach(country => {
        console.log(`  🏭 ${country.country} (FABIO ${country.fabioCode}): biodiv=${country.biodiv.toFixed(3)}`);
        console.log(`     Produces: ${country.commodities.join(', ')}`);
      });
      */
      return mapData;
    }

    // ============================================================================
    // Helper method to get commodity code
    // ============================================================================

    getCommCode(ingredient) {
      // If comm_code is already stored in the ingredient
      if (ingredient.comm_code) {
        return ingredient.comm_code;
      }
      
      // Otherwise look it up in database
      const dbEntry = DataManager.database.find(item => 
        item.Ingredient?.trim().toLowerCase() === ingredient.name?.trim().toLowerCase()
      );
      
      return dbEntry?.comm_code || null;
    }


    // Add these helper methods
    formatNumber(value) {
      return Number(value.toFixed(3));
    }

    convertToKilograms(amount, unit) {
      const conversions = {
        'g': amount => amount / 1000,
        'kg': amount => amount,
        'ml': amount => amount * 0.001,    // Assuming water-like density
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
        'g': amount => amount / 1e6,       // grams to tons (1g = 0.000001 tons)
        'kg': amount => amount / 1000,     // kg to tons (1kg = 0.001 tons)
        'ounce': amount => amount * 0.0000283495,  // 1 ounce = 0.0000283495 tons
        'lb': amount => amount * 0.000453592,      // 1 pound = 0.000453592 tons
        'cup': amount => amount * 0.000236588,     // 1 cup (water) ≈ 0.000236588 tons
        'tbsp': amount => amount * 0.0000147868,   // 1 tbsp (water) ≈ 0.0000147868 tons
        'tsp': amount => amount * 0.00000492892,   // 1 tsp (water) ≈ 0.00000492892 tons
        'unit': amount => amount / 1000/50    // Default assumption for 'unit' (treat as kg/50)
      };
    
      return conversions[unit]?.(Number(amount)) || 0;
    }

  }


