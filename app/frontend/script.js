document.addEventListener("DOMContentLoaded", () => {
    let entries = [];

    // Initialize autocomplete
    fetch("/ingredients")
        .then(response => response.json())
        .then(data => {
            $("#ingredient").autocomplete({ source: data.ingredients });
        });

    // Add entry to list
    document.getElementById("entry-form").addEventListener("submit", (e) => {
        e.preventDefault();

        const newEntry = {
            ingredient: document.getElementById("ingredient").value,
            amount: document.getElementById("amount").value,
            unit: document.getElementById("unit").value,
            importLocation: document.getElementById("import-location").value,
            id: Date.now()
        };

        entries.push(newEntry);
        updateEntryList();
        clearForm();
    });

    // Update entry list display
    function updateEntryList() {
        const tbody = document.getElementById("entries-table-body");
        tbody.innerHTML = "";

        entries.forEach((entry, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${entry.ingredient}</td>
                <td>${entry.amount}</td>
                <td>${entry.unit}</td>
                <td>${entry.importLocation}</td>
                <td>
                    <button class="edit-btn" data-index="${index}">Edit</button>
                    <button class="remove-btn" data-index="${index}">Remove</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Edit entry (using event delegation)
    document.getElementById("entries-table-body").addEventListener("click", (e) => {
        if (e.target.classList.contains("edit-btn")) {
            const index = e.target.dataset.index;
            const entry = entries[index];
            document.getElementById("ingredient").value = entry.ingredient;
            document.getElementById("amount").value = entry.amount;
            document.getElementById("unit").value = entry.unit;
            document.getElementById("import-location").value = entry.importLocation;
            entries.splice(index, 1);
            updateEntryList();
        }
    });

    // Remove entry (using event delegation)
    document.getElementById("entries-table-body").addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-btn")) {
            const index = e.target.dataset.index;
            entries.splice(index, 1);
            updateEntryList();
        }
    });

    // Clear form
    function clearForm() {
        document.getElementById("entry-form").reset();
    }

    // Calculate total footprint
    document.getElementById("calculate-total").addEventListener("click", async () => {
        if (entries.length === 0) {
            alert("Please add at least one ingredient!");
            return;
        }

        try {
            const response = await fetch("/calculate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries })
            });

            const data = await response.json();
            document.getElementById("total-footprint").textContent = data.total_emission.toFixed(2);
            updateCharts(data.breakdown);
        } catch (error) {
            console.error("Error:", error);
        }
    });

    // Initialize charts
    let barChart, pieChart;
    const barCtx = document.getElementById("barChart").getContext("2d");
    const pieCtx = document.getElementById("pieChart").getContext("2d");

    barChart = new Chart(barCtx, { /* Chart config */ });
    pieChart = new Chart(pieCtx, { /* Chart config */ });

    // Update charts
    function updateCharts(breakdown) {
        barChart.data.labels = breakdown.map(item => item.ingredient);
        barChart.data.datasets[0].data = breakdown.map(item => item.emission);
        barChart.update();

        pieChart.data.labels = breakdown.map(item => item.ingredient);
        pieChart.data.datasets[0].data = breakdown.map(item => item.emission);
        pieChart.update();
    }
});
