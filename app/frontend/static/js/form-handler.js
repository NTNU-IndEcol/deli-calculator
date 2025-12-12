// frontend/static/js/form-handler.js
import { DataManager } from './data-manager.js';
import { ApiClient } from './api-client.js';
import { AutocompleteHandler } from './autocomplete.js';

export class FormHandler {
    constructor() {
      this.selectedIngredients = [];
      this.unmatchedIngredients = [];
      this.recipeLoaded = false;
      this.currentIngredientData = null; // Store current ingredient database matches
      
      this.initializeElements();
      this.setupEventListeners();
      this.setupAutocomplete(); // NEW: Initialize autocomplete
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

    // 🆕 NEW: Setup autocomplete for ingredient, category, and source
    setupAutocomplete() {
      // Get unique ingredients from database
      const database = DataManager.database || [];
      const uniqueIngredients = [...new Set(database.map(item => item.Ingredient))].sort();
      
      console.log(`🔧 Setting up autocomplete with ${uniqueIngredients.length} ingredients`);
      
      // Ingredient autocomplete
      this.ingredientAutocomplete = new AutocompleteHandler({
        input: '#ingredient-input',
        dataset: uniqueIngredients,
        maxSuggestions: 10,
        onSelect: (ingredient) => {
          console.log('✅ Ingredient selected:', ingredient);
          this.handleIngredientSelection(ingredient);
        }
      });
      
      // Category autocomplete (will be populated when ingredient is selected)
      this.categoryAutocomplete = new AutocompleteHandler({
        input: '#category-input',
        dataset: [],
        maxSuggestions: 5,
        onSelect: (category) => {
          console.log('✅ Category selected:', category);
          this.handleCategorySelection(category);
        }
      });
      
      // Source autocomplete (will be populated when ingredient is selected)
      this.sourceAutocomplete = new AutocompleteHandler({
        input: '#source-input',
        dataset: [],
        maxSuggestions: 5,
        onSelect: (source) => {
          console.log('✅ Source selected:', source);
        }
      });
    }

    // 🆕 NEW: Handle ingredient selection from autocomplete
    handleIngredientSelection(ingredientName) {
      const database = DataManager.database || [];
      
      // Find all database entries for this ingredient
      const matches = database.filter(
        item => item.Ingredient === ingredientName
      );
      
      if (matches.length === 0) {
        console.warn('No data found for ingredient:', ingredientName);
        return;
      }
      
      console.log(`📊 Found ${matches.length} entries for ${ingredientName}`);
      
      // Get unique categories for this ingredient
      const categories = [...new Set(matches.map(item => item["Food group"]))].filter(Boolean).sort();
      
      // Auto-fill category with the first one
      if (categories.length > 0) {
        this.elements.categoryInput.value = categories[0];
        console.log('🏷️ Auto-filled category:', categories[0]);
      }
      
      // Update category autocomplete with all available categories
      this.categoryAutocomplete.updateDataset(categories);
      
      // Store current ingredient data for later use
      this.currentIngredientData = matches;
      
      // Update source options based on first category
      if (categories.length > 0) {
        this.updateSourceOptions(ingredientName, categories[0]);
      }
    }

    // 🆕 NEW: Handle category selection from autocomplete
    handleCategorySelection(category) {
      const ingredientName = this.elements.ingredientInput.value;
      
      if (!ingredientName) {
        console.warn('No ingredient selected');
        return;
      }
      
      // Update source options when category changes
      this.updateSourceOptions(ingredientName, category);
    }

    // 🆕 NEW: Update source options based on ingredient and category
    updateSourceOptions(ingredientName, category) {
      if (!this.currentIngredientData) return;
      
      // Filter by selected category
      const categoryMatches = this.currentIngredientData.filter(
        item => item["Food group"] === category
      );
      
      if (categoryMatches.length === 0) {
        console.warn('No data for category:', category);
        return;
      }
      
      // Get top 5 import countries from the database entry
      const match = categoryMatches[0];
      const topCountries = [match.Top1, match.Top2, match.Top3, match.Top4, match.Top5]
        .filter(Boolean);
      
      console.log('🌍 Top import countries:', topCountries);
      
      // Auto-fill source with top country
     /*
      if (topCountries.length > 0) {
        this.elements.sourceInput.value = topCountries[0];
        console.log('📍 Auto-filled source:', topCountries[0]);
      }
      */
      // Update source autocomplete
      this.sourceAutocomplete.updateDataset(topCountries);
    }

    // 🔥 IMPROVED: Parse amount from various formats
    parseAmount(amount) {
      // Handle null/undefined
      if (amount === null || amount === undefined) {
        console.warn('  ⚠️ Amount is null/undefined, defaulting to 1');
        return 1;
      }
      
      // Already a number
      if (typeof amount === 'number') {
        return amount;
      }
      
      // String parsing
      if (typeof amount === 'string') {
        // Remove all non-numeric except dots, dashes, and slashes
        let cleaned = amount.trim();
        
        // Handle ranges like "3 - 4" → take average
        if (cleaned.includes('-')) {
          const parts = cleaned.split('-').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
          if (parts.length === 2) {
            const avg = (parts[0] + parts[1]) / 2;
            console.log(`  → Range "${cleaned}" → Average: ${avg}`);
            return avg;
          }
        }
        
        // Handle fractions like "1/2" or "1 1/2"
        if (cleaned.includes('/')) {
          // Split on spaces to handle mixed fractions
          const parts = cleaned.split(/\s+/);
          let total = 0;
          
          for (const part of parts) {
            if (part.includes('/')) {
              const [num, denom] = part.split('/').map(n => parseFloat(n));
              if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
                total += num / denom;
              }
            } else {
              const num = parseFloat(part);
              if (!isNaN(num)) {
                total += num;
              }
            }
          }
          
          if (total > 0) {
            console.log(`  → Fraction "${cleaned}" → ${total}`);
            return total;
          }
        }
        
        // Handle special characters (½, ⅓, ¼, etc.)
        const fractionMap = {
          '½': 0.5, '⅓': 0.333, '⅔': 0.667, '¼': 0.25, '¾': 0.75,
          '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 0.167, '⅚': 0.833,
          '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
        };
        
        for (const [symbol, value] of Object.entries(fractionMap)) {
          if (cleaned.includes(symbol)) {
            // Handle mixed fractions like "1½"
            const beforeFraction = cleaned.split(symbol)[0].trim();
            const whole = beforeFraction ? parseFloat(beforeFraction) : 0;
            const result = (isNaN(whole) ? 0 : whole) + value;
            console.log(`  → Special char "${cleaned}" → ${result}`);
            return result;
          }
        }
        
        // Simple float parse
        const simple = parseFloat(cleaned.replace(/[^\d.]/g, ''));
        if (!isNaN(simple)) {
          return simple;
        }
      }
      
      // Fallback
      console.warn(`  ⚠️ Could not parse amount "${amount}", defaulting to 1`);
      return 1;
    }

