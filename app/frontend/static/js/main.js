// foodCalculator/frontend/static/js/main.js
import { DataManager } from './data-manager.js';
import { FoodCalculatorApp } from './food-calculator-app.js';
import { FormHandler } from './form-handler.js';
import { ApiClient } from './api-client.js'; // Add proper import
//import { MapView } from './map-view.js';
//import { TopoJSONMap } from './topojson-map.js';

// Singleton instance to prevent reinitialization
//let formHandler = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await DataManager.initialize();
    
    const formHandler = new FormHandler();
    
    const app = new FoodCalculatorApp(formHandler);

    
    // Recipe extraction handler
    document.getElementById('extract-btn').addEventListener('click', async () => {
      const url = document.getElementById('recipe-url').value.trim();
      try {
        const result = await ApiClient.processRecipe(url);
        if (result?.ingredients) {
          // Append extracted ingredients to existing ones
          result.ingredients.forEach(ingredient => {
            formHandler.processNewIngredient({
              ...ingredient,
              id: Date.now() + Math.random(), // Unique ID
              matched: false
            });
          });
          formHandler.updateTable();
        }
      } catch (error) {
        alert(`Extraction Error: ${error.message}`);
      }

      // Simulate extraction process (replace with actual API call)
      setTimeout(() => {
          // After successful extraction, reload the page
          window.location.reload();
      }, 1000);
    });
    

    // Create tooltip container
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-overlay';
    document.body.appendChild(tooltip);

    // Handle all help icons
    document.querySelectorAll('.inline-help-icon').forEach(icon => {
        // Get message from data attribute
        const message = icon.dataset.tooltipText;
        
        icon.addEventListener('mouseenter', function(e) {
            const rect = e.target.getBoundingClientRect();
            tooltip.textContent = message;
            
            // Position calculation with viewport boundary checks
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // Default position below icon
            let top = rect.bottom + 8;
            let left = rect.left;
            
            // Adjust if near bottom edge
            if (top + tooltip.offsetHeight > windowHeight) {
                top = rect.top - tooltip.offsetHeight - 8;
            }
            
            // Adjust if near right edge
            if (left + tooltip.offsetWidth > windowWidth) {
                left = windowWidth - tooltip.offsetWidth - 16;
            }
            
            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
            tooltip.classList.add('visible');
        });

        icon.addEventListener('mouseleave', function() {
            tooltip.classList.remove('visible');
        });
    });


  } catch (error) {
    console.error('Critical initialization error:', error);
    alert('Failed to initialize application. Please try reloading.');
  }


});