// frontend/static/js/ui/results-view.js

export class ResultsView {
    constructor() {
        this.elements = {
            container: document.getElementById('calculation-results'),
            biodivDisplay: document.getElementById('biodiv-result'),
            co2Display: document.getElementById('co2-result'),
            waterDisplay: document.getElementById('water-result'),
            landDisplay: document.getElementById('land-result')
        };
        
        this.currentMetric = 'biodiv'; // Track currently selected metric
        this.onMetricChange = null; // Callback for when user clicks a metric
    }

    showResults(data) {
        console.log('📊 Displaying total impact results:', data);
        
        // Format biodiversity (PDF·yr)
        let biodivDisplay;
        if (data.biodiv === 0 || !data.biodiv) {
            biodivDisplay = '0.00';
        } else if (data.biodiv < 0.0001) {
            biodivDisplay = data.biodiv.toExponential(2);
        } else if (data.biodiv < 1) {
            biodivDisplay = data.biodiv.toFixed(6);
        } else {
            biodivDisplay = data.biodiv.toFixed(4);
        }
        
        // Format CO2eq (kg)
        let co2Display;
        if (data.gwp100 === 0 || !data.gwp100) {
            co2Display = '0.00';
        } else if (data.gwp100 >= 1000) {
            co2Display = (data.gwp100 / 1000).toFixed(2) + ' t';
        } else if (data.gwp100 >= 10) {
            co2Display = data.gwp100.toFixed(1);
        } else {
            co2Display = data.gwp100.toFixed(2);
        }
        
        // Format water (m³)
        let waterDisplay;
        if (data.waterUse === 0 || !data.waterUse) {
            waterDisplay = '0.00';
        } else if (data.waterUse >= 1000) {
            waterDisplay = data.waterUse.toFixed(0);
        } else if (data.waterUse >= 10) {
            waterDisplay = data.waterUse.toFixed(1);
        } else if (data.waterUse >= 0.01) {
            waterDisplay = data.waterUse.toFixed(2);
        } else {
            waterDisplay = data.waterUse.toExponential(2);
        }
        
        // Format land use (m²)
        let landDisplay;
        if (data.landUse === 0 || !data.landUse) {
            landDisplay = '0.00';
        } else if (data.landUse >= 10000) {
            landDisplay = (data.landUse / 10000).toFixed(2) + ' ha';
        } else if (data.landUse >= 1000) {
            landDisplay = data.landUse.toFixed(0);
        } else if (data.landUse >= 10) {
            landDisplay = data.landUse.toFixed(1);
        } else if (data.landUse >= 0.01) {
            landDisplay = data.landUse.toFixed(2);
        } else {
            landDisplay = data.landUse.toExponential(2);
        }
        
        // Update displays
        this.elements.biodivDisplay.textContent = `${biodivDisplay} PDF·yr`;
        this.elements.co2Display.textContent = `${co2Display}${data.gwp100 >= 1000 ? '' : ' '} kg CO₂eq`;
        this.elements.waterDisplay.textContent = `${waterDisplay} m³`;
        this.elements.landDisplay.textContent = `${landDisplay}${data.landUse >= 10000 ? '' : (data.landUse >= 0.01 ? ' m²' : '')}`;
        
        // Make result items clickable
        this.setupClickableResults();
        
        // Highlight the currently selected metric
        this.highlightSelectedMetric(this.currentMetric);
        
        console.log('✅ Results displayed');
        
        if (this.elements.container) {
            this.elements.container.style.display = 'block';
        }
        
        this.highlightResults();
    }
    