    // 🔥 IMPROVED: Normalize unit names
    normalizeUnit(unit) {
      if (!unit || unit === null || unit === 'null') {
        return 'unit';
      }
      
      const unitStr = String(unit).toLowerCase().trim();
      
      const unitAliases = {
        // Weight
        'oz': 'ounce', 'ounces': 'ounce', 'ounce': 'ounce',
        'pound': 'lb', 'pounds': 'lb', 'lbs': 'lb', 'lb': 'lb',
        'gram': 'g', 'grams': 'g', 'g': 'g',
        'kilogram': 'kg', 'kilograms': 'kg', 'kg': 'kg',
        
        // Volume
        'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tsp': 'tsp',
        'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbsp': 'tbsp',
        'cup': 'cup', 'cups': 'cup',
        'milliliter': 'ml', 'milliliters': 'ml', 'ml': 'ml',
        'liter': 'l', 'liters': 'l', 'l': 'l',
        
        // Count
        'piece': 'unit', 'pieces': 'unit', 'item': 'unit', 'items': 'unit',
        'medium': 'unit', 'large': 'unit', 'small': 'unit',
        'whole': 'unit', 'clove': 'unit', 'cloves': 'unit'
      };
      
      // Check if it's in the map
      if (unitAliases[unitStr]) {
        return unitAliases[unitStr];
      }
      
      // Return valid units as-is
      const validUnits = ['g', 'kg', 'cup', 'tbsp', 'tsp', 'ounce', 'lb', 'ml', 'l', 'unit'];
      if (validUnits.includes(unitStr)) {
        return unitStr;
      }
      
      // Default to 'unit' for unknown
      return 'unit';
    }
  
