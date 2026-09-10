// static/js/metrics-tracker.js
import { LocationManager } from './location-manager.js';

export class MetricsTracker {
    static hasTrackedView = false;

    /**
     * Track when user visits the app (call once per session)
     */
    static async trackView() {
        // Only track once per page load
        if (this.hasTrackedView) return;
        
        try {
            const location = LocationManager.getCurrentLocation();
            
            if (!location) {
                console.warn('Location not available for tracking');
                return;
            }

            const response = await fetch('/api/track-usage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    countryCodeISO3: location.countryCodeISO3,
                    countryName: location.countryName,
                    action: 'view'
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.hasTrackedView = true;
                console.log('📊 View tracked for', location.countryName);
            }
        } catch (error) {
            console.error('Error tracking view:', error);
        }
    }

    /**
     * Track when user calculates a recipe
     */
    static async trackCalculation() {
        try {
            const location = LocationManager.getCurrentLocation();
            
            if (!location) {
                console.warn('Location not available for tracking');
                return;
            }

            const response = await fetch('/api/track-usage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    countryCodeISO3: location.countryCodeISO3,
                    countryName: location.countryName,
                    action: 'calculation'
                })
            });

            const data = await response.json();
            
            if (data.success) {
                console.log('📊 Calculation tracked for', location.countryName);
            }
        } catch (error) {
            console.error('Error tracking calculation:', error);
        }
    }
}