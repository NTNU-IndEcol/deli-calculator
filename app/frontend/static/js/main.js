// foodCalculator/frontend/static/js/main.js
import { DataManager } from './data-manager.js';
import { FoodCalculatorApp } from './food-calculator-app.js';
import { FormHandler } from './form-handler.js';
import { ApiClient } from './api-client.js'; // Add proper import


// Singleton instance to prevent reinitialization
//let formHandler = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await DataManager.initialize();
    
    const formHandler = new FormHandler();
    
    const app = new FoodCalculatorApp(formHandler);

  //  await formHandler.loadRecipe();
  
  /*  
    // Recipe extraction handler
    document.getElementById('extract-btn').addEventListener('click', async () => {
      const url = document.getElementById('recipe-url').value.trim();
      try {

        const result = await ApiClient.processRecipe(url);

      } catch (error) {
        alert(`Extraction Error: ${error.message}`);
      }
    });
   */
    
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
    });
    
    // Load recipe (appends to existing ingredients)
   // formHandler.loadRecipe();

    // Add new ingredient (appends to table)
    /*
    document.getElementById('add-ingredient-btn').addEventListener('click', () => {
      formHandler.handleAddIngredient();
    });
*/

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
/*
function toggleHelp() {
    const helpTooltip = document.getElementById('source-help');
    const isVisible = helpTooltip.style.display === 'block';
    helpTooltip.style.display = isVisible ? 'none' : 'block';
    document.getElementById('source-help-button').setAttribute('aria-expanded', !isVisible);
}

// Event listeners
document.getElementById('source-help-button').addEventListener('click', toggleHelp);

// Close when clicking outside
document.addEventListener('click', (e) => {
    const helpTooltip = document.getElementById('source-help');
    const helpButton = document.getElementById('source-help-button');
    
    if (!helpButton.contains(e.target) && !helpTooltip.contains(e.target)) {
        helpTooltip.style.display = 'none';
        helpButton.setAttribute('aria-expanded', 'false');
    }
});

// Close on ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.getElementById('source-help').style.display = 'none';
        document.getElementById('source-help-button').setAttribute('aria-expanded', 'false');
    }
});

*/

});