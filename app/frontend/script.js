// Declare globally so all functions can access them
let categoryDataBase = [];
let ingredientDataBase = [];
let fullDatabase = [];
let categoryInput, ingredientInput, categoryList, ingredientList, updateIngredientList;


// Load all data when the page starts
async function initializeApp() {
    await loadDataBase();
  //  await loadSavedRecipe();
  //  await loadIngredients();
    await loadImportData();
    await loadRegions();
    await loadEnvImpact();
}

/*
// Load ingredients mapping
async function loadIngredients() {
    try {
        let response = await fetch("/load-ingredients");
        let data = await response.json();
        // Process ingredients data as needed
        console.log("✅ Ingredients Mapping:", data);
    } catch (error) {
        console.error("Error loading ingredients:", error);
    }
}
*/

// Load import data
async function loadImportData() {
    try {
        let response = await fetch("/load-import-data");
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        let data = await response.json();
        
        // Handle backend errors (e.g., file not found)
        if (data.error) {
            throw new Error(data.error);
        }
        
        console.log("✅ Import Data:", data);
    } catch (error) {
        console.error("Error loading import data:", error);
    }
}

// Load regions
async function loadRegions() {
    try {
        let response = await fetch("/load-regions");
        let data = await response.json();
        // Process regions data as needed
        console.log("✅ Regions:", data);
    } catch (error) {
        console.error("Error loading regions:", error);
    }
}


