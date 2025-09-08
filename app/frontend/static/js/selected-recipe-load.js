// frontend/static/js/recipe-loader.js
document.addEventListener('DOMContentLoaded', function() {
    const loadButton = document.getElementById('loading-btn');
    const recipeSelect = document.getElementById('recipe-select');
    
    // Check if there's a recipe selected from the recipes page
    const selectedRecipe = localStorage.getItem('selectedRecipe');
    if (selectedRecipe && recipeSelect) {
        recipeSelect.value = selectedRecipe;
        localStorage.removeItem('selectedRecipe');
    }
    
    if (loadButton && recipeSelect) {
        loadButton.addEventListener('click', function() {
            const selectedRecipe = recipeSelect.value;
            
            if (!selectedRecipe) {
                alert('Please select a recipe first.');
                return;
            }
            
            // Show a simple loading message
            loadButton.textContent = 'Loading...';
            loadButton.disabled = true;
            
            // Send request to server to load the recipe
            fetch('/api/load-recipe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ recipe: selectedRecipe })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // After successful loading, reload the page
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    alert('Error: ' + data.message);
                    loadButton.textContent = 'Load Recipe';
                    loadButton.disabled = false;
                }
            })
            .catch(error => {
                alert('Network error: ' + error);
                loadButton.textContent = 'Load Recipe';
                loadButton.disabled = false;
            });
        });
    }
});