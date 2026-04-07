// map-view.js - Complete updated version with metric switching
import { DataManager } from './data-manager.js';

export class MapView {
    constructor(mapContainerId) {
        this.mapContainerId = mapContainerId;
        this.map = null;
        this.layerGroup = null;
        this.countryLayers = new Map();
        this.tileLayer = null;
        this.geoJsonData = null;
        this.maxTotalImpact = 1;
        this.maxBiodiversity = 1;
        this.maxGWP = 1;
        this.maxWater = 1;
        this.maxLand = 1;
        this.currentMetric = 'biodiv'; // Track which metric to display
        this.cachedImpactData = null; // Store impact data for re-rendering
        this.selectedLayer = null; // Track currently selected/highlighted country

        this.handleMapMove = this.handleMapMove.bind(this);
        this.handleMapZoom = this.handleMapZoom.bind(this);
        this.handleResize = this.handleResize.bind(this);

        this.initMap();
    }

    async initMap() {
        const container = document.getElementById(this.mapContainerId);
        if (!container) {
            console.error(`Map container #${this.mapContainerId} not found!`);
            return;
        }
        
        if (container._leaflet_id) {
            container._leaflet_id = null;
            container.innerHTML = '';
        }

        const southBound = -56;
        const northBound = 80;
        
        this.map = L.map(this.mapContainerId, {
            minZoom: 1.5,
            maxZoom: 6,
            maxBounds: L.latLngBounds(L.latLng(southBound, -180), L.latLng(northBound, 180)),
            maxBoundsViscosity: 1.0,
            worldCopyJump: true,
            zoomControl: false, // Disable default zoom control
            attributionControl: true
        }).setView([20, 0], 2);
    
        // Add custom zoom control in top-right
        L.control.zoom({
            position: 'topright'
        }).addTo(this.map);
    
        this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            detectRetina: true,
            updateWhenIdle: false,
            reuseTiles: true,
            unloadInvisibleTiles: true
        }).addTo(this.map);

        this.layerGroup = L.layerGroup().addTo(this.map);
        this.addLegend();
        
        try {
            this.geoJsonData = await DataManager.loadGeoJsonData();
            console.log('GeoJSON data loaded successfully');
        } catch (error) {
            console.error('Failed to load GeoJSON data:', error);
        }
        
        this.map.on('moveend', this.handleMapMove);
        this.map.on('zoomend', this.handleMapZoom);
    //    window.addEventListener('resize', this.handleResize);
        
        console.log("Map initialized successfully");
    }

    handleMapMove() {}
    handleMapZoom() {}
    handleResize() {
        this.map.invalidateSize();
    }

    // New method to switch metrics
    setMetric(metric) {
        console.log(`📊 Switching map visualization to: ${metric}`);
        this.currentMetric = metric;
        
        // Re-render map with cached data
        if (this.cachedImpactData) {
            this.updateMapVisualization(this.cachedImpactData);
        }
    }

    
    async updateMap(impactData) {
        console.log("Updating map with impact data:", impactData);
        
        // Store data for later use when switching metrics
        this.cachedImpactData = impactData;
        
        this.layerGroup.clearLayers();
        this.countryLayers.clear();
        
        if (!impactData || impactData.length === 0) {
            console.warn("No impact data to display");
            return;
        }
        
        if (!this.geoJsonData) {
            console.log("GeoJSON data not loaded yet. Loading now...");
            try {
                this.geoJsonData = await DataManager.loadGeoJsonData();
            } catch (error) {
                console.error('Failed to load GeoJSON data:', error);
                return;
            }
        }

        const countryLookup = new Map();
        this.geoJsonData.features.forEach(feature => {
            const countryName = feature.properties.countryName;
            if (countryName) {
                const normalized = countryName.toLowerCase().trim();
                countryLookup.set(normalized, feature);
            }
        });
        
        // Calculate max values for all metrics
        this.calculateMaxValues(impactData);
        this.updateLegend();

        const layersAdded = [];
        const unmatchedCountries = [];
        const skippedRegions = [];
        
        impactData.forEach(data => {
            const normalizedCountry = this.normalizeCountryName(data.country);
            
            if (normalizedCountry === "") {
                skippedRegions.push(data.country);
                return;
            }

            let geoJsonFeature = countryLookup.get(normalizedCountry);
            
            if (!geoJsonFeature) {
                unmatchedCountries.push({
                    original: data.country,
                    normalized: normalizedCountry
                });
                return;
            }
            
            const polygonLayer = L.geoJSON(geoJsonFeature, {
                style: this.getCountryStyle(data),
                onEachFeature: (feature, layer) => {
                    // Store original style for restoring later
                    const originalStyle = this.getCountryStyle(data);
                    
                    // Add click handler for highlighting and positioning popup
                    layer.on('click', (e) => {
                        // Remove highlight from previously selected country
                        if (this.selectedLayer && this.selectedLayer !== layer) {
                            this.selectedLayer.setStyle(this.selectedLayer.originalStyle);
                        }
                        
                        // Highlight this country
                        layer.setStyle({
                            weight: 3,
                            color: '#ff6600',
                            fillOpacity: 0.9
                        });
                        
                        // Store reference to this layer
                        this.selectedLayer = layer;
                        layer.originalStyle = originalStyle;
                        
                        // Get click position in screen coordinates
                        const clickPoint = e.containerPoint;
                        const mapHeight = this.map.getContainer().clientHeight;
                        
                        // Calculate latitude of click
                        const clickLat = e.latlng.lat;
                        
                        // For very northern clicks (lat > 65), zoom in and center
                        if (clickLat > 60) {
                            // Zoom in one level and pan to click location
                            this.map.setView(e.latlng, Math.min(this.map.getZoom() + 1, 3), {
                                animate: true,
                                duration: 0.5
                            });
                            
                            // Show popup after zoom animation
                            setTimeout(() => {
                                const popup = L.popup({
                                    maxWidth: 300,
                                    maxHeight: 180,
                                 //   offset: [0, 50], // Show below for north
                                    autoPan: true,
                                    closeButton: true,
                                    autoClose: true,
                                    closeOnClick: false
                                })
                                .setLatLng(e.latlng)
                                .setContent(this.createPopupContent(data))
                                .openOn(this.map);
                            }, 500);
                        } else {
                            // Normal behavior for other areas
                            // If clicked in upper 30% of screen, show popup below
                            const isTopArea = clickPoint.y < (mapHeight * 0.3);
                            
                            const popupOptions = {
                                maxWidth: 300,
                                offset: isTopArea ? [0, 10] : [0, -10],
                                autoPan: false,
                                closeButton: true,
                                autoClose: true,
                                closeOnClick: false
                            };
                            
                            // Open popup at click location
                            const popup = L.popup(popupOptions)
                                .setLatLng(e.latlng)
                                .setContent(this.createPopupContent(data))
                                .openOn(this.map);
                        }
                    });
                    
                    // Reset style when popup closes
                    layer.on('popupclose', () => {
                        if (layer === this.selectedLayer) {
                            layer.setStyle(originalStyle);
                            this.selectedLayer = null;
                        }
                    });
                }
            }).addTo(this.layerGroup);
            
            this.countryLayers.set(data.country, polygonLayer);
            layersAdded.push(polygonLayer);
        });
        
        if (skippedRegions.length > 0) {
            console.log("\n=== SKIPPED REGIONS (Historical/Aggregates) ===");
            skippedRegions.forEach(region => console.log(`- ${region}`));
            console.log("=== END SKIPPED REGIONS ===\n");
        }
        
        if (unmatchedCountries.length > 0) {
            console.log("\n=== UNMATCHED COUNTRIES ===");
            unmatchedCountries.forEach(country => {
                console.log(`"${country.normalized}": "FIND_IN_GEOJSON",  // Original: ${country.original}`);
            });
            console.log("=== END UNMATCHED COUNTRIES ===\n");
        }
        
        if (layersAdded.length > 0) {
            const group = new L.featureGroup(layersAdded);
            const constrainedBounds = group.getBounds().pad(0.1);
            constrainedBounds.getSouthWest().lat = Math.max(constrainedBounds.getSouthWest().lat, -60);
            constrainedBounds.getNorthEast().lat = Math.min(constrainedBounds.getNorthEast().lat, 85);
            
            this.map.fitBounds(constrainedBounds, {
                padding: [50, 50],
                maxZoom: 5
            });
        }

        console.log(`${layersAdded.length} countries added to map`);
    }

    // New method to re-render map when metric changes
    updateMapVisualization(impactData) {
        this.layerGroup.clearLayers();
        this.countryLayers.clear();
        
        if (!impactData || impactData.length === 0) return;
        
        // Recalculate max values
        this.calculateMaxValues(impactData);
        this.updateLegend();
        
        const countryLookup = new Map();
        this.geoJsonData.features.forEach(feature => {
            const countryName = feature.properties.countryName;
            if (countryName) {
                countryLookup.set(countryName.toLowerCase().trim(), feature);
            }
        });
        
        const layersAdded = [];
        impactData.forEach(data => {
            const normalizedCountry = this.normalizeCountryName(data.country);
            if (normalizedCountry === "") return;
            
            let geoJsonFeature = countryLookup.get(normalizedCountry);
            if (!geoJsonFeature) return;
            
            const polygonLayer = L.geoJSON(geoJsonFeature, {
                style: this.getCountryStyle(data),
                onEachFeature: (feature, layer) => {
                    // Store original style for restoring later
                    const originalStyle = this.getCountryStyle(data);
                    
                    // Add click handler for highlighting and centering popup
                    layer.on('click', (e) => {
                        // Remove highlight from previously selected country
                        if (this.selectedLayer && this.selectedLayer !== layer) {
                            this.selectedLayer.setStyle(this.selectedLayer.originalStyle);
                        }
                        
                        // Highlight this country
                        layer.setStyle({
                            weight: 3,
                            color: '#ff6600',
                            fillOpacity: 0.9
                        });
                        
                        // Store reference to this layer
                        this.selectedLayer = layer;
                        layer.originalStyle = originalStyle;
                        
                        // Calculate center of the country
                        const bounds = layer.getBounds();
                        const center = bounds.getCenter();
                    /*    
                        // Open popup at center
                        const popup = L.popup(this.getPopupOptions(feature))
                            .setLatLng(center)
                            .setContent(this.createPopupContent(data))
                            .openOn(this.map);
                        */
                        // Open popup at click location
                        const popup = L.popup({
                            maxWidth: 300,
                            offset: [0, -10],
                            autoPan: true,
                            closeButton: true,
                            autoClose: true,
                            closeOnClick: false
                        })
                        .setLatLng(e.latlng)
                        .setContent(this.createPopupContent(data))
                        .openOn(this.map);
                    });
                    
                    // Reset style when popup closes
                    layer.on('popupclose', () => {
                        if (layer === this.selectedLayer) {
                            layer.setStyle(originalStyle);
                            this.selectedLayer = null;
                        }
                    });
                }
            }).addTo(this.layerGroup);
            
            this.countryLayers.set(data.country, polygonLayer);
            layersAdded.push(polygonLayer);
        });
        
        console.log(`🔄 Map re-rendered with ${layersAdded.length} countries for metric: ${this.currentMetric}`);
    }

    // Updated calculateMaxValues method to also calculate minimums
    calculateMaxValues(impactData) {
        // Filter out zero/null values to get actual data range
        const biodivValues = impactData.map(d => d.biodiv || d.total_bd || 0).filter(v => v > 0);
        const gwpValues = impactData.map(d => d.gwp100 || d.co2e || 0).filter(v => v > 0);
        const waterValues = impactData.map(d => d.waterUse || d.water || 0).filter(v => v > 0);
        const landValues = impactData.map(d => d.landUse || d.land || 0).filter(v => v > 0);
        
        // Set max values
        this.maxBiodiversity = biodivValues.length > 0 ? Math.max(...biodivValues) : 1e-14;
        this.maxGWP = gwpValues.length > 0 ? Math.max(...gwpValues) : 1;
        this.maxWater = waterValues.length > 0 ? Math.max(...waterValues) : 1;
        this.maxLand = landValues.length > 0 ? Math.max(...landValues) : 1;
        
        // Set min values (excluding zeros)
        this.minBiodiversity = biodivValues.length > 0 ? Math.min(...biodivValues) : 0;
        this.minGWP = gwpValues.length > 0 ? Math.min(...gwpValues) : 0;
        this.minWater = waterValues.length > 0 ? Math.min(...waterValues) : 0;
        this.minLand = landValues.length > 0 ? Math.min(...landValues) : 0;
        
        console.log('📊 Value ranges:', {
            biodiv: `${this.minBiodiversity.toExponential(2)} - ${this.maxBiodiversity.toExponential(2)}`,
            gwp: `${this.minGWP.toFixed(2)} - ${this.maxGWP.toFixed(2)}`,
            water: `${this.minWater.toFixed(2)} - ${this.maxWater.toFixed(2)}`,
            land: `${this.minLand.toFixed(2)} - ${this.maxLand.toFixed(2)}`
        });
    }


    calculateTotals(impactData) {
        console.log('📊 Calculating totals from impact data:', impactData);
        
        if (!impactData || impactData.length === 0) {
            return { biodiv: 0, gwp100: 0, waterUse: 0, landUse: 0 };
        }
        
        const totals = impactData.reduce((acc, data) => {
            acc.biodiv += (data.biodiv || data.total_bd || 0);
            acc.gwp100 += (data.gwp100 || data.co2e || 0);
            acc.waterUse += (data.waterUse || data.water || 0);
            acc.landUse += (data.landUse || data.land || 0);
            return acc;
        }, { biodiv: 0, gwp100: 0, waterUse: 0, landUse: 0 });
        
//        console.log('✅ Calculated totals:', totals);
        return totals;
    }


    // Updated getCountryStyle method
    getCountryStyle(data) {
        // Get value and range based on current metric
        let value = 0;
        let minValue = 0;
        let maxValue = 1;
        
        switch(this.currentMetric) {
            case 'biodiv':
                value = data.biodiv || data.total_bd || 0;
                minValue = this.minBiodiversity;
                maxValue = this.maxBiodiversity;
                break;
            case 'gwp100':
                value = data.gwp100 || data.co2e || 0;
                minValue = this.minGWP;
                maxValue = this.maxGWP;
                break;
            case 'water':
                value = data.waterUse || data.water || 0;
                minValue = this.minWater;
                maxValue = this.maxWater;
                break;
            case 'land':
                value = data.landUse || data.land || 0;
                minValue = this.minLand;
                maxValue = this.maxLand;
                break;
        }
        
        // White for zero or missing values
        if (value === 0 || !value || isNaN(value)) {
            return {
                fillColor: '#ffffff',
                weight: 1,
                color: '#cccccc',
                fillOpacity: 0.7,
                className: 'country-fill'
            };
        }
        
        // Calculate normalized value using min-max scaling
        const range = maxValue - minValue;
        const normalized = range > 0 ? (value - minValue) / range : 0;
        
        // Color based on metric with more spread
        let hue, saturationMin, saturationMax;
        let lightnessStart = 85;
        let lightnessEnd = 30;
        switch(this.currentMetric) {
            case 'biodiv': 
                hue = 24; // Bright orange
                saturationMin = 45;
                saturationMax = 100;
                lightnessStart = 90;
                lightnessEnd = 38;
                break;
            case 'gwp100': 
                hue = 0; // Red
                saturationMin = 30;
                saturationMax = 90;
                break;
            case 'water': 
                hue = 200; // Blue
                saturationMin = 30;
                saturationMax = 90;
                break;
            case 'land': 
                hue = 80; // Olive
                saturationMin = 25;
                saturationMax = 75;
                lightnessStart = 88;
                lightnessEnd = 32;
                break;
            default: 
                hue = 120;
                saturationMin = 30;
                saturationMax = 90;
        }
        
        // More spread: light colors for low values, intense for high values
        const saturation = saturationMin + (normalized * (saturationMax - saturationMin));
        const lightness = lightnessStart - (normalized * (lightnessStart - lightnessEnd));
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        return {
            fillColor: color,
            weight: 1,
            color: '#666',
            fillOpacity: 0.85,
            className: 'country-fill'
        };
    }

    // Updated updateLegend method
    updateLegend() {
        if (this.legend) {
            this.map.removeControl(this.legend);
        }
        
        this.legend = L.control({ position: 'bottomright' });
        
        this.legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'info legend');
            
            div.style.backgroundColor = 'white';
            div.style.padding = '10px';
            div.style.borderRadius = '5px';
            div.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
            div.style.width = '180px';
            div.style.margin = '0';
            
            // Get title, min, max, and unit based on metric
            let title, minDisplay, maxDisplay, unit, minValue, maxValue;
            
            switch(this.currentMetric) {
                case 'biodiv':
                    title = 'Biodiversity Impact';
                    unit = 'PDF·yr';
                    minValue = this.minBiodiversity;
                    maxValue = this.maxBiodiversity;
                    minDisplay = minValue > 0 ? minValue.toExponential(2) : '0';
                    maxDisplay = maxValue.toExponential(2);
                    break;
                case 'gwp100':
                    title = 'Climate Change (GWP100)';
                    unit = 'kg CO2e';
                    minValue = this.minGWP;
                    maxValue = this.maxGWP;
                    minDisplay = minValue >= 1000 ? (minValue/1000).toFixed(2) + ' t' : minValue.toFixed(2);
                    maxDisplay = maxValue >= 1000 ? (maxValue/1000).toFixed(2) + ' t' : maxValue.toFixed(2);
                    break;
                case 'water':
                    title = 'Water Use';
                    unit = 'm³';
                    minValue = this.minWater;
                    maxValue = this.maxWater;
                    minDisplay = minValue.toFixed(2);
                    maxDisplay = maxValue.toFixed(2);
                    break;
                case 'land':
                    title = 'Land Use';
                    unit = 'm²';
                    minValue = this.minLand;
                    maxValue = this.maxLand;
                    minDisplay = minValue >= 10000 ? (minValue/10000).toFixed(2) + ' ha' : minValue.toFixed(2);
                    maxDisplay = maxValue >= 10000 ? (maxValue/10000).toFixed(2) + ' ha' : maxValue.toFixed(2);
                    break;
            }
            
            // Color gradient with more spread based on metric
            let hue, saturationMin, saturationMax;
            let lightnessStart = 85;
            let lightnessEnd = 30;
            switch(this.currentMetric) {
                case 'biodiv': 
                    hue = 24; 
                    saturationMin = 45;
                    saturationMax = 100;
                    lightnessStart = 90;
                    lightnessEnd = 38;
                    break;
                case 'gwp100': 
                    hue = 0; 
                    saturationMin = 30;
                    saturationMax = 90;
                    break;
                case 'water': 
                    hue = 200; 
                    saturationMin = 30;
                    saturationMax = 90;
                    break;
                case 'land': 
                    hue = 80; 
                    saturationMin = 25;
                    saturationMax = 75;
                    lightnessStart = 88;
                    lightnessEnd = 32;
                    break;
                default: 
                    hue = 120;
                    saturationMin = 30;
                    saturationMax = 90;
            }
            
            const gradientStops = [];
            for (let i = 0; i <= 10; i++) {
                const value = i / 10;
                const saturation = saturationMin + (value * (saturationMax - saturationMin));
                const lightness = lightnessStart - (value * (lightnessStart - lightnessEnd));
                gradientStops.push(`hsl(${hue}, ${saturation}%, ${lightness}%) ${value * 100}%`);
            }
            
            div.innerHTML = `
                <h4 style="margin: 0 0 10px 0; font-size: 14px; text-align: center;">${title}</h4>
                <div style="font-size: 11px; text-align: center; margin-bottom: 5px; color: #666;">${unit}</div>
                <div style="height: 20px; background: linear-gradient(to right, ${gradientStops.join(', ')}); margin-bottom: 5px; border: 1px solid #ddd;"></div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-size: 11px;">${minDisplay}</span>
                    <span style="font-size: 11px;">${maxDisplay}</span>
                </div>
                <p style="margin: 6px 0 0 0; font-size: 11px; color: #666; text-align: center;">Producing countries contributing to the selected metric.</p>
            `;
            return div;
        };
        
        this.legend.addTo(this.map);
    }

    addLegend() {
        this.legend = L.control({ position: 'bottomright' });
        
        this.legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `<h4>Loading...</h4>`;
            return div;
        };
        
        this.legend.addTo(this.map);
    }

    countryAliases = {
        "united states of america": "united states",
        "usa": "united states",
        "russian federation": "russian federation",
        "united kingdom": "united kingdom",
        "viet nam": "viet nam",
        "bolivia plurinational state of": "bolivia, plurinational state of",
        "venezuela bolivarian republic of": "venezuela, bolivarian republic of",
        "iran islamic republic of": "iran, islamic republic of",
        "china taiwan province of": "taiwan, province of china",
        "the former yugoslav republic of macedonia": "north macedonia",
        "congo": "congo",
        "democratic republic of the congo": "congo, the democratic republic of the",
        "united republic of tanzania": "tanzania, united republic of",
        "czech republic": "czechia",
        "lao peoples democratic republic": "lao people's democratic republic",
        "republic of moldova": "moldova, republic of",
        "republic of korea": "korea, republic of",
        "democratic peoples republic of korea": "korea, democratic people's republic of",
        "côte d'ivoire": "côte d'ivoire",
        "swaziland": "eswatini",
        "timorleste": "timor-leste",
        "guineabissau": "guinea-bissau",
        "china mainland": "china",
        "kiribati": "kiribati",
        "maldives": "maldives",
        "grenada": "grenada",
        "row": "",
        "china hong kong sar": "",
        "china macao sar": "",
        "belgiumluxembourg": "",
        "czechoslovakia": "",
        "ussr": "",
        "serbia and montenegro": "",
        "yugoslav sfr": ""
    };

    normalizeCountryName(name) {
        // First check aliases before normalization (to catch special characters)
        const lowercaseName = name.toLowerCase().trim();
        if (this.countryAliases[lowercaseName]) {
            return this.countryAliases[lowercaseName];
        }
        
        // Then normalize by removing special characters
        let normalized = lowercaseName
            .replace(/[^a-z\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Check aliases again after normalization
        if (this.countryAliases[normalized]) {
            return this.countryAliases[normalized];
        }
        
        return normalized;
    }



    createPopupContent(data) {
        const biodiv = data.biodiv || data.total_bd || 0;
        const co2 = data.gwp100 || data.co2e || 0;
        const water = data.waterUse || data.water || 0;
        const land = data.landUse || data.land || 0;
        
        // Use exponential notation for very small values
        const bdDisplay = biodiv < 0.001 ? `${biodiv.toExponential(2)} PDF·yr` : `${biodiv.toFixed(4)} PDF·yr`;
        const co2Display = co2 < 0.01
            ? `${co2.toExponential(2)} kg CO2e`
            : (co2 >= 1000 ? `${(co2 / 1000).toFixed(2)} t CO2e` : `${co2.toFixed(2)} kg CO2e`);
        const waterDisplay = water < 0.01
            ? `${water.toExponential(2)} m<sup>3</sup>`
            : `${water >= 1000 ? water.toFixed(0) : water.toFixed(2)} m<sup>3</sup>`;
        const landDisplay = land < 0.01
            ? `${land.toExponential(2)} m<sup>2</sup>`
            : (land >= 10000 ? `${(land / 10000).toFixed(2)} ha` : `${land.toFixed(2)} m<sup>2</sup>`);

        
        return `
            <div class="impact-popup">
                <h4>${data.country}</h4>
                <p><strong>Biodiversity:</strong> ${bdDisplay}</p>
                <p><strong>Climate change (GWP100):</strong> ${co2Display}</p>
                <p><strong>Water:</strong> ${waterDisplay}</p>
                <p><strong>Land:</strong> ${landDisplay}</p>
                <p><em>These values reflect production-linked contributions from this country.</em></p>
            </div>
        `;
    }

    getImpactData() {
        return [];
    }

    getMetricExportMeta(metric) {
        switch (metric) {
            case 'biodiv':
                return { title: 'Biodiversity', unit: 'PDF·yr', minValue: this.minBiodiversity, maxValue: this.maxBiodiversity };
            case 'gwp100':
                return { title: 'Climate Change (GWP100)', unit: 'kg CO2e', minValue: this.minGWP, maxValue: this.maxGWP };
            case 'water':
                return { title: 'Water Use', unit: 'm³', minValue: this.minWater, maxValue: this.maxWater };
            case 'land':
                return { title: 'Land Use', unit: 'm²', minValue: this.minLand, maxValue: this.maxLand };
            default:
                return { title: metric, unit: '', minValue: 0, maxValue: 0 };
        }
    }

    getMetricColorSettings(metric) {
        switch(metric) {
            case 'biodiv':
                return { hue: 24, saturationMin: 45, saturationMax: 100, lightnessStart: 90, lightnessEnd: 38 };
            case 'gwp100':
                return { hue: 0, saturationMin: 30, saturationMax: 90, lightnessStart: 85, lightnessEnd: 30 };
            case 'water':
                return { hue: 200, saturationMin: 30, saturationMax: 90, lightnessStart: 85, lightnessEnd: 30 };
            case 'land':
                return { hue: 80, saturationMin: 25, saturationMax: 75, lightnessStart: 88, lightnessEnd: 32 };
            default:
                return { hue: 120, saturationMin: 30, saturationMax: 90, lightnessStart: 85, lightnessEnd: 30 };
        }
    }

    formatLegendValue(metric, value) {
        if (!value || Number.isNaN(value)) return '0';
        if (metric === 'biodiv') {
            return value < 0.001 ? value.toExponential(2) : value.toFixed(4);
        }
        if (metric === 'gwp100') {
            return value >= 1000 ? `${(value / 1000).toFixed(2)} t` : value.toFixed(2);
        }
        if (metric === 'water') {
            return value >= 1000 ? value.toFixed(0) : value.toFixed(2);
        }
        if (metric === 'land') {
            return value >= 10000 ? `${(value / 10000).toFixed(2)} ha` : value.toFixed(2);
        }
        return String(value);
    }

    waitForNextFrame() {
        return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    projectRobinson(lon, lat) {
        const xTable = [
            1.0000, 0.9986, 0.9954, 0.9900, 0.9822, 0.9730, 0.9600, 0.9427, 0.9216,
            0.8962, 0.8679, 0.8350, 0.7986, 0.7597, 0.7186, 0.6732, 0.6213, 0.5722, 0.5322
        ];
        const yTable = [
            0.0000, 0.0620, 0.1240, 0.1860, 0.2480, 0.3100, 0.3720, 0.4340, 0.4958,
            0.5571, 0.6176, 0.6769, 0.7346, 0.7903, 0.8435, 0.8936, 0.9394, 0.9761, 1.0000
        ];

        const absLat = Math.min(Math.abs(lat), 90);
        const index = Math.min(Math.floor(absLat / 5), 17);
        const fraction = (absLat - (index * 5)) / 5;
        const xCoeff = xTable[index] + ((xTable[index + 1] - xTable[index]) * fraction);
        const yCoeff = yTable[index] + ((yTable[index + 1] - yTable[index]) * fraction);
        const lambda = lon * Math.PI / 180;

        const x = 0.8487 * xCoeff * lambda;
        const y = 1.3523 * (lat < 0 ? -yCoeff : yCoeff);
        return { x, y };
    }

    buildExportPath(rings, scale, minX, minY, padding, height) {
        return rings.map(ring => {
            return ring.map((coord, index) => {
                const projected = this.projectEqualEarth(coord[0], coord[1]);
                const x = ((projected.x - minX) * scale) + padding;
                const y = height - (((projected.y - minY) * scale) + padding);
                return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
            }).join(' ') + ' Z';
        }).join(' ');
    }

    getFeatureRings(geometry) {
        if (!geometry) return [];
        if (geometry.type === 'Polygon') {
            return [geometry.coordinates];
        }
        if (geometry.type === 'MultiPolygon') {
            return geometry.coordinates;
        }
        return [];
    }

    getExportMetricValue(data, metric) {
        switch (metric) {
            case 'biodiv':
                return data?.biodiv || data?.total_bd || 0;
            case 'gwp100':
                return data?.gwp100 || data?.co2e || 0;
            case 'water':
                return data?.waterUse || data?.water || 0;
            case 'land':
                return data?.landUse || data?.land || 0;
            default:
                return 0;
        }
    }

    buildMetricSvgExport(metric) {
        if (!this.geoJsonData || !this.cachedImpactData) {
            return null;
        }

        const width = 1280;
        const height = 760;
        const topHeader = 74;
        const padding = 24;
        const legendWidth = 220;
        const mapWidth = width - legendWidth - padding * 3;
        const mapHeight = height - topHeader - padding * 2;
        const { title, unit, minValue, maxValue } = this.getMetricExportMeta(metric);
        const colorSettings = this.getMetricColorSettings(metric);
        const impactLookup = new Map();

        this.cachedImpactData.forEach(entry => {
            impactLookup.set(this.normalizeCountryName(entry.country), entry);
        });

        const projectedPoints = [];
        this.geoJsonData.features.forEach(feature => {
            const polygons = this.getFeatureRings(feature.geometry);
            polygons.forEach(polygon => {
                polygon.forEach(ring => {
                    ring.forEach(coord => {
                        projectedPoints.push(this.projectRobinson(coord[0], coord[1]));
                    });
                });
            });
        });

        if (projectedPoints.length === 0) {
            return null;
        }

        const minX = Math.min(...projectedPoints.map(point => point.x));
        const maxX = Math.max(...projectedPoints.map(point => point.x));
        const minY = Math.min(...projectedPoints.map(point => point.y));
        const maxY = Math.max(...projectedPoints.map(point => point.y));
        const scale = Math.min(
            mapWidth / (maxX - minX),
            mapHeight / (maxY - minY)
        );
        const projectedWidth = (maxX - minX) * scale;
        const projectedHeight = (maxY - minY) * scale;
        const offsetX = padding + (mapWidth - projectedWidth) / 2;
        const offsetY = topHeader + padding + (mapHeight - projectedHeight) / 2;

        const paths = this.geoJsonData.features.map(feature => {
            const countryName = feature.properties?.countryName || '';
            const data = impactLookup.get(this.normalizeCountryName(countryName));
            const polygons = this.getFeatureRings(feature.geometry);
            const pathData = polygons.map(polygon => {
                return polygon.map(ring => {
                    return ring.map((coord, index) => {
                        const projected = this.projectRobinson(coord[0], coord[1]);
                        const x = ((projected.x - minX) * scale) + offsetX;
                        const y = (((maxY - projected.y) * scale) + offsetY);
                        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
                    }).join(' ') + ' Z';
                }).join(' ');
            }).join(' ');
            const style = this.getCountryStyle(data || {});
            const value = this.getExportMetricValue(data || {}, metric);

            return `<path d="${pathData}" fill="${style.fillColor}" stroke="#777777" stroke-width="0.6">
  <title>${countryName}${value > 0 ? `: ${value}` : ''}</title>
</path>`;
        }).join('\n');

        const gradientStops = [];
        for (let i = 0; i <= 10; i++) {
            const value = i / 10;
            const saturation = colorSettings.saturationMin + (value * (colorSettings.saturationMax - colorSettings.saturationMin));
            const lightness = colorSettings.lightnessStart - (value * (colorSettings.lightnessStart - colorSettings.lightnessEnd));
            gradientStops.push(`hsl(${colorSettings.hue}, ${saturation}%, ${lightness}%) ${value * 100}%`);
        }

        const legendX = width - legendWidth - padding;
        const legendY = topHeader + 24;
        const legendBarY = legendY + 52;
        const legendBarWidth = 28;
        const legendBarHeight = 220;

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="legend-${metric}" x1="0%" y1="100%" x2="0%" y2="0%">
      ${gradientStops.map((stop, index) => `<stop offset="${index * 10}%" stop-color="${stop.match(/hsl\([^)]+\)/)[0]}"/>`).join('')}
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>
  <text x="${width / 2}" y="30" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#5b2208">${title}</text>
  <text x="${width / 2}" y="50" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#666666">Robinson projection. Producing countries contributing to the selected metric (${unit})</text>
  <rect x="${padding}" y="${topHeader}" width="${mapWidth}" height="${mapHeight}" rx="10" fill="#f7f7f7" stroke="#dddddd"/>
  ${paths}
  <g transform="translate(${legendX}, ${legendY})">
    <text x="0" y="0" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#333333">Legend</text>
    <text x="0" y="20" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#666666">${unit}</text>
    <rect x="0" y="52" width="${legendBarWidth}" height="${legendBarHeight}" fill="url(#legend-${metric})" stroke="#cccccc" rx="6"/>
    <text x="${legendBarWidth + 12}" y="62" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#333333">${this.formatLegendValue(metric, maxValue)}</text>
    <text x="${legendBarWidth + 12}" y="${52 + legendBarHeight / 2 + 4}" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#333333">${this.formatLegendValue(metric, (minValue + maxValue) / 2)}</text>
    <text x="${legendBarWidth + 12}" y="${52 + legendBarHeight}" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#333333">${this.formatLegendValue(metric, minValue)}</text>
    <text x="0" y="${52 + legendBarHeight + 28}" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#666666">Only countries with mapped production</text>
    <text x="0" y="${52 + legendBarHeight + 44}" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#666666">contributions are colored.</text>
  </g>
</svg>`;
    }

    async exportMetricMaps() {
        if (!this.cachedImpactData || !this.map) {
            return [];
        }

        const originalMetric = this.currentMetric;
        const metrics = ['biodiv', 'gwp100', 'water', 'land'];
        const files = [];

        for (const metric of metrics) {
            this.setMetric(metric);
            await this.waitForNextFrame();
            const svgContent = this.buildMetricSvgExport(metric);
            if (svgContent) {
                files.push({
                    name: `${metric}_map.svg`,
                    content: svgContent
                });
            }
        }

        this.setMetric(originalMetric);
        await this.waitForNextFrame();

        return files;
    }
}
