// frontend/static/js/location-selector.js
import { LocationManager } from './location-manager.js';

export class LocationSelector {
    constructor() {
        this.input = document.getElementById('location-input');
        this.suggestions = document.getElementById('location-suggestions');
        this.resetBtn = document.getElementById('location-reset-btn');
        this.countries = [];
        
        this.ready = this.init();
    }

    async init() {
        const { DataManager } = await import('./data-manager.js');
        
        await this.waitForRegions();
        
        this.countries = DataManager.datasets.regions || [];
        
        const detectedLocation = await LocationManager.initialize(this.countries);
        
        this.input.value = detectedLocation.countryName;
        
        await this.updateDataManager(detectedLocation);
        
        this.setupEventListeners();
        
        console.log('📍 Location Selector initialized');
    }

    async waitForRegions() {
        const { DataManager } = await import('./data-manager.js');
        return DataManager.waitForRegions();
    }

    // 🔥 FIXED: Better ingredient preservation logic
    async updateDataManager(location) {
        const { DataManager } = await import('./data-manager.js');
        
        try {
            // SAVE current ingredients with more detail
            let savedState = null;
            const formHandlerInstance = window.formHandler;
            
            if (formHandlerInstance && formHandlerInstance.selectedIngredients.length > 0) {
                savedState = {
                    selected: formHandlerInstance.selectedIngredients.map(ing => ({
                        ...ing,
                        // Store original source info
                        originalSource: ing.source,
                        originalPossibleSources: [...(ing.possibleSources || [])]
                    })),
                    unmatched: [...formHandlerInstance.unmatchedIngredients]
                };
                console.log('💾 Saved', savedState.selected.length, 'ingredients before location change');
            }
            
            // Update DataManager's location
            DataManager.userLocation = {
                countryName: location.countryName,
                countryCodeISO3: location.countryCodeISO3,
                countryCode: location.countryCode,
                success: true
            };
            
            console.log(`🔄 Updating DataManager for: ${location.countryName} (${location.countryCodeISO3})`);
            
            // Reload import data and database for new location
            await DataManager.loadImportData();
            await DataManager.loadDatabase();
            DataManager.updateUserLocationCode();
            
            console.log(`✅ DataManager updated for: ${location.countryName}`);
            
            // RESTORE and UPDATE ingredients with new location data
            if (savedState && formHandlerInstance) {
                console.log('🔄 Restoring and updating ingredients with new location data...');
                
                // Update sources for matched ingredients
                savedState.selected.forEach(ing => {
                    // Get fresh source list from database with new Top1-Top5
                    const dbMatch = DataManager.database.find(item => 
                        item.comm_code === ing.comm_code
                    );
                    
                    if (dbMatch) {
                        // Get new possible sources for this location
                        const newPossibleSources = [
                            dbMatch.Top1, 
                            dbMatch.Top2, 
                            dbMatch.Top3, 
                            dbMatch.Top4, 
                            dbMatch.Top5
                        ].filter(Boolean);
                        
                        ing.possibleSources = newPossibleSources;
                        
                        // Smart source selection:
                        // 1. If original source is still available, keep it
                        // 2. Otherwise, use first available source
                        if (newPossibleSources.includes(ing.originalSource)) {
                            ing.source = ing.originalSource;
                        } else {
                            ing.source = newPossibleSources[0] || '';
                            console.log(`  ℹ️ ${ing.name}: Source changed from "${ing.originalSource}" to "${ing.source}"`);
                        }
                    }
                });
                
                // Restore arrays
                formHandlerInstance.selectedIngredients = savedState.selected;
                formHandlerInstance.unmatchedIngredients = savedState.unmatched;
                
                // Update table to show new sources
                formHandlerInstance.updateTable();
                
                console.log('✅ Ingredients restored with updated sources for', location.countryName);
            }
            
        } catch (error) {
            console.error('❌ Failed to update DataManager:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Input event for autocomplete
        this.input.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            
            if (query.length < 2) {
                this.hideSuggestions();
                return;
            }
            
            this.showSuggestions(query);
        });

        // Handle selection
        this.suggestions.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-item')) {
                const countryName = e.target.textContent;
                const country = this.countries.find(c => 
                    c.CountryName === countryName
                );
                
                if (country) {
                    this.selectCountry(country);
                }
            }
        });

        // Reset button
        this.resetBtn.addEventListener('click', () => {
            this.resetToDetected();
        });

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.suggestions.contains(e.target)) {
                this.hideSuggestions();
            }
        });

        // Show/hide reset button based on input
        this.input.addEventListener('input', () => {
            this.updateResetButton();
        });
    }

    showSuggestions(query) {
        const filtered = this.countries
            .filter(country => 
                country.CountryName.toLowerCase().includes(query)
            )
            .slice(0, 10);

        if (filtered.length === 0) {
            this.suggestions.innerHTML = '<li class="no-results">No countries found</li>';
        } else {
            this.suggestions.innerHTML = filtered
                .map(country => `<li class="suggestion-item">${country.CountryName}</li>`)
                .join('');
        }

        this.suggestions.classList.add('active');
        this.suggestions.style.display = 'block';
    }

    hideSuggestions() {
        this.suggestions.classList.remove('active');
        this.suggestions.style.display = 'none';
        this.suggestions.innerHTML = '';
    }

    async selectCountry(country) {
        const { DataManager } = await import('./data-manager.js');
        
        const iso3Code = country.iso3c || country.ISO3 || country.iso3;
        
        if (!iso3Code || !country.CountryCode) {
            console.error('❌ Invalid country data:', country);
            this.showNotification(`Error: Invalid country data for ${country.CountryName}`);
            return;
        }
        
        // Update input
        this.input.value = country.CountryName;
        this.hideSuggestions();

        // Update location via updateDataManager (preserves ingredients)
        const newLocation = {
            countryName: country.CountryName,
            countryCodeISO3: iso3Code,
            countryCode: country.CountryCode
        };

        console.log(`🔄 Updating location to:`, newLocation);

        try {
            await this.updateDataManager(newLocation);
            
            console.log(`✅ Location changed to: ${country.CountryName} (${iso3Code})`);
            this.showNotification(`Location updated to ${country.CountryName}`);
        } catch (error) {
            console.error('❌ Failed to update location:', error);
            this.showNotification(`Error updating to ${country.CountryName}`);
        }

        // Update reset button visibility
        this.updateResetButton();

        // Dispatch event
        window.dispatchEvent(new CustomEvent('locationChanged', {
            detail: { country: country }
        }));
    }

    async resetToDetected() {
        const detectedLocation = LocationManager.resetToDetected();
        
        if (!detectedLocation) {
            console.error('No detected location available');
            return;
        }
        
        // Update UI
        this.input.value = detectedLocation.countryName;
        
        // Update DataManager and reload data (preserves ingredients)
        await this.updateDataManager(detectedLocation);
        
        // Hide reset button
        this.updateResetButton();
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('locationChanged', {
            detail: { location: detectedLocation }
        }));
        
        this.showNotification(`Location reset to ${detectedLocation.countryName}`);
        console.log('🔄 Reset to detected location:', detectedLocation.countryName);
    }

    updateResetButton() {
        const isManuallySet = LocationManager.isManuallySet();
        
        if (isManuallySet) {
            this.resetBtn.classList.add('visible');
        } else {
            this.resetBtn.classList.remove('visible');
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'location-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Auto-initialize animations
if (!document.getElementById('location-animations')) {
    const style = document.createElement('style');
    style.id = 'location-animations';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
        
        #location-suggestions {
            background: white !important;
            color: #333 !important;
        }
        
        #location-suggestions .suggestion-item {
            color: #333 !important;
            background: white !important;
        }
        
        #location-suggestions .suggestion-item:hover {
            background: #f0f7f0 !important;
            color: #333 !important;
        }
        
        #location-suggestions .no-results {
            color: #999 !important;
            background: white !important;
        }
    `;
    document.head.appendChild(style);
}
