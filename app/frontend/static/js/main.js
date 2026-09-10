// frontend/static/js/main.js
import { DataManager } from './data-manager.js';
import { FoodCalculatorApp } from './food-calculator-app.js';
import { FormHandler } from './form-handler.js';
import { ApiClient } from './api-client.js';
import { LocationSelector } from './location-selector.js';
import { LocationManager } from './location-manager.js';
import { MetricsTracker } from './metrics-tracker.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 Starting application initialization...');
    
    // Step 1: Initialize DataManager (loads regions, config - NO location detection)
    await DataManager.initialize();
    
    // Step 2: Initialize LocationSelector (detects location and loads data)
    const locationSelector = new LocationSelector();
    
    // Step 3: Wait for location to be ready (no polling)
    console.log('⏳ Waiting for location detection...');
    await locationSelector.ready;
    
    console.log('✅ Location ready:', LocationManager.getCurrentLocation().countryName);
    
    // Track page view
    await MetricsTracker.trackView();

    // Step 4: Initialize form handler (NO auto-load)
    const formHandler = new FormHandler();
    
    // ⭐ Store reference for LocationSelector to use
    window.formHandler = formHandler;

    // Step 5: Initialize app (pass formHandler but DON'T auto-load recipe)
    const app = new FoodCalculatorApp(formHandler);

    const applyIngredients = (ingredients) => {
        if (!ingredients || ingredients.length === 0) return;
        
        ingredients.forEach(ingredient => {
            formHandler.processNewIngredient({
                name: ingredient.name || ingredient.mainIngredient,
                mainIngredient: ingredient.mainIngredient || ingredient.name,
                amount: ingredient.details?.amount ?? ingredient.amount ?? 1,
                unit: ingredient.details?.unit ?? ingredient.unit ?? 'unit',
                source: ingredient.source || '',
                category: '',
                matched: false
            });
        });
        formHandler.updateTable();
    };

    // Step 6: Check for auto-load flag from recipes.html
    const autoLoadFlag = localStorage.getItem('autoLoadRecipe');
    
    if (autoLoadFlag === 'true') {
        console.log('📖 Auto-loading recipe from recipes gallery...');
        
        // Clear the flag
        localStorage.removeItem('autoLoadRecipe');
        
        try {
            const savedIngredients = await DataManager.loadSavedRecipe();
            
            if (savedIngredients && savedIngredients.length > 0) {
                console.log(`🔍 Auto-matching ${savedIngredients.length} ingredients against database...`);
                applyIngredients(savedIngredients);
                
                console.log('✅ Recipe auto-loaded:');
                console.log('  - Matched ingredients:', formHandler.selectedIngredients.length);
                console.log('  - Unmatched ingredients:', formHandler.unmatchedIngredients.length);
            }
        } catch (error) {
            console.log('ℹ️ No recipe to auto-load');
        }
    }

    // Recipe extraction handler
    const extractBtn = document.getElementById('extract-btn');
    const urlInput = document.getElementById('recipe-url');
    
    if (extractBtn && urlInput) extractBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      
      if (!url) {
        alert('Please enter a recipe URL');
        return;
      }

      const originalText = extractBtn.textContent;
      
      try {
        extractBtn.textContent = 'Extracting...';
        extractBtn.disabled = true;

        console.log('🔗 Extracting recipe with location:', LocationManager.getCurrentLocation().countryName);
        const result = await ApiClient.processRecipe(url);
        
        if (result?.success && result.ingredients) {
          console.log('✅ Recipe extracted:', result.recipe.name);
          console.log(`🔍 Matching ${result.ingredients.length} ingredients against database...`);
          
          // Clear existing ingredients first
          formHandler.selectedIngredients = [];
          formHandler.unmatchedIngredients = [];
          
          applyIngredients(result.ingredients);
          
          console.log('✅ Recipe extracted and matched:');
          console.log('  - Matched ingredients:', formHandler.selectedIngredients.length);
          console.log('  - Unmatched ingredients:', formHandler.unmatchedIngredients.length);
          
          alert(`Successfully extracted recipe: ${result.recipe.name}\n\nMatched: ${formHandler.selectedIngredients.length}\nUnmatched: ${formHandler.unmatchedIngredients.length}`);
        } else {
          throw new Error('No ingredients found in response');
        }
      } catch (error) {
        console.error('❌ Extraction failed:', error);
        alert(`Extraction Error: ${error.message}`);
      } finally {
        extractBtn.textContent = originalText;
        extractBtn.disabled = false;
        urlInput.value = '';
      }
    });

    // 🔥 FIXED: Recipe loading handler (from dropdown)
    const loadingBtn = document.getElementById('loading-btn');
    const recipeSelect = document.getElementById('recipe-select');
    
    if (loadingBtn && recipeSelect) {
        console.log('✅ Recipe selector connected');
        
        loadingBtn.addEventListener('click', async () => {
            const selectedRecipe = recipeSelect.value;
            
            console.log('🔘 Load button clicked, selected recipe:', selectedRecipe);
            
            if (!selectedRecipe || selectedRecipe === '') {
                alert('Please select a recipe first');
                return;
            }

            const originalText = loadingBtn.textContent;
            
            try {
                loadingBtn.textContent = 'Loading...';
                loadingBtn.disabled = true;
                
                const currentLocation = LocationManager.getCurrentLocation();
                console.log('📍 Loading recipe:', selectedRecipe, 'with location:', currentLocation.countryName);
                
                // Step 1: Load the specific recipe (copies it to recipe.json)
                const loadResponse = await fetch('/api/load-recipe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipe: selectedRecipe })
                });
                
                if (!loadResponse.ok) {
                    const errorData = await loadResponse.json();
                    throw new Error(errorData.message || 'Failed to load recipe');
                }
                
                const loadData = await loadResponse.json();
                console.log('✅ Recipe file loaded:', loadData.recipe.name);
                
                // Step 2: Get the recipe data (from recipe.json)
                const savedIngredients = await DataManager.loadSavedRecipe();
                
                if (!savedIngredients || savedIngredients.length === 0) {
                    alert('No ingredients found in selected recipe');
                    return;
                }
                
                // Step 3: Clear existing
                formHandler.selectedIngredients = [];
                formHandler.unmatchedIngredients = [];
                
                console.log(`🔍 Matching ${savedIngredients.length} ingredients against database...`);
                
                // Step 4: Process each ingredient
                applyIngredients(savedIngredients);
                
                console.log('✅ Recipe loaded and matched:');
                console.log('  - Recipe:', loadData.recipe.name);
                console.log('  - Location:', currentLocation.countryName);
                console.log('  - Matched ingredients:', formHandler.selectedIngredients.length);
                console.log('  - Unmatched ingredients:', formHandler.unmatchedIngredients.length);
                
                alert(`Recipe "${loadData.recipe.name}" loaded successfully!\n\nMatched: ${formHandler.selectedIngredients.length}\nUnmatched: ${formHandler.unmatchedIngredients.length}`);
                
            } catch (error) {
                console.error('❌ Recipe load failed:', error);
                alert(`Failed to load recipe: ${error.message}`);
            } finally {
                loadingBtn.textContent = originalText;
                loadingBtn.disabled = false;
            }
        });
    } else {
        console.error('❌ Recipe selector not found!');
        console.log('  - loadingBtn:', loadingBtn);
        console.log('  - recipeSelect:', recipeSelect);
    }

    // Tooltip handling
    const tooltipIcons = document.querySelectorAll('.inline-help-icon');
    if (tooltipIcons.length > 0) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-overlay';
        document.body.appendChild(tooltip);

        const showTooltip = (icon) => {
            const message = icon?.dataset?.tooltipText;
            if (!message) return;

            const rect = icon.getBoundingClientRect();
            tooltip.textContent = message;

            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            let top = rect.bottom + 8;
            let left = rect.left;

            if (top + tooltip.offsetHeight > windowHeight) {
                top = rect.top - tooltip.offsetHeight - 8;
            }

            if (left + tooltip.offsetWidth > windowWidth) {
                left = windowWidth - tooltip.offsetWidth - 16;
            }

            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
            tooltip.classList.add('visible');
        };

        document.addEventListener('mouseenter', (e) => {
            const icon = e.target.closest('.inline-help-icon');
            if (!icon) return;
            showTooltip(icon);
        }, true);

        document.addEventListener('mouseleave', (e) => {
            if (e.target.closest('.inline-help-icon')) {
                tooltip.classList.remove('visible');
            }
        }, true);
    }

    console.log('✅ Application initialized successfully');

  } catch (error) {
    console.error('❌ Critical initialization error:', error);
    alert('Failed to initialize application. Please try reloading.');
  }
});
