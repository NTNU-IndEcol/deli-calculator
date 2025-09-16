// frontend/static/js/ui/results-view.js

export class ResultsView {
    constructor() {
      this.elements = {
        container: document.getElementById('calculation-results'),
      //  totalEmission: document.getElementById('total-emission'),
      //  breakdownBody: document.getElementById('breakdown-body'),
      //  chartCanvas: document.getElementById('impact-chart'),
      //  exportButton: document.getElementById('export-results'),
        total_bdDisplay: document.getElementById('total_bd-result'),
        co2Display: document.getElementById('co2-result'),
        waterDisplay: document.getElementById('water-result'),
        landDisplay: document.getElementById('land-result')
      };
  
  //    this.chartInstance = null;
  //    this.initialize();
    }

    showResults(data) {
      
     
      this.elements.total_bdDisplay.textContent = `${data.total_bd} PDF`;
      this.elements.co2Display.textContent = `${data.co2e} kg CO₂ eq`;
      this.elements.waterDisplay.textContent = `${data.water} m3`;
      this.elements.landDisplay.textContent = `${data.land} m2`;


    }
  
    clear() {
      if (this.elements.total_bdDisplay) this.elements.total_bdDisplay.textContent = '--';
      if (this.elements.co2Display) this.elements.co2Display.textContent = '--';
      if (this.elements.waterDisplay) this.elements.waterDisplay.textContent = '--';
      if (this.elements.landDisplay) this.elements.landDisplay.textContent = '--';
    }
 

  }