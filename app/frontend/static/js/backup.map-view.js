// map-view.js
import { DataManager } from './data-manager.js';

export class MapView {
    constructor(mapContainerId) {
        this.mapContainerId = mapContainerId;
        this.map = null;
        this.layerGroup = null;
        this.countryMarkers = new Map();
        this.tileLayer = null;
        this.initMap();
    }


    initMap() {
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
        
        // Initialize new map with proper constraints
        this.map = L.map(this.mapContainerId, {
            minZoom: 2,
            maxZoom: 8,
            maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
            maxBoundsViscosity: 1.0,
            worldCopyJump: true
        }).setView([20, 0], 2);
        
        // Add tile layer with refreshWhenIdle option
        this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            detectRetina: true,
            updateWhenIdle: false, // Important for smooth zooming
            reuseTiles: true,
            unloadInvisibleTiles: true
        }).addTo(this.map);
        
        // Initialize layer group
        this.layerGroup = L.layerGroup().addTo(this.map);
        this.addLegend();
        
        // Add event listeners for zoom/pan
        this.map.on('moveend', this.handleMapMove.bind(this));
        this.map.on('zoomend', this.handleMapZoom.bind(this));
        
        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));
        
        console.log("Map initialized successfully");
    }


    handleMapMove() {
        // Force tile reload on pan
        this.tileLayer._resetView();
    }

    handleMapZoom() {
        // Invalidate size to ensure proper rendering
        setTimeout(() => this.map.invalidateSize(), 100);
    }

    handleResize() {
        this.map.invalidateSize();
    }

    updateMap(impactData) {
        if (!this.map) {
            console.warn("Map not initialized - skipping update");
            return;
        }

        // Clear previous data
        this.layerGroup.clearLayers();
        this.countryMarkers.clear();
        
        if (!impactData || impactData.length === 0) return;
        
        // Create markers
        const markers = [];
        impactData.forEach(data => {
            const countryCode = DataManager.getCountryCode(data.country);
            const centroid = DataManager.getCountryCentroid(countryCode);
            
            if (!centroid) return;
            
            // Create marker with popup
            const marker = L.circleMarker(centroid, {
                radius: 10,
                color: '#e74c3c',
                fillColor: '#e74c3c',
                fillOpacity: 0.7
            }).bindPopup(`
                <strong>${data.country}</strong><br>
                CO₂e: ${data.co2e.toFixed(2)} kg<br>
                Water: ${data.water.toFixed(2)} L<br>
                Land: ${data.land.toFixed(2)} m²
            `);
            
            markers.push(marker);
        });
        
        // Add all markers to layer group
        this.layerGroup.addLayer(L.layerGroup(markers));
        
        // Fit map to markers with padding
        this.map.fitBounds(this.layerGroup.getBounds(), {
            padding: [50, 50],
            maxZoom: 5
        });
        
        // Force tile refresh
        setTimeout(() => {
            this.map.invalidateSize();
            this.tileLayer._resetView();
        }, 500);
    }

    addLegend() {
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `
                <h4>Environmental Impact</h4>
                <div class="legend-item">
                    <i class="circle" style="background:#e74c3c"></i> CO₂e Emissions
                </div>
                <div class="legend-item">
                    <i class="circle" style="background:#3498db"></i> Water Usage
                </div>
                <div class="legend-item">
                    <i class="circle" style="background:#2ecc71"></i> Land Use
                </div>
            `;
            return div;
        };
        legend.addTo(this.map);
    }

    updateMap(impactData) {
        console.log("Updating map with impact data:", impactData); // DEBUG
        
        // Clear previous data
        this.layerGroup.clearLayers();
        
        if (!impactData || impactData.length === 0) {
            console.warn("No impact data to display");
            return;
        }
        
        // Create markers
        impactData.forEach(data => {
            const countryCode = DataManager.getCountryCode(data.country);
            if (!countryCode) {
                console.warn(`Country code not found for: ${data.country}`);
                return;
            }
            console.log("data.country: ", data.country)  // DEBUG

            const centroid = DataManager.getCountryCentroid(countryCode);
            if (!centroid) {
                console.warn(`Centroid not found for: ${data.country} (${countryCode})`);
                return;
            }
            
            // Create scaled marker based on total impact
            const totalImpact = data.co2e + data.water + data.land;
            const maxImpact = Math.max(...impactData.map(d => d.co2e + d.water + d.land));
            const radius = Math.max(5, Math.min(30, (totalImpact / maxImpact) * 30));
            
            // Create color gradient based on impact type
            const color = this.getImpactColor(data);
            
            // Create the marker
            const marker = L.circleMarker(centroid, {
                radius: radius,
                color: color,
                fillColor: color,
                fillOpacity: 0.7,
                weight: 1
            });
            
            // Add popup
            marker.bindPopup(`
                <strong>${data.country}</strong><br>
                CO₂e: ${data.co2e.toFixed(2)} kg<br>
                Water: ${data.water.toFixed(2)} L<br>
                Land: ${data.land.toFixed(2)} m²
            `);
            
            // Add to layer group
            marker.addTo(this.layerGroup);
        });
        
        // Fit map to markers with padding
        if (this.layerGroup.getLayers().length > 0) {
            this.map.fitBounds(this.layerGroup.getBounds(), {
                padding: [50, 50],
                maxZoom: 5
            });
        }
        
        console.log(`${this.layerGroup.getLayers().length} markers added to map`);
    }

    // Helper method to determine marker color
    getImpactColor(data) {
        // CO2 dominant - red
        if (data.co2e > data.water && data.co2e > data.land) {
            return '#e74c3c';
        }
        // Water dominant - blue
        if (data.water > data.co2e && data.water > data.land) {
            return '#3498db';
        }
        // Land dominant - green
        return '#2ecc71';
    }
}