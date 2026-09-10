// frontend/static/js/selected-recipe-load.js

document.addEventListener('DOMContentLoaded', function() {
    const loadButton = document.getElementById('loading-btn');
    const recipeSelect = document.getElementById('recipe-select');
    
    // Check if there's a recipe selected from the recipes page
    const selectedRecipe = localStorage.getItem('selectedRecipe');
    if (selectedRecipe && recipeSelect) {
        recipeSelect.value = selectedRecipe;
        localStorage.removeItem('selectedRecipe');
    }
    
    // NOTE: The actual loading is now handled in main.js
    // This file only handles the localStorage check for recipe page navigation
    console.log('✅ Recipe loader initialized (UI only)');
});