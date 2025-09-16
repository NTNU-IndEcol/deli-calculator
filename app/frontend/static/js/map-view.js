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
        this.maxBiodiversity = 1; // Initialize with 1 for biodiversity normalization

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
        
        // Calculate max biodiversity for normalization
        this.maxBiodiversity = Math.max(
            1e-14, // Set a minimum threshold to handle very small values
            ...impactData.map(data => data.total_bd)
        );

        // Update the legend with the new max value
        this.updateLegend();

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
        // Handle zero or very small biodiversity values
        if (data.total_bd <= 0) {
            return {
                fillColor: '#f0f0f0', // Light gray for no impact
                weight: 1,
                fillOpacity: 0.5,
                className: 'country-fill'
            };
        }
        
        // Use a consistent scale for both countries and legend
        // Calculate normalized value (0 to 1) based on biodiversity impact
        const normalizedBd = data.total_bd / this.maxBiodiversity;
        
        // Calculate color based on normalized biodiversity value
        // Use HSL color model for consistent gradient
        const hue = 120; // Green hue
        const saturation = 80; // 80% saturation
        const lightness = 70 - (normalizedBd * 40); // 70% to 30% lightness
        
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        // Calculate opacity based on total impact
        const totalImpact = data.co2e + data.water + data.land;
        const opacity = Math.min(0.8, 0.3 + (totalImpact / this.maxTotalImpact) * 0.5);
        
        return {
            fillColor: color,
            weight: 1,
            fillOpacity: opacity,
            className: 'country-fill'
        };
    }

    updateLegend() {
        // Remove existing legend if it exists
        if (this.legend) {
            this.map.removeControl(this.legend);
        }
        
        this.legend = L.control({ position: 'bottomright' });
        
        this.legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'info legend');
            
            // Add CSS styles
            div.style.backgroundColor = 'white';
            div.style.padding = '10px';
            div.style.borderRadius = '5px';
            div.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
            div.style.width = '180px';
            div.style.margin = '0'; // Remove any margin
            
            // Format the biodiversity values for display
            let maxBdDisplay;
            if (this.maxBiodiversity < 0.001) {
                maxBdDisplay = this.maxBiodiversity.toExponential(2);
            } else {
                maxBdDisplay = this.maxBiodiversity.toFixed(4);
            }
            
            // Create gradient stops for the legend
            const gradientStops = [];
            for (let i = 0; i <= 10; i++) {
                const value = i / 10;
                const lightness = 70 - (value * 40);
                gradientStops.push(`hsl(120, 80%, ${lightness}%) ${value * 100}%`);
            }
            
            div.innerHTML = `
                <h4 style="margin: 0 0 10px 0; font-size: 14px; text-align: center;">Biodiversity Impact (PDF)</h4>
                <div style="height: 20px; background: linear-gradient(to right, ${gradientStops.join(', ')}); margin-bottom: 5px;"></div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-size: 11px;">0</span>
                    <span style="font-size: 11px;">${maxBdDisplay}</span>
                </div>
            `;
            return div;
        };
        
        // Add the legend to the map with no margin
        this.legend.addTo(this.map);
        
        // Position the legend at the bottom right with no gap
        const legendContainer = this.legend.getContainer();
        legendContainer.style.position = 'absolute';
        legendContainer.style.bottom = '10px';
        legendContainer.style.right = '10px';
        legendContainer.style.margin = '0';
    }

    // Replace the addLegend method with this simpler version
    addLegend() {
        // Just create a placeholder legend, will be updated when data is loaded
        this.legend = L.control({ position: 'bottomright' });
        
        this.legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `<h4>Biodiversity Impact</h4><p>Loading data...</p>`;
            return div;
        };
        
        this.legend.addTo(this.map);
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
        // Format biodiversity with scientific notation for very small values
        let bdDisplay;
        if (data.total_bd < 0.001) {
            bdDisplay = data.total_bd.toExponential(2);
        } else {
            bdDisplay = data.total_bd.toFixed(4);
        }
        
        return `
            <div class="impact-popup">
                <h4>${data.country}</h4>
                <p>Biodiversity: ${bdDisplay} PDF</p>
                <p>CO₂eq: ${data.co2e.toFixed(2)} kg</p>
                <p>Water: ${data.water.toFixed(2)} m3</p>
                <p>Land: ${data.land.toFixed(2)} m2</p>
            </div>
        `;
    }

    // Helper to get impact data (if needed)
    getImpactData() {
        // Implement based on your application
        return [];
    }
}