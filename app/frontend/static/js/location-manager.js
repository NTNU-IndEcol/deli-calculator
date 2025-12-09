// frontend/static/js/location-manager.js
// Centralized location management - handles detection and storage

export class LocationManager {
    static detectedLocation = null;
    static currentLocation = null;
    static regions = [];

    /**
     * Initialize location manager - detects user location via IP
     */
    static async initialize(regions) {
        this.regions = regions;
        
        // Detect location via IP API
        await this.detectLocation();
        
        // Set as current location (can be changed by user later)
        this.currentLocation = { ...this.detectedLocation };
        
        console.log('📍 LocationManager initialized:', this.currentLocation.countryName);
        
        return this.currentLocation;
    }

    /**
     * Detect user location using IP geolocation
     */
    static async detectLocation() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) throw new Error('IP API failed');
            
            const data = await response.json();
            const sanitizedName = this.sanitizeCountryName(data.country_name);
            
            // Find matching region
            const region = this.findRegion(sanitizedName, data.country_code_iso3);
            
            if (region) {
                this.detectedLocation = {
                    countryName: region.CountryName,
                    countryCodeISO3: region.iso3c || region.ISO3,
                    countryCode: region.CountryCode,
                    detected: true
                };
            } else {
                // Fallback to Norway
                this.detectedLocation = this.getDefaultLocation();
            }
            
            console.log('🌍 Auto-detected location:', this.detectedLocation.countryName);
            
        } catch (error) {
            console.error('Location detection failed:', error);
            this.detectedLocation = this.getDefaultLocation();
        }
    }

    /**
     * Find region by country name or ISO3 code
     */
    static findRegion(countryName, iso3Code) {
        // Try by name first
        let region = this.regions.find(r => 
            r.CountryName.toLowerCase().trim() === countryName.toLowerCase().trim()
        );
        
        // Try by ISO3 code
        if (!region && iso3Code) {
            region = this.regions.find(r => 
                (r.iso3c || r.ISO3) === iso3Code
            );
        }
        
        return region;
    }

    /**
     * Set user location manually (called when user selects from dropdown)
     */
    static setLocation(location) {
        this.currentLocation = {
            countryName: location.countryName,
            countryCodeISO3: location.countryCodeISO3,
            countryCode: location.countryCode,
            detected: false
        };
        
        console.log('📍 Location manually set to:', this.currentLocation.countryName);
        return this.currentLocation;
    }

    /**
     * Reset to detected location
     */
    static resetToDetected() {
        if (!this.detectedLocation) {
            console.error('No detected location available');
            return null;
        }
        
        this.currentLocation = { ...this.detectedLocation };
        console.log('🔄 Reset to detected location:', this.currentLocation.countryName);
        return this.currentLocation;
    }

    /**
     * Get current location
     */
    static getCurrentLocation() {
        return this.currentLocation;
    }

    /**
     * Get detected location
     */
    static getDetectedLocation() {
        return this.detectedLocation;
    }

    /**
     * Check if current location is different from detected
     */
    static isManuallySet() {
        return this.currentLocation && 
               this.detectedLocation && 
               this.currentLocation.countryName !== this.detectedLocation.countryName;
    }

    /**
     * Get default fallback location (Norway)
     */
    static getDefaultLocation() {
        const norwayRegion = this.regions.find(r => 
            (r.iso3c || r.ISO3) === 'NOR'
        );
        
        if (norwayRegion) {
            return {
                countryName: norwayRegion.CountryName,
                countryCodeISO3: norwayRegion.iso3c || norwayRegion.ISO3,
                countryCode: norwayRegion.CountryCode,
                detected: true
            };
        }
        
        // Hard-coded fallback
        return {
            countryName: 'Norway',
            countryCodeISO3: 'NOR',
            countryCode: '162',
            detected: true
        };
    }

    /**
     * Sanitize country name
     */
    static sanitizeCountryName(name) {
        return name
            ?.replace(/\s+/g, '_')
            ?.replace(/[^a-zA-Z0-9_]/g, '')
            ?.trim() || 'Norway';
    }

    /**
     * Get location for DataManager
     * Returns format compatible with existing DataManager code
     */
    static getLocationForDataManager() {
        const loc = this.currentLocation || this.detectedLocation;
        
        return {
            countryName: loc.countryName,
            countryCodeISO3: loc.countryCodeISO3,
            countryCode: loc.countryCode,
            success: true
        };
    }
}