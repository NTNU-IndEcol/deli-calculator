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

 // Bar Chart
 const barCtx = document.getElementById("barChart").getContext("2d");
 barChart = new Chart(barCtx, {
     type: "bar",
     data: {
         labels: [],
         datasets: [{
             label: "Carbon Footprint (kg CO₂)",
             data: [],
             backgroundColor: "rgba(75, 192, 192, 0.2)",
             borderColor: "rgba(75, 192, 192, 1)",
             borderWidth: 1
         }]
     },
     options: {
         scales: { y: { beginAtZero: true } }
     }
 });

 // Pie Chart
 const pieCtx = document.getElementById("pieChart").getContext("2d");
 pieChart = new Chart(pieCtx, {
     type: "pie",
     data: {
         labels: [],
         datasets: [{
             label: "Carbon Footprint (kg CO₂)",
             data: [],
             backgroundColor: [
                 "rgba(255, 99, 132, 0.2)",
                 "rgba(54, 162, 235, 0.2)",
                 "rgba(255, 206, 86, 0.2)",
                 "rgba(75, 192, 192, 0.2)",
                 "rgba(153, 102, 255, 0.2)",
                 "rgba(255, 159, 64, 0.2)"
             ],
             borderColor: [
                 "rgba(255, 99, 132, 1)",
                 "rgba(54, 162, 235, 1)",
                 "rgba(255, 206, 86, 1)",
                 "rgba(75, 192, 192, 1)",
                 "rgba(153, 102, 255, 1)",
                 "rgba(255, 159, 64, 1)"
             ],
             borderWidth: 1
         }]
     }
 });
// Define updateCharts
function updateCharts(breakdown) {
    const labels = breakdown.map(item => item.ingredient);
    const emissions = breakdown.map(item => item.emission);

    barChart.data.labels = labels;
    barChart.data.datasets[0].data = emissions;
    barChart.update();

    pieChart.data.labels = labels;
    pieChart.data.datasets[0].data = emissions;
    pieChart.update();
}

// Event listeners and other code
document.getElementById("entry-form").addEventListener("submit", (e) => {
    e.preventDefault();
    // Add entry logic
});

document.getElementById("calculate-total").addEventListener("click", async () => {
    // Calculate logic
    updateCharts(data.breakdown); // Now accessible
});

});
