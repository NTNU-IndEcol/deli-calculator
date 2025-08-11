// map-view.js
import { DataManager } from './data-manager.js';

export class MapView {
    constructor(mapContainerId) {
        this.mapContainerId = mapContainerId;
        this.map = null;
        this.layerGroup = null;
        this.countryLayers = new Map(); // Store country polygon layers
        this.tileLayer = null;
        this.geoJsonData = null; // Store GeoJSON data
        this.maxTotalImpact = 1; // Initialize with 1 to prevent division by zero

        // Bind event handlers to ensure proper 'this' context
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
        
        // Clean up any existing map instance
        if (container._leaflet_id) {
            container._leaflet_id = null;
            container.innerHTML = '';
        }
        
        // Apply custom map container styling
        container.style.backgroundColor = '#a4d4f5'; // Light blue for oceans

        // Initialize new map with proper constraints
        this.map = L.map(this.mapContainerId, {
            minZoom: 2,
            maxZoom: 8,
            maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
            maxBoundsViscosity: 1.0,
            worldCopyJump: true
        }).setView([20, 0], 2);
        /*
        // Add clean basemap - CartoDB Positron (light, minimal style)
        this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
            //attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            detectRetina: true,
            updateWhenIdle: false,
            reuseTiles: true,
            unloadInvisibleTiles: true
        }).addTo(this.map);
        
        */

        // Create custom basemap with light blue oceans and grey land
        this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            detectRetina: true,
            updateWhenIdle: false,
            reuseTiles: true,
            unloadInvisibleTiles: true
        }).addTo(this.map);
        
        // Apply custom tile styling
        setTimeout(() => {
            const tiles = document.querySelectorAll('.leaflet-tile');
            tiles.forEach(tile => {
                tile.style.filter = 'grayscale(100%) brightness(1.1)';
            });
        }, 500);

        // Initialize layer group
        this.layerGroup = L.layerGroup().addTo(this.map);
        this.addLegend();
        
        // Load GeoJSON data
        try {
            this.geoJsonData = await DataManager.loadGeoJsonData();
            console.log('GeoJSON data loaded successfully', this.geoJsonData);
        } catch (error) {
            console.error('Failed to load GeoJSON data:', error);
        }
        
        // Add event listeners
        this.map.on('moveend', this.handleMapMove);
        this.map.on('zoomend', this.handleMapZoom);
        window.addEventListener('resize', this.handleResize);
        
        console.log("Map initialized successfully");
    }

    // Define the event handler methods
    handleMapMove() {
        // Can be implemented later if needed
        console.log('Map moved');
    }

    handleMapZoom() {
        // Can be implemented later if needed
        console.log('Map zoomed');
    }

    handleResize() {
        // Handle window resize
        this.map.invalidateSize();
        console.log('Window resized, map updated');
    }


    async updateMap(impactData) {
        console.log("Updating map with impact data:", impactData);
        
        // Clear previous data
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
        // Create country lookup map
        const countryLookup = new Map();
        this.geoJsonData.features.forEach(feature => {
            const countryName = feature.properties.countryName;
            if (countryName) {
                // Normalize country name for matching
                const normalized = countryName.toLowerCase().trim();
                countryLookup.set(normalized, feature);
            }
        });
        
         // Calculate max impact for normalization
        this.maxTotalImpact = Math.max(
            1, // Ensure we don't divide by zero
            ...impactData.map(data => data.co2e + data.water + data.land)
        );

        // Process impact data and add to map
        const layersAdded = [];
        impactData.forEach(data => {
            const normalizedCountry = data.country.toLowerCase().trim();
            const geoJsonFeature = countryLookup.get(normalizedCountry);
            
            if (!geoJsonFeature) {
                console.warn(`GeoJSON feature not found for: ${data.country}`);
                return;
            }
            
            // Create polygon layer with clean styling
            const polygonLayer = L.geoJSON(geoJsonFeature, {
                style: this.getCountryStyle(data),
                onEachFeature: (feature, layer) => {
                    // Add country name label
                    const countryName = feature.properties.countryName;
                    layer.bindTooltip(countryName, {
                        permanent: true,
                        direction: 'center',
                        className: 'country-label',
                        offset: [0, 0] // Center the label
                    });
                    
                    // Add popup with impact data
                    layer.bindPopup(this.createPopupContent(data));
                }
            }).addTo(this.layerGroup);
            
            // Store reference for later use
            this.countryLayers.set(data.country, polygonLayer);
            layersAdded.push(polygonLayer);
        });
        
        // Fit map to the layer group bounds
        if (layersAdded.length > 0) {
            const group = new L.featureGroup(layersAdded);
            this.map.fitBounds(group.getBounds(), {
                padding: [50, 50],
                maxZoom: 5
            });
        }
        
        console.log(`${layersAdded.length} countries added to map`);
    }

    getCountryStyle(data) {
        // Determine color based on dominant impact type
        let color = '#2ecc71'; // Default to land color
        
        if (data.co2e > data.water && data.co2e > data.land) {
            color = '#e74c3c'; // CO2 dominant - red
        } else if (data.water > data.co2e && data.water > data.land) {
            color = '#3498db'; // Water dominant - blue
        }
        
        // Calculate opacity based on total impact
        const totalImpact = data.co2e + data.water + data.land;
        const opacity = Math.min(0.8, 0.3 + (totalImpact / this.maxTotalImpact) * 0.5);
        
        // Clean border-only style
        return {
            fillColor: color,
            weight: 2, // Thicker borders
            opacity: 0.9,
            color: '#333', // Dark border color
            fillOpacity: opacity,
            className: 'country-border' // Add class for custom styling
        };
    }

    createPopupContent(data) {
        return `
            <div class="impact-popup">
                <h4>${data.country}</h4>
                <p>CO₂eq: ${data.co2e.toFixed(2)} kg</p>
                <p>Water: ${data.water.toFixed(2)} L</p>
                <p>Land: ${data.land.toFixed(2)} m²</p>
            </div>
        `;
    }

    addLegend() {
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `
                <h4>Environmental Impact</h4>
                <div class="legend-item">
                    <i class="box" style="background:#e74c3c"></i> CO₂e Emissions
                </div>
                <div class="legend-item">
                    <i class="box" style="background:#3498db"></i> Water Usage
                </div>
                <div class="legend-item">
                    <i class="box" style="background:#2ecc71"></i> Land Use
                </div>
                <p>Darker = Higher Impact</p>
            `;
            return div;
        };
    //    legend.addTo(this.map);
    }

    // Helper to get impact data (if needed)
    getImpactData() {
        // Implement based on your application
        return [];
    }
}