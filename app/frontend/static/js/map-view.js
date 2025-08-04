// frontend/static/js/ui/map-view.js

export class MapView {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.markers = [];
    this.markerLayers = {};
    this.initMap();
    this.createLegend();
  }

  initMap() {
    // Initialize the map
    this.map = L.map(this.containerId).setView([20, 0], 2);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
   //   attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
   //         subdomains: 'abcd',
            maxZoom: 5,
            minZoom: 2

    }).addTo(this.map);
    
    // Create marker layers
    this.markerLayers = {
      matched: L.layerGroup().addTo(this.map),
      unmatched: L.layerGroup().addTo(this.map)
    };
  }

  createLegend() {
    const legend = L.control({position: 'bottomright'});

    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'legend');
      div.innerHTML = `
        <h4>Legend</h4>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #4CAF50;"></div>
          <span>Matched Ingredients</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #FF9800;"></div>
          <span>Unmatched Ingredients</span>
        </div>
      `;
      return div;
    };

  //  legend.addTo(this.map);
  }

  updateMarkers(ingredients) {
    // Clear existing markers
    this.markerLayers.matched.clearLayers();
    this.markerLayers.unmatched.clearLayers();

    // Add new markers
    ingredients.forEach(ingredient => {
      if (!ingredient.source) return;
      
      // Get country coordinates (simplified for demo)
      const coords = this.getCountryCoordinates(ingredient.source);
      if (!coords) return;
      
      const marker = L.marker(coords).addTo(
        ingredient.matched ? this.markerLayers.matched : this.markerLayers.unmatched
      );
      
      const popupContent = `
        <b>${ingredient.name}</b><br>
        Amount: ${ingredient.amount} ${ingredient.unit}<br>
        Source: ${ingredient.source}<br>
        ${ingredient.matched ? '✅ Matched' : '❌ Unmatched'}
      `;
      
      marker.bindPopup(popupContent);
    });

    // Fit map to markers if we have any
    if (ingredients.length > 0) {
      const bounds = L.latLngBounds(
        ingredients.map(ingredient => {
          const coords = this.getCountryCoordinates(ingredient.source);
          return coords ? L.latLng(coords) : null;
        }).filter(Boolean)
      );
      
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  // Simplified country coordinates lookup
  getCountryCoordinates(countryName) {
    // In a real app, you'd have a more complete dataset
    const countryMap = {
      'United States': [37.0902, -95.7129],
      'China': [35.8617, 104.1954],
      'Brazil': [-14.2350, -51.9253],
      'India': [20.5937, 78.9629],
      'Russia': [61.5240, 105.3188],
      'Canada': [56.1304, -106.3468],
      'Australia': [-25.2744, 133.7751],
      'France': [46.603354, 1.888334],
      'Germany': [51.1657, 10.4515],
      'Mexico': [23.6345, -102.5528],
      'Italy': [41.8719, 12.5674],
      'Spain': [40.4637, -3.7492],
      'Netherlands': [52.1326, 5.2913],
      'Belgium': [50.5039, 4.4699],
      'United Kingdom': [55.3781, -3.4360],
      'Switzerland': [46.8182, 8.2275],
      'Japan': [36.2048, 138.2529],
      'South Korea': [35.9078, 127.7669],
      'Thailand': [15.8700, 100.9925],
      'Vietnam': [14.0583, 108.2772],
      'Indonesia': [-0.7893, 113.9213],
      'Philippines': [12.8797, 121.7740],
      'Malaysia': [4.2105, 101.9758],
      'Singapore': [1.3521, 103.8198],
      'New Zealand': [-40.9006, 174.8860],
      'South Africa': [-30.5595, 22.9375]
    };
    
    return countryMap[countryName];
  }
}