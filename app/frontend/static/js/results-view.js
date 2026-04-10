// frontend/static/js/results-view.js

export class ResultsView {
    constructor() {
        this.storageKey = 'deliComparisonState';
        this.elements = {
            container: document.getElementById('calculation-results'),
            comparisonContainer: document.getElementById('results-comparison'),
            biodivDisplay: document.getElementById('biodiv-result'),
            co2Display: document.getElementById('co2-result'),
            waterDisplay: document.getElementById('water-result'),
            landDisplay: document.getElementById('land-result')
        };
        
        this.currentMetric = 'biodiv'; // Track currently selected metric
        this.onMetricChange = null; // Callback for when user clicks a metric
        this.resultHistory = [];
        this.latestCountryImpactData = [];
        this.latestRecipeLabel = 'recipe';
        this.latestIngredients = [];
        this.getMapExportFiles = null;
        this.restoreState();
    }

    getMetricDefinitions() {
        return [
            { key: 'biodiv', title: 'Biodiversity', className: 'biodiv', valueKey: 'biodiv', exportValueKey: 'biodiv', unit: 'PDF·yr' },
            { key: 'gwp100', title: 'Climate Change (GWP100)', className: 'gwp100', valueKey: 'gwp100', exportValueKey: 'co2e', unit: 'kg CO2e' },
            { key: 'water', title: 'Water Use', className: 'water', valueKey: 'waterUse', exportValueKey: 'water', unit: 'm³' },
            { key: 'land', title: 'Land Use', className: 'land', valueKey: 'landUse', exportValueKey: 'land', unit: 'm²' }
        ];
    }

    setLatestCountryImpactData(impactByCountry, recipeLabel = 'recipe', ingredients = []) {
        this.latestCountryImpactData = Array.isArray(impactByCountry) ? impactByCountry : [];
        this.latestRecipeLabel = recipeLabel || 'recipe';
        this.latestIngredients = Array.isArray(ingredients) ? ingredients : [];
        this.saveState();
        this.renderComparisonCharts();
    }