    setupEventListeners() {
      // 🆕 UPDATED: Clear category and source when ingredient is manually cleared
      this.elements.ingredientInput.addEventListener('input', (e) => {
        if (e.target.value.trim() === '') {
          this.elements.categoryInput.value = '';
          this.elements.sourceInput.value = '';
          this.currentIngredientData = null;
          this.categoryAutocomplete.updateDataset([]);
          this.sourceAutocomplete.updateDataset([]);
        }
        this.clearErrors();
      });

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

      // 🆕 NEW: Add Enter key support for all input fields
      [this.elements.ingredientInput, this.elements.categoryInput, 
       this.elements.amountInput, this.elements.unitInput, 
       this.elements.sourceInput].forEach(input => {
        if (input) {
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              this.handleAddIngredient();
            }
          });
          input.addEventListener('input', () => this.clearErrors());
          input.addEventListener('change', () => this.clearErrors());
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
      if (isNaN(currentInputs.amount) || currentInputs.amount <= 0) errors.push('Valid amount is required');
      if (!currentInputs.unit) errors.push('Unit is required');
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
    
      this.clearErrors();
    
      // Try to find the database match for the selected ingredient
      const match = this.findBestMatch(validation.data.ingredient);

      const newIngredient = {
        id: Date.now() + Math.random(),
        category: validation.data.category,
        name: validation.data.ingredient,
        amount: validation.data.amount,
        unit: validation.data.unit,
        source: validation.data.source,
        comm_code: match?.comm_code || 'UNKNOWN',
        matched: !!match
      };
    
      this.processNewIngredient(newIngredient);
      this.updateTable();
      this.clearForm();
    }
  
    // 🔥 ENHANCED: Smart name extraction + matching + amount parsing
    processNewIngredient(ingredient) {
      const fullName = ingredient.name || ingredient.mainIngredient;
      
      if (!fullName) {
        console.error('❌ Ingredient missing name:', ingredient);
        return;
      }

      // 🔥 FIX: Parse amount properly - handle nested details structure
      const amount = ingredient.amount ?? ingredient.details?.amount;
      const unit = ingredient.unit ?? ingredient.details?.unit;
      

      // 🔥 FIX: Parse amount properly
      //const parsedAmount = this.parseAmount(ingredient.amount);
      //const parsedUnit = this.normalizeUnit(ingredient.unit);
      const parsedAmount = this.parseAmount(amount);
      const parsedUnit = this.normalizeUnit(unit);

      console.log(`🔍 Processing: "${fullName}" (${parsedAmount} ${parsedUnit})`);

      // Extract core ingredient name
      const extracted = this.extractIngredientName(fullName);
      const displayName = extracted.display;
      const coreName = extracted.core;
      
      console.log(`  → Display: "${displayName}"`);
      console.log(`  → Core for matching: "${coreName}"`);
      
      // Try to match using core name
      const match = this.findBestMatch(coreName);
    
      if (match) {
        const possibleSources = [match.Top1, match.Top2, match.Top3, match.Top4, match.Top5].filter(Boolean);
        const ingredientId = ingredient.id || Date.now() + Math.random();
        
        this.selectedIngredients.push({
          ...ingredient,
          id: ingredientId,
          originalName: fullName,
          displayName: fullName,
          name: match.Ingredient,
          matchedTo: match.Ingredient,
          category: match["Food group"],
          comm_code: match.comm_code,
          matched: true,
          amount: parsedAmount,
          unit: parsedUnit,
          possibleSources: possibleSources,
          source: ingredient.source || possibleSources[0] || ''
        });
        
        console.log(`✅ Matched "${displayName}" → "${match.Ingredient}" (${match.comm_code})`);
        console.log(`   Category: ${match["Food group"]}`);
      } else {
        const ingredientId = ingredient.id || Date.now() + Math.random();
        
        this.unmatchedIngredients.push({
          ...ingredient,
          id: ingredientId,
          originalName: fullName,
          displayName: displayName,
          name: displayName,
          comm_code: 'UNKNOWN',
          matched: false,
          amount: parsedAmount,
          unit: parsedUnit,
          possibleSources: DataManager.getAllCountries() || [''],
          source: ingredient.source || ''
        });
        
        console.warn(`⚠️ No match found for "${displayName}" (core: "${coreName}")`);
      }
    }

