// Initialize charts
let barChart, pieChart;

document.addEventListener("DOMContentLoaded", () => {
    const barCtx = document.getElementById("barChart").getContext("2d");
    const pieCtx = document.getElementById("pieChart").getContext("2d");

    barChart = new Chart(barCtx, {
        type: "bar",
        data: {
            labels: [], // Ingredients
            datasets: [{
                label: "Carbon Footprint (kg CO₂)",
                data: [], // Emissions
                backgroundColor: "rgba(75, 192, 192, 0.2)",
                borderColor: "rgba(75, 192, 192, 1)",
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    pieChart = new Chart(pieCtx, {
        type: "pie",
        data: {
            labels: [], // Ingredients
            datasets: [{
                label: "Carbon Footprint (kg CO₂)",
                data: [], // Emissions
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
});

// Update charts with new data
function updateCharts(ingredient, emission) {
    // Add data to bar chart
    barChart.data.labels.push(ingredient);
    barChart.data.datasets[0].data.push(emission);
    barChart.update();

    // Add data to pie chart
    pieChart.data.labels.push(ingredient);
    pieChart.data.datasets[0].data.push(emission);
    pieChart.update();
}

// Handle form submission
document.getElementById("calculator-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const ingredient = document.getElementById("ingredient").value;
    const amount = document.getElementById("amount").value;
    const unit = document.getElementById("unit").value;
    const importLocation = document.getElementById("import-location").value;

    const response = await fetch("/calculate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ ingredient, amount, unit, import_location: importLocation }),
    });

    const data = await response.json();
    const resultElement = document.getElementById("result");

    if (data.error) {
        resultElement.textContent = `Error: ${data.error}`;
    } else {
        resultElement.textContent = `Carbon Footprint: ${data.emission.toFixed(2)} kg CO₂`;
        updateCharts(ingredient, data.emission);
    }
});
