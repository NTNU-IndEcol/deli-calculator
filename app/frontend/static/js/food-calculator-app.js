// food-calculator-app.js

import { DataManager } from './data-manager.js';
import { AutocompleteHandler } from './autocomplete.js';
import { FormHandler } from './form-handler.js';
import { ResultsView } from './results-view.js';

export class FoodCalculatorApp {
    constructor() {
      this.autocompleteInstances = {}; // Add this line
      this.formHandler = new FormHandler(); // Create FormHandler instance
      this.initializeApp();
      this.selectedIngredients = [];
    }
  
    async initializeApp() {
      try {
        // Initialize core systems first
        await DataManager.initialize();
        
        // Set up UI components after data is ready
        this.setupAutocomplete();
        this.setupEventListeners();
        
        console.log('🍎 Application initialized successfully');
      } catch (error) {
        console.error('🚨 Critical initialization error:', error);
        ResultsView.showError('Failed to initialize application');
      }
    }
  
    setupAutocomplete() {
      const app = this; // Capture 'this' reference
  
      // Single category autocomplete handler
      
      new AutocompleteHandler({
        input: '#category-input',
        dataset: DataManager.categories,
        onSelect: (selectedCategory) => {
          // Clear previous selections
          document.getElementById('ingredient-input').value = '';
          
          // Update category display
          FormHandler.updateCategory(selectedCategory);
          
          // Update ingredient list
          const ingredients = DataManager.getIngredientsByCategory(selectedCategory);
          app.updateIngredientAutocomplete(ingredients);
        }
      });
   /*   
      new AutocompleteHandler({
        input: '#category-input',
        dataset: DataManager.categories,
        onSelect: (selectedCategory) => {
          const input = document.getElementById('category-input');
          input.value = selectedCategory; // Explicit set
          input.dispatchEvent(new Event('input')); // Trigger validation update
        }
      });
  */
  
        // Ingredient autocomplete
       
      this.autocompleteInstances.ingredient = new AutocompleteHandler({
        input: '#ingredient-input',
        dataset: DataManager.ingredients,
        onSelect: (selectedIngredient) => {
          const ingredient = DataManager.database.find(item => 
            item.Ingredient.trim() === selectedIngredient.trim()
          );
          
          if (ingredient) {
            FormHandler.updateCategory(ingredient["Food group"].trim());
            const countries = [
              ingredient.Top1,
              ingredient.Top2,
              ingredient.Top3,
              ingredient.Top4,
              ingredient.Top5
            ].filter(Boolean);
            this.autocompleteInstances.source.updateDataset(countries);
          }
        }
      });
      
      /*
      this.autocompleteInstances.source = new AutocompleteHandler({
        input: '#source-input',
        dataset: DataManager.importCountries,
        onSelect: (selectedCountry) => {
          const input = document.getElementById('source-input');
          input.value = selectedCountry;
          input.dispatchEvent(new Event('input'));
        }
      }); 
      */
  
      // Store the source autocomplete instance
      this.autocompleteInstances.source = new AutocompleteHandler({
        input: '#source-input',
        dataset: DataManager.importCountries,
        onSelect: (selectedCountry) => {
          // Directly store the selected country
          document.getElementById('source-input').value = selectedCountry;
        }
      });
  
  
    }

  
    setupEventListeners() {

      // Save correction handler (FIXED)
      this.formHandler.elements.tableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('save-correction-btn')) {
          const index = e.target.dataset.index;
          const row = this.formHandler.selectedIngredients[index];
          
          // Get updated values
          row.name = document.querySelector(`[data-index="${index}"] .editable-name`).textContent;
          row.category = document.querySelector(`[data-index="${index}"] .editable-category`).textContent;
          row.amount = parseFloat(document.querySelector(`[data-index="${index}"] .amount-input`).value);
          row.unit = document.querySelector(`[data-index="${index}"] .unit-input`).value;
  
          // Re-check against database
          this.formHandler.validateAgainstDatabase(row);
        }
      });
 
      // Calculate button (FIXED)
      document.getElementById('calculate-selected')
        .addEventListener('click', async () => {
          const ingredients = this.formHandler.getIngredients();
          const results = await DataManager.calculateImpact(ingredients);
          ResultsView.display(results);
        });
        
    }
      
    updateIngredientAutocomplete(ingredients) {
      this.autocompleteInstances.ingredient.updateDataset(ingredients);
      
      // Force show dropdown
      document.getElementById('ingredient-input').focus();
      this.autocompleteInstances.ingredient.showSuggestions();
    }

    /*
    loadRecipe() {
      const recipeData = ApiClient.getSavedRecipes();
    
      // Match ingredients with database - FIXED PROPERTY NAME
      const matchedIngredients = recipeData.recipeIngredient.map(item => {
        // Use mainIngredient instead of name
        const cleanName = (item.mainIngredient || '').trim().toLowerCase();
        return DataManager.database.find(ingredient => 
          ingredient.Ingredient.toLowerCase().includes(cleanName)
        );
      }).filter(Boolean);
    
      console.log('Matched ingredients:', matchedIngredients);
      this.formHandler.updateTable(matchedIngredients);
    }
  */
 
  }
  