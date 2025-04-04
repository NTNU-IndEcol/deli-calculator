// In utilities.js
export async function detectUserLocation() {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      return {
        countryName: data.country_name,
        countryCodeISO3: data.country_code_iso3 || 'NOR', // Fallback to Norway
        success: !!data.country_name
      };
    } catch (error) {
      console.error('Location detection failed:', error);
      return {
        countryName: 'Norway',
        countryCodeISO3: 'NOR',
        success: false
      };
    }
  }