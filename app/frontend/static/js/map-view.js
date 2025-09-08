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

        // Adjust the map bounds to exclude extreme polar regions
        const southBound = -56;  // Limit southern extent
        const northBound = 73.5;   // Limit northern extent
        
        // Initialize new map with proper constraints
        this.map = L.map(this.mapContainerId, {
            minZoom: 1.5,
            maxZoom: 6,
            maxBounds: L.latLngBounds(L.latLng(southBound, -180), L.latLng(northBound, 180)),
            maxBoundsViscosity: 1.0,
            worldCopyJump: true,
            zoomControl: false, // Remove default zoom controls
            attributionControl: false // Remove attribution
        }).setView([20, 0], 2);
    /*
        L.rectangle([[-90, -180], [90, 180]], {
    //        color: '#87CEFA', // outline (not visible if fill covers it)
            weight: 0,
            fillColor: '#87CEFA', // ocean blue
            fillOpacity: 1
        }).addTo(this.map); 
    */  
        // Create custom basemap with blue oceans and grey land
       this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
            detectRetina: true,
            updateWhenIdle: false,
            reuseTiles: true,
            unloadInvisibleTiles: true
        }).addTo(this.map);



/*
        // Apply custom styling to show only country borders
        setTimeout(() => {
            const tiles = document.querySelectorAll('.leaflet-tile');
            tiles.forEach(tile => {
                // Convert to show only borders with grey land
                tile.style.filter = 'invert(100%) brightness(1.8) contrast(0.4) saturate(0)';
            });
        }, 500);
        
*/
        // Initialize layer group
        this.layerGroup = L.layerGroup().addTo(this.map);
        //this.addLegend();
        
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
       // console.log('Map moved');
    }

    handleMapZoom() {
        // Can be implemented later if needed
      //  console.log('Map zoomed');
    }

    handleResize() {
        // Handle window resize
        this.map.invalidateSize();
       // console.log('Window resized, map updated');
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
            //const normalizedCountry = data.country.toLowerCase().trim();
            const normalizedCountry = this.normalizeCountryName(data.country);

            //const geoJsonFeature = countryLookup.get(normalizedCountry);
                // Try to find a match
            let geoJsonFeature = countryLookup.get(normalizedCountry);
            
            // If not found, try common variations
            if (!geoJsonFeature) {
                if (normalizedCountry.includes("china")) {
                    geoJsonFeature = countryLookup.get("china");
                }
                // Add other special cases here as needed
            }
            
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
                /* 
                    layer.bindTooltip(countryName, {
                        permanent: true,
                        direction: 'center',
                        className: 'country-label',
                        offset: [0, 0] // Center the label
                    });
                  */  
                    // Add popup with impact data
                    layer.bindPopup(this.createPopupContent(data));
                }
            }).addTo(this.layerGroup);
            
            // Store reference for later use
            this.countryLayers.set(data.country, polygonLayer);
            layersAdded.push(polygonLayer);
        });
        
        // Fit map to the layer group bounds with padding
        if (layersAdded.length > 0) {
            const group = new L.featureGroup(layersAdded);
            
            // Constrain bounds to our map limits
            const constrainedBounds = group.getBounds().pad(0.1);
            constrainedBounds.getSouthWest().lat = Math.max(constrainedBounds.getSouthWest().lat, -60);
            constrainedBounds.getNorthEast().lat = Math.min(constrainedBounds.getNorthEast().lat, 85);
            
            this.map.fitBounds(constrainedBounds, {
                padding: [50, 50],
                maxZoom: 5
            });
        }
        
        /*
        // Fit map to the layer group bounds
        if (layersAdded.length > 0) {
            const group = new L.featureGroup(layersAdded);
            this.map.fitBounds(group.getBounds(), {
                padding: [50, 50],
                maxZoom: 5
            });
        }
        */

        console.log(`${layersAdded.length} countries added to map`);
    }

    getCountryStyle(data) {
        // Determine color based on dominant impact type
        let color = '#2ecc71'; // Default to land color
        
        if (data.co2e > data.water && data.co2e > data.land) {
            color = '#0026ff'; // CO2 dominant - red
        } else if (data.water > data.co2e && data.water > data.land) {
            color = '#00ff62'; // Water dominant - blue
        }
        
        // Calculate opacity based on total impact
        const totalImpact = data.co2e + data.water + data.land;
        const opacity = Math.min(0.8, 0.3 + (totalImpact / this.maxTotalImpact) * 0.5);
        
        // Clean border-only style
        return {
            fillColor: color,
            weight: 1, // No borders
            fillOpacity: opacity,
            className: 'country-fill'
        };
    }

    // Add a country aliases mapping to the MapView class
    countryAliases = {
        "united states of america": "united states",
        "usa": "united states",
        "us": "united states",
        "america": "united states",
        "russia": "russian federation",
        "uk": "united kingdom",
        "great britain": "united kingdom",
        "england": "united kingdom",
        "vietnam": "viet nam",
        "bolivia": "bolivia (plurinational state of)",
        "venezuela": "venezuela (bolivarian republic of)",
        "iran": "iran (islamic republic of)",
        "taiwan": "taiwan, province of china",
        "macedonia": "north macedonia",
        "congo": "congo (the democratic republic of the)",
        "republic of congo": "congo"
    };

    // Add this helper method to the MapView class
    normalizeCountryName(name) {
        let normalized = name.toLowerCase()
            .replace(/[^a-z\s]/g, '')  // Remove special characters
            .replace(/\s+/g, ' ')       // Collapse multiple spaces
            .trim();

                // Apply aliases
        if (this.countryAliases[normalized]) {
            return this.countryAliases[normalized];
        }
        
        return normalized;
    }


    createPopupContent(data) {
        return `
            <div class="impact-popup">
                <h4>${data.country}</h4>
                <p>CO₂eq: ${data.co2e.toFixed(2)} kg</p>
                <p>Water: ${data.water.toFixed(2)} m3</p>
                <p>Land: ${data.land.toFixed(2)} hectare</p>
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