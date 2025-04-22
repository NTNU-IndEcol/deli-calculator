// frontend/static/js/ui/form-handler.js
import { DataManager } from './data-manager.js'; // Add this line
import { ApiClient } from './api-client.js'; // Add proper import

export class FormHandler {
    constructor() {
      this.selectedIngredients = [];
      this.unmatchedIngredients = [];
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
          <option value="Local">Local</option>
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
    
      const newIngredient = {
        id: Date.now(),
        category: validation.data.category,
        name: validation.data.ingredient,
        amount: validation.data.amount,
        unit: validation.data.unit,
        source: validation.data.source,
        matched: false
      };
    
      // Process immediately without adding to unmatched first
      this.processNewIngredient(newIngredient);
      this.updateTable();
    }
    
    processNewIngredient(ingredient) {
      const match = DataManager.database.find(item => 
        this.fuzzyMatch(item.Ingredient, ingredient.name)
      );
    
      if (match) {
        this.selectedIngredients.push({
          ...ingredient,
          ...this.createMatchedIngredient(match)
        });
      } else {
        this.unmatchedIngredients.push(ingredient);
      }
    }

    // Update the normalizeUnit method
    normalizeUnit(unit) {
      // Preserve original unit if valid, default to 'unit' only when empty
      const validUnits = ['g', 'kg', 'cup', 'tbsp', 'tsp', 'unit', 'ounce', 'oz', 'lb'];
      const cleanUnit = String(unit || 'unit').toLowerCase().trim();
      return validUnits.includes(cleanUnit) ? cleanUnit : 'unit'; // Only replace truly invalid units
    }


    // loadSavedRecipe method in form-handler.js
   
    async loadSavedRecipe() {
      try {
        const ingredients = await DataManager.loadSavedRecipe();
        if (!ingredients.length) throw new Error('No ingredients found');
    
        // Reset state
        this.selectedIngredients = [];
        this.unmatchedIngredients = [];
    
        // Process ingredients
        const processedIngredients = ingredients.map(ing => {
          const cleanName = this.cleanIngredientName(ing.mainIngredient || ing.name);
          return {
            id: Date.now() + Math.random(),
            category: ing.category,
            name: cleanName,
            amount: this.parseAmount(ing.amount),
            unit: this.normalizeUnit(ing.unit),
            source: ing.source,
            matched: false // Start as unmatched
          };
        });
    
        // Pass ingredients to matching system
        this.initDatabaseMatching(processedIngredients);
        this.updateTable();
        
      } catch (error) {
        console.error('Recipe loading failed:', error);
        this.showErrors([error.message]);
      }
    }
    // Unified table update for both sources
    updateTable() {
      this.elements.tableBody.innerHTML = '';
      
      // Create combined list without duplicates
      const allIngredients = [
        ...new Map([...this.selectedIngredients, ...this.unmatchedIngredients]
          .map(item => [item.id, item]))
          .values()
      ];
    
      allIngredients.forEach((ingredient, index) => {
        const row = this.createTableRow(ingredient, index);
        this.elements.tableBody.appendChild(row);
      });
    
      this.setupRowInteractions();
    }
 