    formatMetricValue(metric, value) {
        if (value === 0 || !value) {
            switch (metric) {
                case 'biodiv':
                    return '0.00 PDF·yr';
                case 'gwp100':
                    return '0.00 kg CO2e';
                case 'water':
                    return '0.00 m³';
                case 'land':
                    return '0.00 m²';
                default:
                    return '0.00';
            }
        }

        if (metric === 'biodiv') {
            const display = value < 0.0001 ? value.toExponential(2) : (value < 1 ? value.toFixed(6) : value.toFixed(4));
            return `${display} PDF·yr`;
        }

        if (metric === 'gwp100') {
            if (value >= 1000) {
                return `${(value / 1000).toFixed(2)} t CO2e`;
            }
            return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} kg CO2e`;
        }

        if (metric === 'water') {
            const display = value >= 1000 ? value.toFixed(0) : (value >= 10 ? value.toFixed(1) : (value >= 0.01 ? value.toFixed(2) : value.toExponential(2)));
            return `${display} m³`;
        }

        if (metric === 'land') {
            if (value >= 10000) {
                return `${(value / 10000).toFixed(2)} ha`;
            }
            const display = value >= 1000 ? value.toFixed(0) : (value >= 10 ? value.toFixed(1) : (value >= 0.01 ? value.toFixed(2) : value.toExponential(2)));
            return `${display} m²`;
        }

        return String(value);
    }

    formatComparisonValue(metric, value) {
        if (value === 0 || !value) {
            switch (metric) {
                case 'biodiv':
                    return '0';
                case 'gwp100':
                    return '0 kg';
                case 'water':
                    return '0 m³';
                case 'land':
                    return '0 m²';
                default:
                    return '0';
            }
        }

        if (metric === 'biodiv') {
            return value < 0.01 ? value.toExponential(1) : value.toFixed(2);
        }

        if (metric === 'gwp100') {
            return value >= 1000 ? `${(value / 1000).toFixed(1)} t` : `${value.toFixed(value >= 10 ? 0 : 1)} kg`;
        }

        if (metric === 'water') {
            return value >= 100 ? `${value.toFixed(0)} m³` : `${value.toFixed(value >= 10 ? 1 : 2)} m³`;
        }

        if (metric === 'land') {
            return value >= 10000 ? `${(value / 10000).toFixed(1)} ha` : `${value.toFixed(value >= 10 ? 1 : 2)} m²`;
        }

        return String(value);
    }

    showResults(data, label = null) {
        console.log('📊 Displaying total impact results:', data);

        // Update displays
        this.elements.biodivDisplay.textContent = this.formatMetricValue('biodiv', data.biodiv);
        this.elements.co2Display.textContent = this.formatMetricValue('gwp100', data.gwp100);
        this.elements.waterDisplay.textContent = this.formatMetricValue('water', data.waterUse);
        this.elements.landDisplay.textContent = this.formatMetricValue('land', data.landUse);
        
        // Make result items clickable
        this.setupClickableResults();
        
        // Highlight the currently selected metric
        this.highlightSelectedMetric(this.currentMetric);
        
        console.log('✅ Results displayed');
        
        if (this.elements.container) {
            this.elements.container.style.display = 'block';
        }
        
        this.resultHistory.push({
            label: label || `Recipe ${this.resultHistory.length + 1}`,
            biodiv: data.biodiv || 0,
            gwp100: data.gwp100 || 0,
            waterUse: data.waterUse || 0,
            landUse: data.landUse || 0
        });

        this.saveState();
        this.renderComparisonCharts();
        this.highlightResults();
    }

    saveState() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                currentMetric: this.currentMetric,
                resultHistory: this.resultHistory,
                latestCountryImpactData: this.latestCountryImpactData,
                latestRecipeLabel: this.latestRecipeLabel,
                latestIngredients: this.latestIngredients
            }));
        } catch (error) {
            console.warn('Could not save comparison state:', error);
        }
    }

    restoreState() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;

            const state = JSON.parse(raw);
            this.currentMetric = state.currentMetric || 'biodiv';
            this.resultHistory = Array.isArray(state.resultHistory) ? state.resultHistory : [];
            this.latestCountryImpactData = Array.isArray(state.latestCountryImpactData) ? state.latestCountryImpactData : [];
            this.latestRecipeLabel = state.latestRecipeLabel || 'recipe';
            this.latestIngredients = Array.isArray(state.latestIngredients) ? state.latestIngredients : [];

            if (this.resultHistory.length > 0) {
                this.renderComparisonCharts();
            }
        } catch (error) {
            console.warn('Could not restore comparison state:', error);
        }
    }
    
    setupClickableResults() {
        // Make each result card clickable
        const resultCards = [
            { element: this.elements.biodivDisplay?.parentElement, metric: 'biodiv', name: 'Biodiversity' },
            { element: this.elements.co2Display?.parentElement, metric: 'gwp100', name: 'Climate Change (GWP100)' },
            { element: this.elements.waterDisplay?.parentElement, metric: 'water', name: 'Water Use' },
            { element: this.elements.landDisplay?.parentElement, metric: 'land', name: 'Land Use' }
        ];
        
        resultCards.forEach(card => {
            if (card.element && card.element.dataset.metricBound !== 'true') {
                card.element.dataset.metricBound = 'true';
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

    getComparisonWidth(metricKey, rawValue, allValues) {
        if (!rawValue || rawValue <= 0) {
            return 0;
        }

        if (metricKey === 'biodiv') {
            const positiveValues = allValues.filter(value => value > 0);
            if (positiveValues.length === 0) {
                return 0;
            }

            const minValue = Math.min(...positiveValues);
            const maxValue = Math.max(...positiveValues);

            if (minValue === maxValue) {
                return 100;
            }

            const logMin = Math.log10(minValue);
            const logMax = Math.log10(maxValue);
            const logValue = Math.log10(rawValue);

            return Math.max(((logValue - logMin) / (logMax - logMin)) * 100, 8);
        }

        const maxValue = Math.max(...allValues, 1);
        return maxValue > 0 ? Math.max((rawValue / maxValue) * 100, 2) : 0;
    }

    renderComparisonCharts() {
        if (!this.elements.comparisonContainer) {
            return;
        }

        if (this.resultHistory.length === 0) {
            this.elements.comparisonContainer.innerHTML = '';
            return;
        }

        const metrics = this.getMetricDefinitions();

        const cardsHtml = metrics.map(metric => {
            const values = this.resultHistory.map(entry => entry[metric.valueKey] || 0);
            const barsHtml = this.resultHistory.map(entry => {
                const rawValue = entry[metric.valueKey] || 0;
                const width = this.getComparisonWidth(metric.key, rawValue, values);
                return `
                    <div class="comparison-row">
                        <div class="comparison-label">${entry.label}</div>
                        <div class="comparison-bar-track">
                            <div class="comparison-bar ${metric.className}" style="width: ${width}%"></div>
                        </div>
                        <div class="comparison-value">${this.formatComparisonValue(metric.key, rawValue)}</div>
                    </div>
                `;
            }).join('');

            return `
                <article class="comparison-card">
                    <h3>${metric.title}</h3>
                    <div class="comparison-chart">
                        ${barsHtml}
                    </div>
                </article>
            `;
        }).join('');

        this.elements.comparisonContainer.innerHTML = `
            <div class="comparison-header">
                <h2>
                    Recipe Comparison
                    <button class="inline-help-icon tiny"
                            type="button"
                            aria-label="Recipe comparison help"
                            data-tooltip-text="The name of recipe base on the top three ingredients.">?</button>
                </h2>
                <p>Each new calculation adds another bar so you can compare recipes across the four impact indicators.</p>
                <div class="export-actions">
                    <div class="export-action-group">
                        <button class="button button-secondary export-button" type="button" data-export-all="true">
                            Export Impact Result
                        </button>
                        <button class="inline-help-icon tiny export-help-icon"
                                type="button"
                                aria-label="Export help"
                                data-tooltip-text="Export the result from the newest environmental impact calculation.">?</button>
                    </div>
                    <button class="button button-primary reset-comparison-button" type="button" data-reset-comparison="true">
                        Reset Comparison
                    </button>
                </div>
            </div>
            <div class="comparison-grid">
                ${cardsHtml}
            </div>
        `;

        this.bindExportButton();
        this.bindResetButton();
    }

    bindExportButton() {
        const button = this.elements.comparisonContainer?.querySelector('[data-export-all]');
        if (!button || button.dataset.exportBound === 'true') return;

        button.dataset.exportBound = 'true';
        button.addEventListener('click', async () => {
            try {
                await this.exportAllMetricsData();
            } catch (error) {
                console.error('Export failed:', error);
                alert('Failed to export the latest impact result.');
            }
        });
    }

    bindResetButton() {
        const button = this.elements.comparisonContainer?.querySelector('[data-reset-comparison]');
        if (!button || button.dataset.resetBound === 'true') return;

        button.dataset.resetBound = 'true';
        button.addEventListener('click', () => {
            this.resetComparison();
        });
    }

    resetComparison() {
        this.resultHistory = [];
        this.latestCountryImpactData = [];
        this.latestRecipeLabel = 'recipe';
        this.latestIngredients = [];

        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('Could not clear comparison state:', error);
        }

        if (this.elements.comparisonContainer) {
            this.elements.comparisonContainer.innerHTML = '';
        }
    }

    async exportAllMetricsData() {
        const metrics = this.getMetricDefinitions();
        if (!Array.isArray(this.latestCountryImpactData) || this.latestCountryImpactData.length === 0) {
            console.warn('No country impact data available for export');
            return;
        }

        const csvRows = [
            ['Ingredient List'].join(','),
            ['recipe_label', 'ingredient', 'category', 'amount', 'unit', 'source', 'matched_ingredient', 'commodity_code'].join(',')
        ];

        this.latestIngredients.forEach(ingredient => {
            csvRows.push([
                this.escapeCsvValue(this.latestRecipeLabel),
                this.escapeCsvValue(ingredient.displayName || ingredient.name || ''),
                this.escapeCsvValue(ingredient.category || ''),
                ingredient.amount ?? '',
                this.escapeCsvValue(ingredient.unit || ''),
                this.escapeCsvValue(ingredient.source || ''),
                this.escapeCsvValue(ingredient.matchedTo || ingredient.name || ''),
                this.escapeCsvValue(ingredient.comm_code || '')
            ].join(','));
        });

        csvRows.push('');
        csvRows.push('Impact Results');
        csvRows.push(
            ['recipe_label', 'metric', 'country', 'country_code', 'impact_value', 'unit', 'share_percent'].join(',')
        );

        metrics.forEach(metric => {
            const rows = this.latestCountryImpactData
                .map(entry => {
                    const value = entry[metric.exportValueKey] || 0;
                    return {
                        country: entry.country,
                        countryCode: entry.countryCode || '',
                        value,
                        share: 0
                    };
                })
                .filter(entry => entry.value > 0);

            const total = rows.reduce((sum, entry) => sum + entry.value, 0);
            if (total <= 0) {
                return;
            }

            const filteredRows = rows
                .map(entry => ({
                    ...entry,
                    share: (entry.value / total) * 100
                }))
                .filter(entry => entry.share > 0.1)
                .sort((a, b) => b.value - a.value);

            filteredRows.forEach(entry => {
                csvRows.push([
                    this.escapeCsvValue(this.latestRecipeLabel),
                    this.escapeCsvValue(metric.title),
                    this.escapeCsvValue(entry.country),
                    this.escapeCsvValue(entry.countryCode),
                    entry.value,
                    this.escapeCsvValue(metric.unit),
                    entry.share.toFixed(2)
                ].join(','));
            });
        });

        const csvContent = csvRows.join('\n');
        const mapFiles = this.getMapExportFiles ? await this.getMapExportFiles() : [];
        const zipFilename = `${this.slugify(this.latestRecipeLabel)}_impact_export.zip`;

        const response = await fetch('/api/export-impact-zip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: zipFilename,
                files: [
                    {
                        name: `${this.slugify(this.latestRecipeLabel)}_all_impacts.csv`,
                        content: csvContent
                    },
                    ...mapFiles
                ]
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create ZIP export');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = zipFilename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    escapeCsvValue(value) {
        const stringValue = String(value ?? '');
        if (/[",\n]/.test(stringValue)) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }

    slugify(value) {
        return String(value || 'recipe')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80) || 'recipe';
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
            this.elements.container.style.display = this.resultHistory.length > 0 ? 'block' : 'none';
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
