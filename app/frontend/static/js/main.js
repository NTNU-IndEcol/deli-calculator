// foodCalculator/frontend/static/js/main.js
import { DataManager } from './data-manager.js';
import { FoodCalculatorApp } from './food-calculator-app.js';
import { FormHandler } from './form-handler.js';
import { ApiClient } from './api-client.js'; // Add proper import

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await DataManager.initialize();
    const app = new FoodCalculatorApp();
    const formHandler = new FormHandler();

  
    // Recipe extraction handler
    document.getElementById('extract-btn').addEventListener('click', async () => {
      const url = document.getElementById('recipe-url').value.trim();
      try {

        const result = await ApiClient.processRecipe(url);

      } catch (error) {
        alert(`Extraction Error: ${error.message}`);
      }
    });
    await formHandler.loadSavedRecipe();


  } catch (error) {
    console.error('Critical initialization error:', error);
    alert('Failed to initialize application. Please try reloading.');
  }
});