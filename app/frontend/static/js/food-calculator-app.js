// food-calculator-app.js

import { DataManager } from './data-manager.js';
import { AutocompleteHandler } from './autocomplete.js';
import { FormHandler } from './form-handler.js';
import { ResultsView } from './results-view.js';
import { MapView } from './map-view.js';
import { MetricsTracker } from './metrics-tracker.js';

export class FoodCalculatorApp {
    constructor(formHandler) {
      this.autocompleteInstances = {};
      this.formHandler = formHandler;
      this.resultsView = new ResultsView();
      this.mapView = null;
      this.initializeApp();
    }

    async initializeApp(){
      // Step 1: Initialize core data (config, regions, conversion factors)
      await DataManager.initialize();
      
      // Step 2: Load location-specific data (database, import data)
      // This is CRITICAL - the database is loaded here!
      await DataManager.loadDataForLocation();
      
      // Step 3: Now setup autocomplete with the loaded database
      this.setupAutocomplete();
      this.setupEventListeners();
      this.mapView = new MapView('map-container');
    }

    //=================================
    // setupAutocomplete
    //=================================
    setupAutocomplete() {
      const app = this;
      
      console.log('🔧 Setting up autocomplete with database:', DataManager.database?.length || 0, 'items');
      console.log('📊 Available ingredients:', DataManager.ingredients?.length || 0);
      console.log('📊 Available categories:', DataManager.categories?.length || 0);

      // 🔥 FIX: Verify we have data before proceeding
      if (!DataManager.database || DataManager.database.length === 0) {
        console.error('❌ Cannot setup autocomplete: Database not loaded!');
        return;
      }

      if (!DataManager.ingredients || DataManager.ingredients.length === 0) {
        console.error('❌ Cannot setup autocomplete: Ingredients not processed!');
        return;
      }

      // Category autocomplete
      const categoryAutocomplete = new AutocompleteHandler({
        input: '#category-input',
        dataset: DataManager.categories,
        onSelect: (selectedCategory) => {
          console.log('📂 Category selected:', selectedCategory);
          document.getElementById('ingredient-input').value = '';
          document.getElementById('category-input').value = selectedCategory;
          
          const ingredients = DataManager.getIngredientsByCategory(selectedCategory);
          console.log('  ↓ Available ingredients:', ingredients.length);
          app.updateIngredientAutocomplete(ingredients);
        }
      });

      // 🔥 Ingredient autocomplete with working dropdown
      this.autocompleteInstances.ingredient = new AutocompleteHandler({
        input: '#ingredient-input',
        dataset: DataManager.ingredients, // This should now have data
        maxSuggestions: 20,
        onSelect: (selectedIngredient) => {
          console.log('🥕 Ingredient selected:', selectedIngredient);
          
          // Set the input value
          document.getElementById('ingredient-input').value = selectedIngredient;
          
          // Find in database
          const ingredient = DataManager.database.find(item => 
            item.Ingredient.trim().toLowerCase() === selectedIngredient.trim().toLowerCase()
          );
          
          if (ingredient) {
            console.log('  ✔ Found in database:', ingredient.comm_code);
            
            const ingredientInput = document.getElementById('ingredient-input');
            ingredientInput.dataset.commCode = ingredient.comm_code;
            
            // Auto-fill category
            document.getElementById('category-input').value = ingredient["Food group"];

            // Get top source countries
            const countries = [
              ingredient.Top1,
              ingredient.Top2,
              ingredient.Top3,
              ingredient.Top4,
              ingredient.Top5
            ].filter(Boolean);
            
            console.log('  ↓ Top sources:', countries.join(', '));
            
            // Update source dropdown with these countries
            if (this.autocompleteInstances.source) {
              this.autocompleteInstances.source.updateDataset(countries);
            }
            
            // Auto-select first source
            /*
            if (countries.length > 0) {
              document.getElementById('source-input').value = countries[0];
              console.log('  ✔ Auto-selected source:', countries[0]);
            }
            */
          } else {
            console.warn('  ⚠ Not found in database');
          }
        }
      });
      
      console.log('✅ Ingredient autocomplete created');
      
      // Source country autocomplete
      this.autocompleteInstances.source = new AutocompleteHandler({
        input: '#source-input',
        dataset: DataManager.importCountries,
        maxSuggestions: 10,
        onSelect: (selectedCountry) => {
          console.log('🌍 Source country selected:', selectedCountry);
          document.getElementById('source-input').value = selectedCountry;
        }
      });
      
      console.log('✅ Autocomplete setup complete');
      
      // Test if autocomplete is working
      setTimeout(() => {
        const ingredientInput = document.getElementById('ingredient-input');
        if (ingredientInput && ingredientInput.autocompleteInstance) {
          console.log('✅ Ingredient autocomplete is attached to input');
          console.log('   Dataset size:', ingredientInput.autocompleteInstance.dataset.length);
        } else {
          console.error('❌ Ingredient autocomplete NOT attached!');
        }
      }, 100);
    }

    // Helper method to update ingredient autocomplete dataset
    updateIngredientAutocomplete(ingredients) {
      if (this.autocompleteInstances.ingredient) {
        this.autocompleteInstances.ingredient.updateDataset(ingredients);
        console.log('  ✓ Updated ingredient autocomplete:', ingredients.length, 'items');
      }
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
            const recipeLabel = this.formHandler.getRecipeLabel();
            const ingredients = this.formHandler.getIngredients();
            
            console.log("📊 Calculated totals:", totals);
            
            // Display totals in results panel
            this.resultsView.showResults(totals, recipeLabel);
            this.resultsView.setLatestCountryImpactData(impactByCountry, recipeLabel, ingredients);
            
            // Update map visualization
            this.mapView.updateMap(impactByCountry);
            
            // Track the calculation
            await MetricsTracker.trackCalculation();

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
