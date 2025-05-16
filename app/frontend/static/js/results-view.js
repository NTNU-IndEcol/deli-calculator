// frontend/static/js/ui/results-view.js

export class ResultsView {
    constructor() {
      this.elements = {
        container: document.getElementById('calculation-results'),
      //  totalEmission: document.getElementById('total-emission'),
      //  breakdownBody: document.getElementById('breakdown-body'),
      //  chartCanvas: document.getElementById('impact-chart'),
      //  exportButton: document.getElementById('export-results'),
        co2Display: document.getElementById('co2-result'),
        waterDisplay: document.getElementById('water-result'),
        landDisplay: document.getElementById('land-result')
      };
  
  //    this.chartInstance = null;
  //    this.initialize();
    }

    showResults(data) {
      this.elements.co2Display.textContent = `${data.co2e} kg CO₂ eq`;
      this.elements.waterDisplay.textContent = `${data.water} m3`;
      this.elements.landDisplay.textContent = `${data.land} hectare`;
    }
  
    clear() {
      if (this.elements.co2Display) this.elements.co2Display.textContent = '--';
      if (this.elements.waterDisplay) this.elements.waterDisplay.textContent = '--';
      if (this.elements.landDisplay) this.elements.landDisplay.textContent = '--';
    }

  
    /*
    initialize() {
      this.elements.exportButton?.addEventListener('click', () => this.exportResults());
    }
    
    showError(message) {
      const errorContainer = document.getElementById('error-container');
      if (errorContainer) {
        errorContainer.innerHTML = `
          <div class="alert error">
            ${message}
          </div>
        `;
      }
    }
*/
    /*
    static displayRecipe(recipe) {
      const ingredientsSection = document.querySelector('.Ingredients');
      if (!ingredientsSection) return;

      // Add recipe header above table
      const header = document.createElement('div');
      header.className = 'recipe-header';
      header.innerHTML = `
          <h3>${recipe.name}</h3>
          <div class="recipe-meta">
              <span>Servings: ${recipe.recipeYield}</span>
              <span>Prep: ${recipe.prepTime}</span>
              <span>Cook: ${recipe.cookTime}</span>
          </div>
      `;
      
      ingredientsSection.insertBefore(header, ingredientsSection.firstChild);
    }
    */

    /*
    display(results) {
      this.clear();
      
      const resultsContainer = document.getElementById('results-container');
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <h3>Calculation Results</h3>
          <pre>${JSON.stringify(results, null, 2)}</pre>
        `;
      }
  
      this.renderTotal(results.total_emission);
      this.renderBreakdown(results.breakdown);
      this.renderChart(results.breakdown);
      this.elements.container.classList.remove('hidden');
    }
  
    renderTotal(totalEmission) {
      this.elements.totalEmission.textContent = 
        `${totalEmission.toFixed(2)} kg CO₂eq`;
    }
  
    renderBreakdown(breakdown) {
      this.elements.breakdownBody.innerHTML = breakdown
        .map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${item.ingredient}</td>
            <td>${item.emission.toFixed(2)} kg</td>
            <td>${this.getImpactLevel(item.emission)}</td>
          </tr>
        `).join('');
    }
  
    renderChart(breakdown) {
      if (this.chartInstance) this.chartInstance.destroy();
  
      const ctx = this.elements.chartCanvas.getContext('2d');
      const labels = breakdown.map(item => item.ingredient);
      const data = breakdown.map(item => item.emission);
  
      this.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Emissions (kg CO₂eq)',
            data: data,
            backgroundColor: '#4CAF50',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Kilograms of CO₂ Equivalent'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Ingredients'
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
            },
            tooltip: {
              callbacks: {
                label: (context) => 
                  `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`
              }
            }
          }
        }
      });
    }
  
    getImpactLevel(emission) {
      if (emission > 10) return '🔴 High';
      if (emission > 5) return '🟡 Medium';
      return '🟢 Low';
    }
  
    showError(message) {
      this.clear();
      this.elements.container.innerHTML = `
        <div class="alert error">
          <h4>Calculation Error</h4>
          <p>${message}</p>
        </div>
      `;
      this.elements.container.classList.remove('hidden');
    }
  
    clear() {
      this.elements.container.classList.add('hidden');
      this.elements.container.innerHTML = `
        <h3>Total Environmental Impact: <span id="total-emission"></span></h3>
        <canvas id="impact-chart"></canvas>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Ingredient</th>
              <th>Emission</th>
              <th>Impact Level</th>
            </tr>
          </thead>
          <tbody id="breakdown-body"></tbody>
        </table>
        <button id="export-results" class="export-btn">📥 Export Results</button>
      `;
  
      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }
    }
  
    async exportResults() {
      try {
        const timestamp = new Date().toISOString().slice(0, 16);
        const filename = `food-impact-${timestamp}.pdf`;
        
        // Example PDF generation - implement based on your PDF library
        const pdf = await this.generatePDF();
        const blob = new Blob([pdf], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
      } catch (error) {
        this.showError('Export failed: ' + error.message);
      }
    }
  
    async generatePDF() {
      // Implement actual PDF generation logic using a library like jsPDF
      // This is a placeholder implementation
      return new Promise(resolve => {
        const content = document.getElementById('calculation-results').innerHTML;
        resolve(this.htmlToPdf(content));
      });
    }
  
    htmlToPdf(html) {
      // Actual PDF conversion logic would go here
      // Return mock PDF content for demonstration
      return new TextEncoder().encode('PDF Export Feature - Implement with jsPDF');
    }

    */

  }