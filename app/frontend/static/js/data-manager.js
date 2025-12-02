// frontend/static/js/core/data-manager.js
/*
sequenceDiagram
    participant App
    participant DataManager
    App->>DataManager: initialize()
    DataManager->>DataManager: loadConfig()
    DataManager->>DataManager: detectUserLocation()
    DataManager->>DataManager: loadImportData()
    DataManager->>DataManager: loadDatabase()
    DataManager->>DataManager: loadRegions() & loadEnvImpacts()
    DataManager->>DataManager: processDerivedData()
*/
import { ApiClient } from './api-client.js'; // Add proper import

export class DataManager {
    static initialized = false;
    static config = null;
    static datasets = {
      database: null,
      importData: null,
      regions: null,
      envImpacts: null,
      conversion_factors: null,
      categories: [],
      ingredients: [],
      importCountries: [],
      selectedIngredients: [],
      geoJsonData: null

    };
  
    static userLocation = {
      countryName: 'Norway',
      countryCodeISO3: 'NOR',
      countryCode: null, // Add this to store the FABIO country code
      success: false
    };
  
    static async initialize() {
      if (this.initialized) {
        console.log("⚙️ Already initialized");
        return;
      }
  
      try {
        await this.loadConfig();
        await this.detectUserLocation();
        
        await this.loadImportData();
        await this.loadDatabase();
        await this.loadConversionFactors();
        await this.loadGeoJsonData();

      //  await Promise.all([this.loadRegions(), this.loadEnvImpacts()]);
        // Load regions FIRST, then env impacts
        await this.loadRegions(); // This creates countryCodeMap
        await this.loadEnvImpacts(); // This now just fetches from backend
        
        this.processCategories();
        this.processIngredients();
        this.processImportCountries();
        
        this.initialized = true;
        console.log("📊 DataManager initialized");
      } catch (error) {
        console.error("🚨 Data initialization failed:", error);
        throw error;
      }
    }
  
    // --- Configuration Handling ---
    static async loadConfig() {
      try {
        const response = await fetch('/config/data-paths.json');
        this.config = await response.json();
        console.log("⚙️ Loaded config:", this.config);
      } catch (error) {
        throw new Error(`Config load failed: ${error.message}`);
      }
    }
  
