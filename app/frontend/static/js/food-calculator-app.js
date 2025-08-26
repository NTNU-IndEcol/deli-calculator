// food-calculator-app.js

import { DataManager } from './data-manager.js';
import { AutocompleteHandler } from './autocomplete.js';
import { FormHandler } from './form-handler.js';
import { ResultsView } from './results-view.js';
import { MapView } from './map-view.js';

export class FoodCalculatorApp {
    constructor(formHandler) {
      this.autocompleteInstances = {}; // Add this line
      this.formHandler = formHandler; //new FormHandler(); // Create FormHandler instance
      this.resultsView = new ResultsView(); // Add ResultsView instance
      this.mapView = null;
      this.initializeApp();
    }

    initializeApp(){
      DataManager.initialize().then(() => {
        this.setupAutocomplete();
        this.setupEventListeners();
        this.formHandler.loadRecipe(); 
        this.mapView = new MapView('map-container');
      });

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
      // In the calculate button handler
      document.getElementById('calculate-selected').addEventListener('click', async (e) => {
        e.preventDefault();      
        this.resultsView.clear();  // Clear previous results

        // Initialize map only when needed
      //  if (!this.mapView) {
      //      this.mapView = new MapView('map-container');
      //  }
        
        // Perfrom calculation
        const impact = this.formHandler.calculateImpact();

        if(impact) {
          this.resultsView.showResults({
            co2e: impact.co2e.toFixed(2),
            water: impact.waterUse.toFixed(2),
            land: impact.landUse.toFixed(2)
          });
  
          // Update map with data from the impact by country
          const impactByCountry = this.formHandler.getImpactByCountry();
          console.log("Impact by country data:", impactByCountry); // DEBUG

          // Verify we have valid data before updating map
          if (impactByCountry && impactByCountry.length > 0) {
              this.mapView.updateMap(impactByCountry);
          } else {
              console.warn("No country impact data to display on map");
          }
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
  