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

  } catch (error) {
    console.error('Critical initialization error:', error);
    alert('Failed to initialize application. Please try reloading.');
  }
});