    // --- Location Detection ---
    static async detectUserLocation() {
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('IP API response error');
        
        const data = await response.json();
        const sanitizedName = this.sanitizeCountryName(data.country_name);
        
        this.userLocation = {
          countryName: sanitizedName || 'Norway',
          countryCodeISO3: data.country_code_iso3 || 'NOR',
          countryCode: null, // Will be filled after regions load
          success: !!data.country_name
        };
        
        console.log(`🌍 Detected location: ${this.userLocation.countryName}`);

        
      } catch (error) {
        console.error('Location detection failed:', error);
        this.userLocation = {
          countryName: 'Norway',
          countryCodeISO3: 'NOR',
          countryCode: null,
          success: false
        };
      }
    }
  
    static sanitizeCountryName(name) {
      return name
        ?.replace(/\s+/g, '_')
        ?.replace(/[^a-zA-Z0-9_]/g, '')
        ?.trim() || 'Norway';
    }

    // ======================================
    // --- Data Loading ---
    // ======================================
    static async loadImportData() {
      try {
          let importPath;
          
          if (this.userLocation.success) {
            importPath = this.config.datasets.import_data
              .replace('{country}', this.userLocation.countryCodeISO3);
          } else {
            importPath = this.config.datasets.default_import;
          }

         // console.log('📥 Loading import data from:', importPath);
          const response = await fetch(importPath);
          if (!response.ok) throw new Error(`Import data not found at ${importPath}`);
          
          const csvData = await response.text();
        //  console.log('📄 Raw CSV data (first 500 chars):', csvData.substring(0, 500));
          
          const parsedData = this.parseCSV(csvData);
        //  console.log('📊 Parsed data sample:', parsedData.slice(0, 3));
        //  console.log('🔑 Available columns:', Object.keys(parsedData[0] || {}));
          
          this.datasets.importData = this.processImportData(parsedData);
          console.log("✅ Loaded import data from:", importPath);
        } catch (error) {
          console.warn(`⚠️ Falling back to default import data: ${error.message}`);
          const response = await fetch(this.config.datasets.default_import);
          const csvData = await response.text();
          const parsedData = this.parseCSV(csvData);
          
          console.log('📄 Fallback CSV data sample:', parsedData.slice(0, 3));
          this.datasets.importData = this.processImportData(parsedData);
        }
    }


    static processImportData(rawData) {
        const commodityMap = new Map();
        
        rawData.forEach(item => {
          // Use the actual column names from your CSV
          const code = item.Commodity?.trim().toLowerCase();
          const country = item.Country?.trim();
          const value = Number(item.Export_Value);
          const rank = Number(item.Rank);
          
          // Skip if essential data is missing
          if (!code || !country || isNaN(value)) {
            console.warn('Skipping invalid import data item:', item);
            return;
          }
          
          if (!commodityMap.has(code)) {
            commodityMap.set(code, []);
          }
          
          commodityMap.get(code).push({
            country: country,
            value: value,
            originalRank: rank
          });
        });

        // Sort by highest export value first, then original rank
        for (const [code, entries] of commodityMap) {
          entries.sort((a, b) => {
            // First priority: Higher export value
            if (b.value !== a.value) return b.value - a.value;
            // Second priority: Lower original rank if values are equal
            return a.originalRank - b.originalRank;
          });
          
          // Store only top 5 entries
          commodityMap.set(code, entries.slice(0, 5));
        }
        
        // Debug: Show sample commodity data
        console.log('Processed importData for c002:', commodityMap.get('c002'));
        return commodityMap;
      }


    static getTopImportCountries(commCode) {
      const importers = this.datasets.importData.get(commCode) || [];
      return importers
        .slice(0, 5)
        .map(item => item.country)
        .filter(Boolean);
    }
  
    static getIngredientsByCategory(category) {
      if (!this.datasets.database) return [];
      
      const cleanCategory = category?.trim().toLowerCase();
      
      return [
        ...new Set(
          this.datasets.database
            .filter(item => 
              item["Food group"]?.trim().toLowerCase() === cleanCategory
            )
            .map(item => item.Ingredient?.trim())
        )
      ].filter(Boolean).sort();
    }

     // load database
    static async loadDatabase() {
      try {
        const response = await fetch(this.config.datasets.database);
        if (!response.ok) throw new Error('Database not found');
        
        const csvData = await response.text();
        this.datasets.database = this.parseCSV(csvData)
          .map(item => {
            // Clean the "Food group" field to match processed categories
            const foodGroup = item["Food group"]?.trim().replace(/^['"]+|['"]+$/g, '');

            // Normalize comm_code to match importData format
            const commCode = item.comm_code.trim().toLowerCase();
            
            // Get top countries from importData
            const topCountries = this.getTopImportCountries(commCode)
              .map(country => country.trim());
            
            // Add Top1-Top5 fields to database entry
            return {
              ...item,
              "Food group": foodGroup, // Add cleaned food group
              Top1: topCountries[0] || '',
              Top2: topCountries[1] || '',
              Top3: topCountries[2] || '',
              Top4: topCountries[3] || '',
              Top5: topCountries[4] || ''
            };
          });
        
        console.log("✅ Loaded database with dynamic Top1-Top5");
        // Debug: Show first database entry
        console.log('Sample database entry:', this.datasets.database[1]);
        
      } catch (error) {
        throw new Error(`Database load failed: ${error.message}`);
      }
    }
  
    // load regions
    static async loadRegions() {
      try {
        const response = await fetch(this.config.datasets.regions);
        const csvData = await response.text();
        this.datasets.regions = this.parseCSV(csvData);
        
        // Create country code lookup map
        this.countryCodeMap = new Map(
          this.datasets.regions.map(region => [
            region.CountryName.toLowerCase().trim(), // Key: normalized country name
            region.CountryCode.trim() // Value: ISO code
          ])
        );
        
        console.log("✅ Loaded regions data with", this.countryCodeMap.size, "countries");
 
        
      } catch (error) {
        console.error("⚠️ Region data load failed:", error.message);
      }
    }

    // load conversion factor
    static async loadConversionFactors() {
      try {
        // Ensure config path exists
        const response = await fetch(this.config.datasets.conversion_factors);
             
        const csvData = await response.text();

        const parsed = this.parseCSV(csvData);
        
        // Validate CSV structure
        if (!parsed[0]?.Ingredient || !parsed[0]?.Unit || !parsed[0]?.Grams) {
          throw new Error("Invalid CSV format - missing required columns");
        }
    
        this.conversionMap = new Map(
          parsed.map(row => {
            const key = `${row.Ingredient.trim().toLowerCase()}-${row.Unit.trim().toLowerCase()}`;
            const grams = parseFloat(row.Grams) || 0;
            return [key, grams];
          })
        );
        
        console.log("✅ Loaded", this.conversionMap.size, "conversion factors");
      } catch (error) {
        console.error("🚨 Conversion factors error:", error.message);
        this.conversionMap = new Map(); // Fallback to empty map
      }
    }

    
    // load environmental impacts
    // 1. Remove the old loadEnvImpacts() completely and replace with this:

    static async loadEnvImpacts() {
      try {
        console.log('📄 Environmental impact data will be fetched from backend on-demand');
        console.log('✅ Backend has pre-loaded all Parquet files at startup');
        
        // Initialize empty map - we'll populate it on-demand via API calls
        this.envImpactMap = new Map();
        
        // Test the backend connection with better error handling
        const healthCheck = await fetch('/api/health');
        
        // Check if response is OK before parsing
        if (!healthCheck.ok) {
          console.warn(`⚠️ Backend health check failed: ${healthCheck.status} ${healthCheck.statusText}`);
          const text = await healthCheck.text();
          console.warn('Response body:', text.substring(0, 200));
          return;
        }
        
        // Check content type before parsing JSON
        const contentType = healthCheck.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn(`⚠️ Backend returned non-JSON response: ${contentType}`);
          const text = await healthCheck.text();
          console.warn('Response body:', text.substring(0, 200));
          return;
        }
        
        const health = await healthCheck.json();
        
        if (health.ready) {
          console.log(`✅ Backend ready with ${health.cache_entries} cached impact entries`);
        } else {
          console.warn('⚠️ Backend is still loading data...');
        }
        
      } catch (error) {
        console.error("🚨 Failed to check backend status:", error);
        console.error("Stack trace:", error.stack);
        this.envImpactMap = new Map();
      }
    }


    // 2. Add this NEW method for looking up impacts (single or batch)

    /**
     * Look up environmental impacts for a specific country/commodity
     * @param {string|number} countryCode - Country code (e.g., "1", "2", 1, 2)
     * @param {string} commodityCode - Commodity code (e.g., "c001", "c002")
     * @returns {Promise<Object>} Object with biodiv, gwp100, landuse, water values
     */
    static async getEnvImpact(countryCode, commodityCode) {
      try {
        // Check cache first
        const cacheKey = `${countryCode}_${commodityCode}`.toLowerCase();
        
        if (this.envImpactMap.has(cacheKey)) {
          return this.envImpactMap.get(cacheKey);
        }
        
        // Fetch from backend
        const response = await fetch('/api/env-impacts/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country_code: String(countryCode),
            commodity_code: String(commodityCode)
          })
        });
        
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }
        
        const result = await response.json();
        
        // Cache the result
        const impacts = result.impacts || {
          biodiv: 0,
          gwp100: 0,
          landuse: 0,
          water: 0
        };
        
        this.envImpactMap.set(cacheKey, impacts);
        
        return impacts;
        
      } catch (error) {
        console.error(`❌ Failed to get env impact for ${countryCode}_${commodityCode}:`, error);
        return { biodiv: 0, gwp100: 0, landuse: 0, water: 0 };
      }
    }


    // 3. Add this NEW method for batch lookups (more efficient for multiple items)

    /**
     * Batch lookup for multiple country/commodity pairs
     * More efficient than individual lookups
     * @param {Array} items - Array of {countryCode, commodityCode} objects
     * @returns {Promise<Array>} Array of impact objects
     */
    static async batchGetEnvImpacts(items) {
      try {
        // Filter out items we already have cached
        const uncachedItems = [];
        const results = [];
        
        for (const item of items) {
          const cacheKey = `${item.countryCode}_${item.commodityCode}`.toLowerCase();
          
          if (this.envImpactMap.has(cacheKey)) {
            results.push({
              countryCode: item.countryCode,
              commodityCode: item.commodityCode,
              impacts: this.envImpactMap.get(cacheKey)
            });
          } else {
            uncachedItems.push({
              country_code: String(item.countryCode),
              commodity_code: String(item.commodityCode)
            });
          }
        }
        
        // Fetch uncached items in batch
        if (uncachedItems.length > 0) {
          const response = await fetch('/api/env-impacts/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: uncachedItems })
          });
          
          if (!response.ok) {
            throw new Error(`Batch lookup failed: ${response.status}`);
          }
          
          const batchResult = await response.json();
          
          // Cache and add to results
          for (const item of batchResult.results) {
            const cacheKey = `${item.country_code}_${item.commodity_code}`.toLowerCase();
            this.envImpactMap.set(cacheKey, item.impacts);
            
            results.push({
              countryCode: item.country_code,
              commodityCode: item.commodity_code,
              impacts: item.impacts
            });
          }
        }
        
        console.log(`✅ Batch lookup completed: ${results.length} items (${uncachedItems.length} from API)`);
        return results;
            
          } catch (error) {
            console.error('❌ Batch lookup failed:', error);
            return items.map(item => ({
              countryCode: item.countryCode,
              commodityCode: item.commodityCode,
              impacts: { biodiv: 0, gwp100: 0, landuse: 0, water: 0 }
            }));
          }
        }


  // 4. REMOVE or UPDATE the old getEnvImpactFactors method - replace with this:

  /**
   * Get environmental impact factors (backward compatible wrapper)
   * Now uses the new async API
   * @param {string} countryCode - Country code
   * @param {string} commCode - Commodity code
   * @returns {Object|null} Impact factors or null
   */
  static getEnvImpactFactors(countryCode, commCode) {
    // For backward compatibility, check cache synchronously
    const cacheKey = `${countryCode}_${commCode}`.toLowerCase();
    return this.envImpactMap.get(cacheKey) || null;
  }


  // 5. Get FABIO country code from country name (uses existing regions data)

  /**
   * Get FABIO country code (numeric) from country name
   * Uses the existing regions.csv data loaded in loadRegions()
   * @param {string} countryName - Country name
   * @returns {string|null} FABIO country code (e.g., "1", "2", "3")
   */
  static getFabioCountryCode(countryName) {
    if (!countryName || !this.datasets.regions) return null;
    
    const cleanName = countryName.toLowerCase().trim();
    
    // Search in regions dataset for matching country name
    const country = this.datasets.regions.find(region => 
      region.CountryName.toLowerCase().trim() === cleanName
    );
    
    return country ? String(country.CountryCode) : null;
  }

    //==================================
    // load geojson data
    //==================================

    static async loadGeoJsonData() {
        try {
            const response = await fetch(this.config.datasets.geojson);
            this.geoJsonData = await response.json();
            return this.geoJsonData;
         } catch (error) {
            console.error('Failed to load GeoJSON data:', error);
            throw error; // Add this line to propagate the error
        }
        
    }


    // ===========================
    // load saved recipe
    // ===========================
    static async loadSavedRecipe() {
      try {
        const recipe = await ApiClient.getSavedRecipes();
        console.log("✅ Loaded saved recipe:", recipe);
    
        if (recipe?.recipeIngredient) {
          return recipe.recipeIngredient.map(ingredient => ({
            category: recipe.category || "Uncategorized",
            name: ingredient.details?.originalText || ingredient.name,
            mainIngredient: ingredient.mainIngredient,
            amount: ingredient.details?.amount || 0,
            unit: ingredient.details?.unit || 'unit',
            source: ingredient.source || " "
          }));
        }
        return [];
       
      } catch (error) {
        console.error("Error loading saved recipe:", error);
        return [];
      }
      
    }

    
    // ================================
    // --- Data Processing ---
    // ================================
  
    static getTopImporters(commCode) {
      return this.datasets.importData?.get(commCode) || [];
    }
  
    // ParseCSV
    static parseCSV(csvText) {
      const rows = csvText.split(/\r?\n/).filter(row => row.trim() !== '');
      if (rows.length < 1) return [];
      
      const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      return rows.slice(1).map(row => {
        // Handle quoted fields that may contain commas
        const values = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim().replace(/^"|"$/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        
        // Push the last value
        values.push(currentValue.trim().replace(/^"|"$/g, ''));
        
        return headers.reduce((obj, header, index) => {
          obj[header] = values[index] || '';
          return obj;
        }, {});
      });
    }

    // --- Derived Data ---
    static processCategories() {
      this.datasets.categories = [
        ...new Set(this.datasets.database?.map(item =>
          item["Food group"]?.trim().replace(/^['"]+|['"]+$/g, '')
        ))
      ].filter(Boolean).sort();
    }
    
    static processIngredients() {
      this.datasets.ingredients = [
        ...new Set(this.datasets.database?.map(item =>
          item.Ingredient?.trim().replace(/^['"]+|['"]+$/g, '')
        ))
      ].filter(Boolean).sort();
    }

    static processImportCountries() {
      const allCountries = this.datasets.database?.flatMap(item => [
        item.Top1, item.Top2, item.Top3, item.Top4, item.Top5
      ]).filter(Boolean) || [];
      
      this.datasets.importCountries = [...new Set(allCountries)].sort();
    }
  
    static findClosestIngredient(name) {
      const cleanName = name.toLowerCase().replace(/[^a-z\s]/g, '');
      return this.database.find(item => {
        const dbName = item.Ingredient.toLowerCase();
        return dbName.includes(cleanName) || cleanName.includes(dbName);
      });
    }
    
    static getAllCountries() {
      // Replace with actual country list from your data
      return ['','USA', 'Canada', 'Mexico', 'China', 'Germany'];
     //return [...new Set(this.importData.map(item => item.country))].sort();
    }

    // Country code
    static getCountryCode(countryName) {
      if (!countryName) return null;
      const cleanName = countryName.toLowerCase().trim();
      return this.countryCodeMap.get(cleanName) || null;
    }

    // CommCode by category
    static getCommCodeByCategory(category) {
      const match = this.database.find(item => 
        item["Food group"].toLowerCase() === category.toLowerCase()
      );
      return match?.comm_code;
    }
    

    static getEnvImpactFactors(countryCode, commCode) {
      const key = `${countryCode}-${commCode}`.toLowerCase();
      return this.envImpactMap.get(key) || null;
    }


    static formatCountryName(name) {
      return name.replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }

    // --- Public Accessors ---
    static get database() {
      return this.datasets.database || [];
    }
  
    static get categories() {
      return this.datasets.categories || [];
    }
  
    static get ingredients() {
      return this.datasets.ingredients || [];
    }
  
    static get importCountries() {
      return this.datasets.importCountries || [];
    }
  
    static get location() {
      return this.userLocation;
    }
  }
