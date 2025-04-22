// frontend/static/js/core/api-client.js
export class ApiClient {
  static baseURL = '/api'; // Align with Flask blueprint prefix
  static debug = true;

  static async _request(endpoint, method = 'GET', data = null) {
      const url = `${this.baseURL}${endpoint}`;
      const headers = { 'Content-Type': 'application/json' };
      const config = { method, headers };

      if (data) {
          config.body = JSON.stringify(data);
      }

      try {
          if (this.debug) {
              console.log(`⚡ API ${method} ${url}`, data);
          }

          const response = await fetch(url, config);
          
          if (!response.ok) {
              const errorData = await response.json();
              throw new ApiError(response.status, errorData?.error || 'API request failed');
          }

          return await response.json();
      } catch (error) {
          if (this.debug) console.error(`❌ API Error: ${error.message}`);
          throw error;
      }
  }

  // --------------------------
  // Recipe Endpoints
  // --------------------------

  /**
   * Process recipe from URL
   * @param {string} url - Recipe webpage URL
   */
  static async processRecipe(url) {
      return this._request('/process-recipe', 'POST', { url });
  }

  /**
   * Get saved recipe data
   */
  static async getSavedRecipes() {
    const response = await fetch(`${this.baseURL}/saved-recipes`);
    return response.json();
  }


  // --------------------------
  // Calculation Endpoints
  // --------------------------

  /**
   * Calculate recipe environmental impact
   * @param {Object} recipe - Full recipe data
   */
  static async calculateRecipeImpact(recipe) {
      return this._request('/calculate-recipe', 'POST', { recipe });
  }

  /**
   * Get environmental impact factors
   * @param {string} impactType - Impact category (default: 'carbon')
   */
  static async getImpactFactors(impactType = 'carbon') {
      return this._request(`/impact-factors/${impactType}`);
  }

  // --------------------------
  // Data Endpoints
  // --------------------------

  /**
   * Get import/export data for country
   * @param {string} countryCode - ISO3 country code
   */
  static async getTradeData(countryCode) {
      return this._request(`/trade-data/${countryCode}`);
  }

  /**
   * Get food database metadata
   */
  static async getDatabaseMetadata() {
      return this._request('/database-info');
  }
}

class ApiError extends Error {
  constructor(status, message) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
  }
}