    // 🔥 NEW: Extract core ingredient name from detailed descriptions
    extractIngredientName(fullName) {
        // Core ingredients to look for
        // ⚠️ Order matters! Put compound ingredients first, then singular
        const coreIngredients = [
            // Compound terms first (to match "chicken eggs" before "chicken")
            'chicken eggs', 'duck eggs', 'goose eggs', 'turkey eggs',
            
            // Then individual terms
            'cheese', 'butter', 'milk', 'cream', 'yogurt', 'yoghurt',
            'chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'ribs',
            'tomato', 'potato', 'onion', 'garlic', 'carrot', 'lettuce', 'cabbage', 'pepper', 'paprika',
            'cucumber', 'spinach', 'broccoli', 'cauliflower', 'mushroom', 'corn', 'peas', 'salad',
            'apple', 'banana', 'orange', 'lemon', 'lime', 'berry', 'pear',
            'bread', 'baguette', 'rice', 'pasta', 'noodle', 'flour', 'wheat', 'oat',
            'egg', 'eggs', 'oil', 'sugar', 'salt', 'sauce', 'wine', 'beer', 'water', 'juice',  // ✅ Added 'egg' and 'eggs'
            'soy', 'ginger', 'sesame', 'honey', 'vinegar'
        ];
        
        const cleaned = fullName
            .toLowerCase()
            .trim()
            .replace(/\d+\s*(g|kg|ml|l|oz|lb|%|percent)/gi, '')
            .replace(/\b\d+\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Try to find a core ingredient
        for (const core of coreIngredients) {
            if (cleaned.includes(core)) {
                // For multi-word cores like "chicken eggs", use the whole phrase
                if (core.includes(' ')) {
                    return {
                        display: core,
                        core: core,
                        original: fullName
                    };
                }
                
                // For single-word cores
                const words = cleaned.split(' ');
                const coreIndex = words.indexOf(core);
                
                let displayWords = [];
                if (coreIndex > 0) {
                    displayWords.push(words[coreIndex - 1]);
                }
                displayWords.push(core);
                
                return {
                    display: displayWords.join(' '),
                    core: core,
                    original: fullName
                };
            }
        }
        
        // Fallback: clean up but keep most significant words
        const noiseWords = ['g', 'kg', 'ml', 'large', 'small', 'medium', 'pack', 'fresh', 'organic'];
        const words = cleaned.split(' ').filter(w => 
            w.length >= 3 && !noiseWords.includes(w)
        );
        
        const display = words.slice(-2).join(' ') || cleaned;
        const core = words[words.length - 1] || cleaned;
        
        return {
            display: display,
            core: core,
            original: fullName
        };
    }

    fuzzyMatch(dbName, inputName) {
      const cleanDb = dbName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const cleanInput = inputName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      
      if (cleanDb === cleanInput) return 5;
      
      const dbWords = cleanDb.split(' ');
      const inputWords = cleanInput.split(' ');
      
      if (dbWords.every(word => inputWords.includes(word))) return 4;
      if (cleanInput.includes(cleanDb)) return 3;
      if (cleanDb.includes(cleanInput)) return 2;
      
      const matchingWords = dbWords.filter(word => inputWords.includes(word));
      if (matchingWords.length > 0) return 1;
      
      return 0;
    }
    
    findBestMatch(inputName) {
      if (!DataManager.database || DataManager.database.length === 0) {
        console.error('❌ Database not loaded!');
        return null;
      }
      
      let bestMatch = null;
      let bestScore = 0;
      
      for (const item of DataManager.database) {
        if (!item.Ingredient) continue;
        
        const dbName = item.Ingredient.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const score = this.fuzzyMatch(dbName, inputName);
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }
      }
      
      return bestScore >= 2 ? bestMatch : null;
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
        
        if (!ingredient.id) {
            ingredient.id = Date.now() + Math.random();
        }
        
        const nameToShow = ingredient.displayName || ingredient.name;
        const matchInfo = ingredient.matched ? 
            `Matched to: ${ingredient.matchedTo} (${ingredient.comm_code})` : 
            'Not in database';
        
        row.innerHTML = `
            <td data-label="Ingredient" class="${!ingredient.matched ? 'unmatched' : ''}" title="${ingredient.originalName || nameToShow}">
                ${ingredient.matched ? 
                    `<span class="editable-name">${nameToShow}</span>` :
                    `<input type="text" class="name-input" value="${nameToShow}" placeholder="Not in database">`
                }
            </td>
            <td data-label="Category" class="${!ingredient.matched ? 'unmatched' : ''}">
                ${ingredient.matched ? 
                    `<span class="editable-category" title="${matchInfo}">${ingredient.category}</span>` :
                    `<input type="text" class="category-input" value="${ingredient.category || ''}" placeholder="Unmatched">`
                }
            </td>
            <td data-label="Amount">
                <input type="number" class="amount-input" 
                      value="${ingredient.amount || 1}" 
                      min="0" 
                      step="0.1"
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
            <td data-label="Source" class="source-cell">
                ${this.createSourceInput(ingredient)}
            </td>
            <td data-label="Action">
                <button class="remove-btn" data-id="${ingredient.id}">🗑️</button>
            </td>
        `;
        return row;
    }