    setupClickableResults() {
        // Make each result card clickable
        const resultCards = [
            { element: this.elements.biodivDisplay?.parentElement, metric: 'biodiv', name: 'Biodiversity' },
            { element: this.elements.co2Display?.parentElement, metric: 'gwp100', name: 'CO₂ Emissions' },
            { element: this.elements.waterDisplay?.parentElement, metric: 'water', name: 'Water Use' },
            { element: this.elements.landDisplay?.parentElement, metric: 'land', name: 'Land Use' }
        ];
        
        resultCards.forEach(card => {
            if (card.element) {
                // Add pointer cursor
                card.element.style.cursor = 'pointer';
                card.element.style.transition = 'transform 0.2s, box-shadow 0.2s';
                
                // Add hover effect
                card.element.addEventListener('mouseenter', () => {
                    if (this.currentMetric !== card.metric) {
                        card.element.style.transform = 'translateY(-2px)';
                        card.element.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                    }
                });
                
                card.element.addEventListener('mouseleave', () => {
                    if (this.currentMetric !== card.metric) {
                        card.element.style.transform = '';
                        card.element.style.boxShadow = '';
                    }
                });
                
                // Add click handler
                card.element.addEventListener('click', () => {
                    console.log(`🗺️ Switching map to show: ${card.name}`);
                    this.currentMetric = card.metric;
                    this.highlightSelectedMetric(card.metric);
                    
                    // Trigger callback to update map
                    if (this.onMetricChange) {
                        this.onMetricChange(card.metric);
                    }
                });
            }
        });
    }
    
    highlightSelectedMetric(metric) {
        // Remove highlight from all
        const allCards = [
            this.elements.biodivDisplay?.parentElement,
            this.elements.co2Display?.parentElement,
            this.elements.waterDisplay?.parentElement,
            this.elements.landDisplay?.parentElement
        ];
        
        allCards.forEach(card => {
            if (card) {
                card.style.transform = '';
                card.style.boxShadow = '';
                card.style.borderLeft = '4px solid transparent';
            }
        });
        
        // Highlight selected
        const metricMap = {
            'biodiv': this.elements.biodivDisplay?.parentElement,
            'gwp100': this.elements.co2Display?.parentElement,
            'water': this.elements.waterDisplay?.parentElement,
            'land': this.elements.landDisplay?.parentElement
        };
        
        const selectedCard = metricMap[metric];
        if (selectedCard) {
            selectedCard.style.borderLeft = '4px solid #4CAF50';
            selectedCard.style.transform = 'translateX(2px)';
            selectedCard.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3)';
        }
    }
    
    highlightResults() {
        const elements = [
            this.elements.biodivDisplay,
            this.elements.co2Display,
            this.elements.waterDisplay,
            this.elements.landDisplay
        ];
        
        elements.forEach(element => {
            if (element) {
                element.style.transition = 'background-color 0.3s ease';
                element.style.backgroundColor = '#e8f5e9';
                
                setTimeout(() => {
                    element.style.backgroundColor = '';
                }, 600);
            }
        });
    }
    
    clear() {
        if (this.elements.biodivDisplay) this.elements.biodivDisplay.textContent = '--';
        if (this.elements.co2Display) this.elements.co2Display.textContent = '--';
        if (this.elements.waterDisplay) this.elements.waterDisplay.textContent = '--';
        if (this.elements.landDisplay) this.elements.landDisplay.textContent = '--';
        
        if (this.elements.container) {
            this.elements.container.style.display = 'none';
        }
    }
    
    showError(message) {
        if (this.elements.container) {
            this.elements.container.innerHTML = `
                <div style="padding: 20px; background-color: #ffebee; border-radius: 8px; color: #c62828;">
                    <strong>Error:</strong> ${message}
                </div>
            `;
            this.elements.container.style.display = 'block';
        }
    }
    
    showLoading() {
        if (this.elements.biodivDisplay) this.elements.biodivDisplay.textContent = 'Calculating...';
        if (this.elements.co2Display) this.elements.co2Display.textContent = 'Calculating...';
        if (this.elements.waterDisplay) this.elements.waterDisplay.textContent = 'Calculating...';
        if (this.elements.landDisplay) this.elements.landDisplay.textContent = 'Calculating...';
        
        if (this.elements.container) {
            this.elements.container.style.display = 'block';
        }
    }
}
