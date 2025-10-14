// foodCalculator/frontend/static/js/main.js
import { DataManager } from './data-manager.js';
import { FoodCalculatorApp } from './food-calculator-app.js';
import { FormHandler } from './form-handler.js';
import { ApiClient } from './api-client.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await DataManager.initialize();
    
    const formHandler = new FormHandler();
    const app = new FoodCalculatorApp(formHandler);

    // Recipe extraction handler
    document.getElementById('extract-btn').addEventListener('click', async () => {
      const url = document.getElementById('recipe-url').value.trim();
      
      if (!url) {
        alert('Please enter a recipe URL');
        return;
      }

      const extractBtn = document.getElementById('extract-btn');
      const originalText = extractBtn.textContent;
      
      try {
        // Show loading state
        extractBtn.textContent = 'Extracting...';
        extractBtn.disabled = true;

        const result = await ApiClient.processRecipe(url);
        
        if (result?.success && result.ingredients) {
      //    console.log('✅ Recipe extracted successfully:', result.recipe.name);
      //    console.log('📝 Ingredients:', result.ingredients);
          
          // Add extracted ingredients to the form
          result.ingredients.forEach(ingredient => {
            formHandler.processNewIngredient({
              ...ingredient,
              matched: false
            });
          });
          
          formHandler.updateTable();
          
          // Show success message
         // alert(`Successfully extracted recipe: ${result.recipe.name}`);
        } else {
          throw new Error('No ingredients found in response');
        }
      } catch (error) {
        console.error('❌ Extraction failed:', error);
        alert(`Extraction Error: ${error.message}`);
      } finally {
        // Reset button state
        extractBtn.textContent = originalText;
        extractBtn.disabled = false;
      }

      // Simulate extraction process (replace with actual API call)
      setTimeout(() => {
          // After successful extraction, reload the page
          window.location.reload();
      }, 10);

    });

    // Create tooltip container
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-overlay';
    document.body.appendChild(tooltip);

    // Handle all help icons
    document.querySelectorAll('.inline-help-icon').forEach(icon => {
        const message = icon.dataset.tooltipText;
        
        icon.addEventListener('mouseenter', function(e) {
            const rect = e.target.getBoundingClientRect();
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