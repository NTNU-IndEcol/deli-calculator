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
        const northBound = 73.5;
        
        this.map = L.map(this.mapContainerId, {
            minZoom: 1.5,
            maxZoom: 6,
            maxBounds: L.latLngBounds(L.latLng(southBound, -180), L.latLng(northBound, 180)),
            maxBoundsViscosity: 1.0,
            worldCopyJump: true,
            zoomControl: false,
            attributionControl: false
        }).setView([20, 0], 2);
    
        this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
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
        window.addEventListener('resize', this.handleResize);
        
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
                    layer.bindPopup(this.createPopupContent(data));
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
                    layer.bindPopup(this.createPopupContent(data));
                }
            }).addTo(this.layerGroup);
            
            this.countryLayers.set(data.country, polygonLayer);
            layersAdded.push(polygonLayer);
        });
        
        console.log(`🔄 Map re-rendered with ${layersAdded.length} countries for metric: ${this.currentMetric}`);
    }

    // Calculate max values for normalization
    calculateMaxValues(impactData) {
        this.maxTotalImpact = Math.max(
            1,
            ...impactData.map(data => (data.gwp100 || data.co2e || 0) + (data.waterUse || data.water || 0) + (data.landUse || data.land || 0))
        );
        
        this.maxBiodiversity = Math.max(1e-14, ...impactData.map(d => d.biodiv || d.total_bd || 0));
        this.maxGWP = Math.max(1, ...impactData.map(d => d.gwp100 || d.co2e || 0));
        this.maxWater = Math.max(1, ...impactData.map(d => d.waterUse || d.water || 0));
        this.maxLand = Math.max(1, ...impactData.map(d => d.landUse || d.land || 0));
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
        
        console.log('✅ Calculated totals:', totals);
        return totals;
    }

    getCountryStyle(data) {
        // Get value based on current metric
        let value = 0;
        let maxValue = 1;
        
        switch(this.currentMetric) {
            case 'biodiv':
                value = data.biodiv || data.total_bd || 0;
                maxValue = this.maxBiodiversity;
                break;
            case 'gwp100':
                value = data.gwp100 || data.co2e || 0;
                maxValue = this.maxGWP;
                break;
            case 'water':
                value = data.waterUse || data.water || 0;
                maxValue = this.maxWater;
                break;
            case 'land':
                value = data.landUse || data.land || 0;
                maxValue = this.maxLand;
                break;
        }
        
        // White for zero values
        if (value === 0) {
            return {
                fillColor: '#ffffff',
                weight: 1,
                color: '#cccccc',
                fillOpacity: 0.7,
                className: 'country-fill'
            };
        }
        
        // Calculate normalized value
        const normalized = value / maxValue;
        
        // Color based on metric
        let hue;
        switch(this.currentMetric) {
            case 'biodiv': hue = 120; break; // Green
            case 'gwp100': hue = 80; break;   // Red
            case 'water': hue = 200; break;  // Blue
            case 'land': hue = 30; break;    // Orange
            default: hue = 120;
        }
        
        const saturation = 80;
        const lightness = 70 - (normalized * 40);
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        return {
            fillColor: color,
            weight: 1,
            color: '#666',
            fillOpacity: 0.8,
            className: 'country-fill'
        };
    }

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
            
            // Get title and max value based on metric
            let title, maxDisplay, unit, maxValue;
            
            switch(this.currentMetric) {
                case 'biodiv':
                    title = 'Biodiversity Impact';
                    unit = 'PDF·yr';
                    maxValue = this.maxBiodiversity;
                    maxDisplay = maxValue < 0.001 ? maxValue.toExponential(2) : maxValue.toFixed(4);
                    break;
                case 'gwp100':
                    title = 'GWP100';
                    unit = 'CO₂eq';
                    maxValue = this.maxGWP;
                    maxDisplay = maxValue >= 1000 ? (maxValue/1000).toFixed(2) + ' t' : maxValue.toFixed(2);
                    break;
                case 'water':
                    title = 'Water Use';
                    unit = 'm³';
                    maxValue = this.maxWater;
                    maxDisplay = maxValue.toFixed(2);
                    break;
                case 'land':
                    title = 'Land Use';
                    unit = 'm²';
                    maxValue = this.maxLand;
                    maxDisplay = maxValue >= 10000 ? (maxValue/10000).toFixed(2) + ' ha' : maxValue.toFixed(2);
                    break;
            }
            
            // Color gradient based on metric
            let hue;
            switch(this.currentMetric) {
                case 'biodiv': hue = 120; break;
                case 'gwp100': hue = 80; break;
                case 'water': hue = 200; break;
                case 'land': hue = 30; break;
                default: hue = 120;
            }
            
            const gradientStops = [];
            for (let i = 0; i <= 10; i++) {
                const value = i / 10;
                const lightness = 70 - (value * 40);
                gradientStops.push(`hsl(${hue}, 80%, ${lightness}%) ${value * 100}%`);
            }
            
            div.innerHTML = `
                <h4 style="margin: 0 0 10px 0; font-size: 14px; text-align: center;">${title}</h4>
                <div style="font-size: 11px; text-align: center; margin-bottom: 5px; color: #666;">${unit}</div>
                <div style="height: 20px; background: linear-gradient(to right, ${gradientStops.join(', ')}); margin-bottom: 5px;"></div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-size: 11px;">0</span>
                    <span style="font-size: 11px;">${maxDisplay}</span>
                </div>
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
        "cote divoire": "côte d'ivoire",
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
        let normalized = name.toLowerCase()
            .replace(/[^a-z\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

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
        
        let bdDisplay = biodiv < 0.001 ? biodiv.toExponential(2) : biodiv.toFixed(4);
        let co2Display = co2 >= 1000 ? (co2 / 1000).toFixed(2) + ' t' : co2.toFixed(2);
        let waterDisplay = water >= 1000 ? water.toFixed(0) : water.toFixed(2);
        let landDisplay = land >= 10000 ? (land / 10000).toFixed(2) + ' ha' : land.toFixed(2);
        
        return `
            <div class="impact-popup">
                <h4>${data.country}</h4>
                <p><strong>Biodiversity:</strong> ${bdDisplay} PDF·yr</p>
                <p><strong>GWP100:</strong> ${co2Display} CO₂eq</p>
                <p><strong>Water:</strong> ${waterDisplay} m³</p>
                <p><strong>Land:</strong> ${landDisplay}</p>
            </div>
        `;
    }

    getImpactData() {
        return [];
    }
}