    createSourceInput(ingredient) {
        if (!ingredient.id) {
            ingredient.id = Date.now() + Math.random();
        }
        
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

    setupRowInteractions() {
      document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const id = Number(e.target.dataset.id);
          const ingredient = this.unmatchedIngredients.find(item => item.id === id);
          
          if (ingredient) {
            const row = e.target.closest('tr');
            ingredient.category = row.querySelector('.category-input').value;
            ingredient.name = row.querySelector('.name-input').value;
            
            const match = this.findBestMatch(ingredient.name);
            
            if (match) {
              const possibleSources = [match.Top1, match.Top2, match.Top3, match.Top4, match.Top5].filter(Boolean);
              this.selectedIngredients.push({ 
                ...ingredient, 
                category: match["Food group"],
                comm_code: match.comm_code,
                matched: true,
                possibleSources: possibleSources,
                source: ingredient.source || possibleSources[0] || ''
              });
              this.unmatchedIngredients = this.unmatchedIngredients.filter(item => item.id !== id);
            }
            this.updateTable();
          }
        });
      });
    }
    
    handleSourceChange(event) {
      const id = Number(event.target.dataset.id);
      const newSource = event.target.value;

      const allIngredients = [...this.selectedIngredients, ...this.unmatchedIngredients];
      const ingredient = allIngredients.find(item => item.id === id);

      if (ingredient) {
        ingredient.source = newSource;
      }
    }
  
    handleUnitChange(event) {
      const index = Number(event.target.dataset.index);
      const newUnit = event.target.value;
      
      const allIngredients = [...this.selectedIngredients, ...this.unmatchedIngredients];
      const ingredient = allIngredients[index];
      
      if (ingredient) {
        ingredient.unit = newUnit;
      }
    }

    handleAmountChange(event) {
      const id = Number(event.target.dataset.id);
      const newValue = parseFloat(event.target.value);
      
      const allIngredients = [...this.selectedIngredients, ...this.unmatchedIngredients];
      const ingredient = allIngredients.find(item => item.id === id);
      
      if (ingredient && !isNaN(newValue)) {
        ingredient.amount = newValue;
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
      this.elements.amountInput.value = '100';
      this.elements.unitInput.value = 'g';
      this.elements.sourceInput.value = '';
      this.currentIngredientData = null;
      
      // Clear autocomplete datasets
      this.categoryAutocomplete.updateDataset([]);
      this.sourceAutocomplete.updateDataset([]);
      
      // Focus back to ingredient input
      this.elements.ingredientInput.focus();
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
            name: ing.displayName || ing.name,
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
      });
      
      console.log('✅ Total impact calculated');
      
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
              commodity: ing.displayName || ing.name,
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