    createTableRow(ingredient, index) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="${!ingredient.matched ? 'unmatched' : ''}">
          ${ingredient.matched ? 
            `<span class="editable-category">${ingredient.category}</span>` :
            `<input type="text" class="category-input" value="${ingredient.category}">`
          }
        </td>
        <td class="${!ingredient.matched ? 'unmatched' : ''}">
          ${ingredient.matched ? 
            `<span class="editable-name">${ingredient.name}</span>` :
            `<input type="text" class="name-input" value="${ingredient.name}">`
          }
        </td>
        <td>
          <input type="number" class="amount-input" 
                 value="${ingredient.amount}" min="0" step="0.1"
                 data-index="${index}">
        </td>
        <td>
          <select class="unit-input" data-index="${index}">
            ${['g', 'kg', 'unit', 'tbsp', 'tsp', 'ounce', 'oz'].map(unit => `
              <option value="${unit}" ${unit === ingredient.unit ? 'selected' : ''}>
                ${unit}
              </option>
            `).join('')}
          </select>
        </td>
        <td class="source-cell">
          ${this.createSourceInput(ingredient, index)}
        </td>
        <td>
          ${!ingredient.matched ?
            `<button class="save-btn" data-index="${index}">💾</button>` : ''
          }
          <button class="remove-btn" data-index="${index}">🗑️</button>
        </td>
      `;
      return row;
    }
  
    createSourceInput(ingredient, index) {
      if (!ingredient.matched) return 'Match required';
      
      return `
        <select class="source-select" data-index="${index}">
          <option value="Local">Local</option>
          ${ingredient.possibleSources?.map(country => `
            <option value="${country}" ${country === ingredient.source ? 'selected' : ''}>
              ${country}
            </option>
          `).join('')}
        </select>
      `;
    }
  
    // Unified matching initialization
    initDatabaseMatching() {
      // Only process unmatched ingredients once
      const newlyMatched = [];
      const stillUnmatched = [];
    
      this.unmatchedIngredients.forEach(ingredient => {
        const match = DataManager.database.find(item => 
          this.fuzzyMatch(item.Ingredient, ingredient.name)
        );
        
        if (match) {
          newlyMatched.push({ 
            ...ingredient,
            ...this.createMatchedIngredient(match)
          });
        } else {
          stillUnmatched.push(ingredient);
        }
      });
    
      // Update arrays
      this.selectedIngredients = [...this.selectedIngredients, ...newlyMatched];
      this.unmatchedIngredients = stillUnmatched;
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
        commCode: dbEntry.comm_code,
        possibleSources: [
          dbEntry.Top1, dbEntry.Top2, dbEntry.Top3, dbEntry.Top4, dbEntry.Top5
        ].filter(Boolean)
      };
    }
  
    setupRowInteractions() {
      // Handle manual corrections
      document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const index = e.target.dataset.index;
          const ingredient = this.unmatchedIngredients[index];
          
          // Update from inputs
          ingredient.category = document.querySelector(`[data-index="${index}"] .category-input`).value;
          ingredient.name = document.querySelector(`[data-index="${index}"] .name-input`).value;
          
          // Try to match again
          const match = DataManager.database.find(item => 
            this.fuzzyMatch(item.Ingredient, ingredient.name)
          );
          
          if (match) {
            this.selectedIngredients.push({ ...ingredient, ...this.createMatchedIngredient(match) });
            this.unmatchedIngredients.splice(index, 1);
          }
          
          this.updateTable();
        });
      });
  
      // ... rest of interaction handlers
    }
    
    // Replace both initDatabaseMatching methods with this single version
    initDatabaseMatching(ingredients = []) {
      // Clear previous matches
      const newlyMatched = [];
      const stillUnmatched = [];

      // Process provided ingredients or use class properties
      const itemsToProcess = ingredients.length ? ingredients : this.selectedIngredients;
      
      itemsToProcess.forEach(ingredient => {
        const match = DataManager.database.find(item => 
          this.fuzzyMatch(item.Ingredient, ingredient.name)
        );
        
        if (match) {
          newlyMatched.push({ 
            ...ingredient,
            ...this.createMatchedIngredient(match)
          });
        } else {
          stillUnmatched.push(ingredient);
        }
      });

      // Update state
      this.selectedIngredients = [...this.selectedIngredients, ...newlyMatched];
      this.unmatchedIngredients = [...this.unmatchedIngredients, ...stillUnmatched];
    }
    
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

    normalizeUnit(unit) {
      const units = ['g', 'kg', 'cup', 'tbsp', 'tsp'];
      return units.includes(unit.toLowerCase()) ? unit : 'unit';
    }

    extractSource(text) {
      const countryMatch = text.match(/\((.*?)\)/);
      return countryMatch ? countryMatch[1] : 'Local';
    }
  
  
    handleAmountChange(event) {
      const index = event.target.dataset.index;
      const newValue = parseFloat(event.target.value);
      
      if (!isNaN(newValue)) {
        this.selectedIngredients[index].amount = newValue;
      }
    }
  
    handleSourceChange(event) {
      const index = event.target.dataset.index;
      const newSource = event.target.value;
      
      this.selectedIngredients[index].source = newSource;
      
      // Safely handle country input visibility
      if (newSource === 'Imported' && this.elements.countryInput) {
        this.elements.countryInput.style.display = 'inline-block';
      } else if (this.elements.countryInput) {
        this.elements.countryInput.style.display = 'none';
      }
      
      // Re-render row to show/hide country input
      this.updateTable();
    }
  
    handleRemoveIngredient(event) {
      const index = event.target.dataset.index;
      this.selectedIngredients.splice(index, 1);
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
  
    // Clear
    clearForm() {
      this.elements.categoryInput.value = '';
      this.elements.ingredientInput.value = '';
      this.elements.amountInput.value = '';
      this.elements.unitInput.value = '';
      this.elements.sourceInput.value = ''; // Only clear source input
    }
  
    getIngredients() {
      return this.selectedIngredients.map(ingredient => ({
        ...ingredient,
        // Add any necessary transformations here
      }));
    }
  }