// Load database
async function loadDataBase() {
    try {
        let response = await fetch("load-database");
        let data = await response.json();
        
        if (!Array.isArray(data)) {
            throw new Error("Invalid data format: Expected an array.");
        }

        // Store the full database data
        fullDatabase = data;

        // Extract unique categories and ingredients
        categoryDataBase = [...new Set(data.map(item => item["Food group"].trim()))];
        ingredientDataBase = [...new Set(data.map(item => item["Ingredient"].trim()))];

        console.log("✅ Loaded database:");
        console.log("Categories:", categoryDataBase);
        console.log("Ingredients:", ingredientDataBase);

    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// Load regions
async function loadEnvImpact() {
    try {
        let response = await fetch("/load-env-impact");
        let data = await response.json();
        // Process regions data as needed
        console.log("✅ Env impact:", data);
    } catch (error) {
        console.error("Error loading Env impact:", error);
    }
}


// Call initializeApp when the page loads
window.onload = initializeApp;

// Autocomplete list

// Modify the showSuggestions function to accept forceShow
function showSuggestions(inputElement, listElement, data, forceShow = false) {
    let inputValue = inputElement.value.toLowerCase();
    listElement.innerHTML = "";

    // Show full list when forced (for category-based filtering)
    let matches = forceShow ? data : data.filter(item => item.toLowerCase().includes(inputValue));

    if (matches.length === 0) {
        listElement.style.display = "none";
        return;
    }

    // Create suggestion items
    matches.slice(0, 10).forEach(match => {
        let li = document.createElement("li");
        li.textContent = match;
        li.onclick = () => {
            inputElement.value = match;
            listElement.style.display = "none";
            
            // Update category when ingredient is selected
            const ingredientEntry = fullDatabase.find(item => 
                item["Ingredient"].trim() === match
            );
            if (ingredientEntry) {
                const category = ingredientEntry["Food group"].trim();
                categoryInput.value = category;
                // Refresh ingredient list for the new category
                updateIngredientList(category);
                // Force-show updated ingredients
                setTimeout(() => {
                    showSuggestions(ingredientInput, ingredientList, ingredientDataBase, true);
                }, 0);
            }
        };
        listElement.appendChild(li);
    });

    // Position and show dropdown
    listElement.style.display = "block";
    listElement.style.position = "absolute";
    listElement.style.left = `${inputElement.offsetLeft}px`;
    listElement.style.top = `${inputElement.offsetTop + inputElement.offsetHeight}px`;
    listElement.style.width = `${inputElement.offsetWidth}px`;
}

document.addEventListener('DOMContentLoaded', async function ()  {
    console.log("✅ DOM fully loaded"); // Debugging

    categoryInput = document.getElementById("category-input");
    ingredientInput = document.getElementById("ingredient-input");
    categoryList = document.getElementById("category-suggestions");
    ingredientList = document.getElementById("ingredient-suggestions");
    let addIngredientBtn = document.getElementById("add-ingredient-btn");

    let currentRecipe = null; // Store the loaded recipe
    let selectedIngredients = []; // Store selected ingredients

        
    // Extract recipe from URL
    document.getElementById("extract-btn").addEventListener("click", function () {
        const url = document.getElementById("recipe-url").value;
        fetch("/extract-recipe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        })
        .then(response => response.json())
        .then(data => {
            console.log("🔍 Extracted Recipe Response:", data);
        })
        .catch(error => console.error("❌ Fetch Error:", error));
    });

    // Load database
  //  await loadDataBase();
    
   // console.log("🔍 categoryDatabase:", categoryDataBase)
    //console.log("🔍 ingredientsDatabase:", ingredientDataBase)

    // Event listener for category selection from the dropdown
    categoryList.addEventListener("click", (event) => {
        const selectedCategory = event.target.innerText.trim();
        
        if (selectedCategory) {
            categoryInput.value = selectedCategory; // Set input to the selected category
            updateIngredientList(selectedCategory); // Update ingredients based on this exact category
            categoryList.style.display = "none"; // Hide the category list after selection
        }
    });


    // In updateIngredientList, force-show suggestions
    updateIngredientList = function(selectedCategory) {
        console.log(`🔍 Searching for category '${selectedCategory}' in fullDatabase`);

        let filteredIngredients = fullDatabase
            .filter(item => item["Food group"].trim().toLowerCase() === selectedCategory.toLowerCase())
            .map(item => item["Ingredient"].trim());

        if (filteredIngredients.length === 0) {
            console.warn(`⚠️ No ingredients found for category '${selectedCategory}'.`);
        }

        ingredientDataBase = filteredIngredients;
        console.log(`🔄 Updated ingredients:`, ingredientDataBase);

       // ingredientInput.value = "";
        showSuggestions(ingredientInput, ingredientList, ingredientDataBase, true); // Force show
    }


    // User input category
    if (categoryInput && categoryList) {
        categoryInput.addEventListener("input", () => {
            showSuggestions(categoryInput, categoryList, categoryDataBase);
        });

        categoryInput.addEventListener("change", function () {
            updateIngredientList(categoryInput.value.trim());
        });
    }

    // Ingredient input
    if (ingredientInput && ingredientList) {
        ingredientInput.addEventListener("input", () => {
            let searchText = ingredientInput.value.trim().toLowerCase();
    
            if (searchText === "" && categoryInput.value.trim() !== "") {
                // If input is empty and category is selected, show category-filtered ingredients
                showSuggestions(ingredientInput, ingredientList, ingredientDataBase);
            } else {
                // Otherwise, show results from the FULL database
                let filteredResults = fullDatabase
                    .map(item => item["Ingredient"].trim())
                    .filter(ingredient => ingredient.toLowerCase().includes(searchText));
    
                showSuggestions(ingredientInput, ingredientList, filteredResults);
            }
        });
    
        // Also trigger dropdown when clicking the input field
        ingredientInput.addEventListener("focus", () => {
            if (categoryInput.value.trim() !== "") {
                showSuggestions(ingredientInput, ingredientList, ingredientDataBase);
            } else {
                showSuggestions(ingredientInput, ingredientList, fullDatabase.map(item => item["Ingredient"].trim()));
            }
        });
    }

    // Modify the category input change handler to force-show ingredients
    categoryInput.addEventListener("change", function () {
        const selectedCategory = this.value.trim();
        if (selectedCategory) {
            updateIngredientList(selectedCategory);
            // Immediately show filtered ingredients without typing
            setTimeout(() => {  // Ensure DOM updates complete
                showSuggestions(ingredientInput, ingredientList, ingredientDataBase, true);
            }, 0);
        }
    });

    document.addEventListener("click", (e) => {
        if (!categoryInput.contains(e.target) && !categoryList.contains(e.target)) categoryList.style.display = "none";
        if (!ingredientInput.contains(e.target) && !ingredientList.contains(e.target)) ingredientList.style.display = "none";
    });
    
    // Handle Add Ingredient
    addIngredientBtn.addEventListener("click", function () {
        let category = categoryInput.value.trim();
        let ingredient = ingredientInput.value.trim();
        let amount = document.getElementById("amount-input").value.trim();
        let unit = document.getElementById("unit-dropdown").value;
        let source = document.getElementById("source-dropdown").value;

        if (!category || !ingredient || !amount || isNaN(amount) || amount <= 0) {
            alert("Please enter valid ingredient details.");
            return;
        }

        selectedIngredients.push({
            category,
            name: ingredient,
            amount,
            unit,
            source
        });

        updateIngredientTable();
        console.log("✅ Ingredient Added:", selectedIngredients);
    });

    // Load saved recipe when the page loads
    async function loadSavedRecipe() {
        try {
            const response = await fetch("/saved-recipes");
            const recipe = await response.json();
    
            if (recipe && recipe.recipeIngredient) {
                console.log("✅ Loaded Recipe:", recipe);
                currentRecipe = recipe;
                selectedIngredients = recipe.recipeIngredient.map(ingredient => ({
                    category: recipe.category || "Uncategorized",
                    name: ingredient.details.originalText, // Show original text in table
                    mainIngredient: ingredient.mainIngredient, // Store for calculations
                    amount: ingredient.details.amount,
                    unit: ingredient.details.unit,
                    source: "Local",
                    originalUnit: ingredient.details.unit // Preserve original unit if needed
                }));
                updateIngredientTable();
            } else {
                console.log("No saved recipe found.");
            }
        } catch (error) {
            console.error("Error loading saved recipe:", error);
        }
    }
    
    loadSavedRecipe();  

    // Updated ingredient table
    function updateIngredientTable() {
        const tableBody = document.getElementById("ingredients-table-body");
        tableBody.innerHTML = ""; // Clear previous entries

        selectedIngredients.forEach((ingredient, index) => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${ingredient.category}</td>
                <td>${ingredient.name}</td>
                <td><input type="number" value="${ingredient.amount}" min="0" class="amount-input" data-index="${index}" /></td>
                <td>${ingredient.unit}</td>
                <td>
                    <select class="source-dropdown" data-index="${index}">
                        <option value="Local" ${ingredient.source === "Local" ? "selected" : ""}>Local</option>
                        <option value="Imported" ${ingredient.source !== "Local" ? "selected" : ""}>Imported</option>
                    </select>
                    <input type="text" class="import-location-input" data-index="${index}" 
                        placeholder="Enter country" value="${ingredient.importLocation || ""}" 
                        style="display: ${ingredient.source === "Imported" ? "inline-block" : "none"};" />
                </td>
                <td><button class="remove-btn" data-index="${index}">🗑️</button></td>
            `;

            tableBody.appendChild(row);
        });

        // Handle amount changes
        document.querySelectorAll(".amount-input").forEach(input => {
            input.addEventListener("input", function () {
                const index = this.getAttribute("data-index");
                selectedIngredients[index].amount = this.value;
            });
        });

        // Handle source selection changes
        document.querySelectorAll(".source-dropdown").forEach(select => {
            select.addEventListener("change", function () {
                const index = this.getAttribute("data-index");
                selectedIngredients[index].source = this.value;

                const importInput = document.querySelector(`.import-location-input[data-index="${index}"]`);

                if (this.value === "Imported") {
                    selectedIngredients[index].source = "Imported";
                    importInput.style.display = "inline-block"; // Show country input
                } else {
                    selectedIngredients[index].source = "Local";
                    selectedIngredients[index].importLocation = "";
                    importInput.style.display = "none"; // Hide country input
                    importInput.value = "";
                }
            });
        });

        // Handle country input changes
        document.querySelectorAll(".import-location-input").forEach(input => {
            input.addEventListener("input", function () {
                const index = this.getAttribute("data-index");
                selectedIngredients[index].importLocation = this.value;
            });
        });

        // Handle ingredient removal
        document.querySelectorAll(".remove-btn").forEach(button => {
            button.addEventListener("click", function () {
                const removeIndex = this.getAttribute("data-index");
                selectedIngredients.splice(removeIndex, 1);
                updateIngredientTable();
            });
        });
    }



    const calculateBtn = document.getElementById("calculate-selected"); // Ensure ID matches HTML
    if (!calculateBtn) {
        console.error("❌ ERROR: #calculate-selected button not found!");
        return;
    }

    calculateBtn.addEventListener("click", async function () {
        if (selectedIngredients.length === 0) {
            alert("Please select at least one ingredient.");
            return;
        }

        try {
            // Send all ingredients in one request
            const response = await fetch("/calculate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries: selectedIngredients }),
            });

            const data = await response.json();
            if (data.error) {
                alert("Error: " + data.error);
                return;
            }

            let total_emission = data.total_emission;
            let breakdown = data.breakdown;

            // Calculate transport emissions for imported ingredients
            for (let ingredient of selectedIngredients) {
                if (ingredient.source === "Imported") {
                    let transportEmission = await calculateTransportEmissions(ingredient);
                    total_emission += transportEmission;

                    // Update emission for this ingredient in the breakdown
                    const index = breakdown.findIndex(item => item.ingredient === ingredient.name);
                    if (index !== -1) {
                        breakdown[index].emission += transportEmission;
                    }
                }
            }

            displayResults({ total_emission, breakdown });

        } catch (error) {
            console.error("❌ Calculation Error:", error);
        }
    });

    async function calculateTransportEmissions(ingredient) {
        if (ingredient.source === "Local") return 0; // No transport emissions for local

        try {
            const response = await fetch("/transport-emissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    import_location: ingredient.importLocation,
                    mass_kg: ingredient.amount / 1000, // Convert grams to kg
                    transport_mode: "sea" // Default mode
                })
            });

            const data = await response.json();
            if (data.error) {
                console.error("Transport Emission Error:", data.error);
                return 0;
            }

            console.log(`🌍 Transport Emissions for ${ingredient.name}: ${data.emissions} kg CO2`);
            return data.emissions;
        } catch (error) {
            console.error("❌ Transport API Error:", error);
            return 0;
        }
    }

    function displayResults(data) {
        const resultSection = document.getElementById("calculation-results");
        resultSection.innerHTML = `<h3>Total Environmental Impact: ${data.total_emission.toFixed(2)} kg CO2</h3>`;
        
        const breakdownTable = document.createElement("table");
        breakdownTable.innerHTML = `
            <tr>
                <th>Ingredient</th>
                <th>Emission (kg CO2)</th>
            </tr>
        `;
        
        data.breakdown.forEach(item => {
            const row = document.createElement("tr");
            row.innerHTML = `<td>${item.ingredient}</td><td>${item.emission.toFixed(2)}</td>`;
            breakdownTable.appendChild(row);
        });

        resultSection.appendChild(breakdownTable);
    }
});


