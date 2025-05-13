// food-calculator-app.js

import { DataManager } from './data-manager.js';
import { AutocompleteHandler } from './autocomplete.js';
import { FormHandler } from './form-handler.js';
import { ResultsView } from './results-view.js';

export class FoodCalculatorApp {
    constructor(formHandler) {
      this.autocompleteInstances = {}; // Add this line
      this.formHandler = formHandler; //new FormHandler(); // Create FormHandler instance
      this.resultsView = new ResultsView(); // Add ResultsView instance
      this.initializeApp();
  //    this.selectedIngredients = [];
    }
  

    initializeApp(){
      
      DataManager.initialize().then(() => {
        this.setupAutocomplete();
        this.setupEventListeners();

        this.formHandler.loadRecipe(); 


      })

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
  
      // Ingredient autocomplete
       
      this.autocompleteInstances.ingredient = new AutocompleteHandler({
        input: '#ingredient-input',
        dataset: DataManager.ingredients,
        onSelect: (selectedIngredient) => {
          const ingredient = DataManager.database.find(item => 
            item.Ingredient.trim() === selectedIngredient.trim()
          );
          
          if (ingredient) {
            // Store comm_code in the input's dataset
            const ingredientInput = document.getElementById('ingredient-input');
            ingredientInput.dataset.commCode = ingredient.comm_code; // Add this line
       //     FormHandler.updateCategory(ingredient["Food group"].trim());
            document.getElementById('category-input').value = ingredient["Food group"];

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
    
      /*
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
      */
      // In the calculate button handler
      document.getElementById('calculate-selected').addEventListener('click', async (e) => {
        e.preventDefault();

        // Clear previous results
        this.resultsView.clear();

        // Perfrom calculation
        const impact = this.formHandler.calculateImpact();

        if(impact) {
          this.resultsView.showResults({
            co2e: impact.co2e.toFixed(2),
            water: impact.waterUse.toFixed(2),
            land: impact.landUse.toFixed(2)
          });
  

        }

      });  
        
    }
    
    /*
    updateIngredientAutocomplete(ingredients) {
      this.autocompleteInstances.ingredient.updateDataset(ingredients);
      
      // Force show dropdown
      document.getElementById('ingredient-input').focus();
      this.autocompleteInstances.ingredient.showSuggestions();
    }
    */

 
  }
  