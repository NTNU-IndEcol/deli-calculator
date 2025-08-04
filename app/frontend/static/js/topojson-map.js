// frontend/static/js/topojson-map.js
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

export class TopoJSONMap {
    constructor(containerId) {
        this.container = d3.select(`#${containerId}`);
        this.width = this.container.node().clientWidth;
        this.height = 500;
        this.container.attr('viewBox', `0 0 ${this.width} ${this.height}`);
        
        this.projection = d3.geoMercator()
            .center([0, 20])
            .scale(100)
            .translate([this.width / 2, this.height / 2]);

        this.path = d3.geoPath().projection(this.projection);
        
        this.loadWorldData();
    }

    async loadWorldData() {
        try {
            // Load world topology data (110m resolution)
            const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
            
            // Convert TopoJSON to GeoJSON
            const countries = topojson.feature(world, world.objects.countries);
            
            // Render the map
            this.renderMap(countries);
        } catch (error) {
            console.error('Error loading world data:', error);
        }
    }

    renderMap(countries) {
        // Create SVG group for all map elements
        const g = this.container.append('g');
        
        // Draw country boundaries
        g.selectAll('path')
            .data(countries.features)
            .enter()
            .append('path')
            .attr('d', this.path)
            .attr('fill', '#f0f0f0')
            .attr('stroke', '#ccc')
            .attr('stroke-width', 0.5)
            .attr('class', 'country-boundary');
        
        // Add zoom/pan functionality
        this.addZoomBehavior();
    }

    addZoomBehavior() {
        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', (event) => {
                this.container.select('g').attr('transform', event.transform);
            });
        
        this.container.call(zoom);
    }

    highlightCountry(countryName) {
        // Find and highlight a specific country
        this.container.selectAll('.country-boundary')
            .attr('fill', d => {
                const name = d.properties.name;
                return name === countryName ? '#aec6cf' : '#f0f0f0';
            });
    }
}