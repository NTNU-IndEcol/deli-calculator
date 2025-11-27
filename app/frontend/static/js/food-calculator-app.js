// food-calculator-app.js

import { DataManager } from './data-manager.js';
import { AutocompleteHandler } from './autocomplete.js';
import { FormHandler } from './form-handler.js';
import { ResultsView } from './results-view.js';
import { MapView } from './map-view.js';

export class FoodCalculatorApp {
    constructor(formHandler) {
      this.autocompleteInstances = {};
      this.formHandler = formHandler;
      this.resultsView = new ResultsView();
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
      const app = this;
  
      new AutocompleteHandler({
        input: '#category-input',
        dataset: DataManager.categories,
        onSelect: (selectedCategory) => {
          document.getElementById('ingredient-input').value = '';
          FormHandler.updateCategory(selectedCategory);
          const ingredients = DataManager.getIngredientsByCategory(selectedCategory);
          app.updateIngredientAutocomplete(ingredients);
        }
      });
  
      this.autocompleteInstances.ingredient = new AutocompleteHandler({
        input: '#ingredient-input',
        dataset: DataManager.ingredients,
        onSelect: (selectedIngredient) => {
          const ingredient = DataManager.database.find(item => 
            item.Ingredient.trim() === selectedIngredient.trim()
          );
          
          if (ingredient) {
            const ingredientInput = document.getElementById('ingredient-input');
            ingredientInput.dataset.commCode = ingredient.comm_code;
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
      
      this.autocompleteInstances.source = new AutocompleteHandler({
        input: '#source-input',
        dataset: DataManager.importCountries,
        onSelect: (selectedCountry) => {
          document.getElementById('source-input').value = selectedCountry;
        }
      });
    }

    setupEventListeners() {   

        this.resultsView.onMetricChange = (metric) => {
          console.log(`🎯 User selected metric: ${metric}`);
          this.mapView.setMetric(metric);
        };

      document.getElementById('calculate-selected').addEventListener('click', async (e) => {
        e.preventDefault();      
        this.resultsView.clear();
        
        // Show loading state
        const calculateBtn = e.target;
        const originalText = calculateBtn.textContent;
        calculateBtn.textContent = 'Calculating...';
        calculateBtn.disabled = true;
        
        try {
          console.log('🚀 Starting environmental impact calculation...');
          
          // Get country-level impacts first (this is where the real data is)
          console.log('🗺️ Calculating country-level impacts...');
          const impactByCountry = await this.formHandler.getImpactByCountry();
          
          console.log("Impact by country:", impactByCountry);
          
          if (impactByCountry && impactByCountry.length > 0) {
            // Calculate totals from country data using MapView's method
            const totals = this.mapView.calculateTotals(impactByCountry);
            
            console.log("📊 Calculated totals:", totals);
            
            // Display totals in results panel
            this.resultsView.showResults(totals);
            
            // Update map visualization
            this.mapView.updateMap(impactByCountry);
            
            console.log(`✅ Calculation complete: ${impactByCountry.length} countries processed`);
          } else {
            console.warn("No country impact data available");
            alert('Please add ingredients to calculate environmental impact.');
          }
          
        } catch (error) {
          console.error('❌ Calculation error:', error);
          console.error('Error stack:', error.stack);
          this.resultsView.showError(`Failed to calculate: ${error.message}`);
        } finally {
          // Reset button state
          calculateBtn.textContent = originalText;
          calculateBtn.disabled = false;
        }
      });
    }


}