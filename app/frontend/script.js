document.addEventListener('DOMContentLoaded', function ()  {
        console.log("✅ DOM fully loaded"); // Debugging

        let currentRecipe = null; // Store the loaded recipe
        let selectedIngredients = []; // Store selected ingredients


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

        // Load saved recipe when the page loads
        async function loadSavedRecipe() {
            try {
                const response = await fetch("/saved-recipes");
                const recipe = await response.json();

                if (recipe && recipe.recipeIngredient) {
                    console.log("✅ Loaded Recipe:", recipe);
                    currentRecipe = recipe;
                    populateIngredientDropdown(recipe.recipeIngredient);
                } else {
                    console.log("No saved recipe found.");
                }
            } catch (error) {
                console.error("Error loading saved recipe:", error);
            }
        }

        // Populate dropdown with ingredients
        function populateIngredientDropdown(ingredients) {
            const dropdown = document.getElementById("ingredient-dropdown");
            if (!dropdown) {
                console.error("❌ Dropdown element not found!");
                return;
            }

            dropdown.innerHTML = '<option value="">Choose an ingredient...</option>';
            ingredients.forEach((ingredient, index) => {
                const option = document.createElement("option");
                option.value = index;
                option.textContent = `${ingredient.name} (${ingredient.amount} ${ingredient.unit})`;
                dropdown.appendChild(option);
            });

            console.log("✅ Dropdown populated with ingredients:", ingredients);
        }

        // Handle ingredient selection
        document.getElementById("ingredient-dropdown").addEventListener("change", function () {
            const selectedIndex = this.value;
            if (selectedIndex === "" || !currentRecipe) return;

            const selectedIngredient = currentRecipe.recipeIngredient[selectedIndex];

            // Prevent duplicate selection
            if (selectedIngredients.some(i => i.name === selectedIngredient.name)) {
                alert("Ingredient already added!");
                return;
            }

            // Add ingredient with default source
            selectedIngredients.push({
                category: currentRecipe.category || "Uncategorized",
                name: selectedIngredient.name,
                amount: selectedIngredient.amount,
                unit: selectedIngredient.unit,
                source: "Local"
            });

            updateIngredientTable();
        });

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
                            placeholder="Enter country" value="${ingredient.importLocation}" 
                            style="display: ${ingredient.source === "Imported" ? "inline-block" : "none"};" />
                    </td>
                    <td><button class="remove-btn" data-index="${index}">❌</button></td>
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
    
        loadSavedRecipe();  

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
