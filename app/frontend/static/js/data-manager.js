// frontend/static/js/data-manager.js
import { ApiClient } from './api-client.js';

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
      countryCode: null,
      success: false
    };
  
    static async initialize() {
        if (this.initialized) {
            console.log("⚙️ Already initialized");
            return;
        }

        try {
            await this.loadConfig();
            await this.loadRegions();
            await this.loadConversionFactors();
            await this.loadGeoJsonData();
            await this.loadEnvImpacts();
            
            this.processCategories();
            this.processIngredients();
            this.processImportCountries();
            
            this.initialized = true;
            console.log("📊 DataManager core initialized (waiting for location)");
        } catch (error) {
            console.error("🚨 Data initialization failed:", error);
            throw error;
        }
    }

    //=======================================
    // loadDataForLocation
    //=======================================

    static async loadDataForLocation() {
        console.log(`🔄 Loading data for: ${this.userLocation.countryName} (${this.userLocation.countryCodeISO3})`);
        
        await this.loadImportData();
        await this.loadDatabase();
        this.updateUserLocationCode();
        
        // 🔥 FIX: Reprocess categories and ingredients after database is loaded
        this.processCategories();
        this.processIngredients();
        this.processImportCountries();
        
        console.log(`✅ Data loaded for: ${this.userLocation.countryName}`);
        console.log(`  📊 Categories: ${this.datasets.categories.length}`);
        console.log(`  📊 Ingredients: ${this.datasets.ingredients.length}`);
        console.log(`  📊 Import countries: ${this.datasets.importCountries.length}`);
    }
    
    static updateUserLocationCode() {
        if (!this.datasets.regions || !this.userLocation.countryName) {
            console.warn('⚠️ Cannot update location code - regions not loaded');
            return;
        }

        const matchedCountry = this.datasets.regions.find(region => 
            region.CountryName.toLowerCase().trim() === 
            this.userLocation.countryName.toLowerCase().trim()
        );

        if (matchedCountry) {
            this.userLocation.countryCode = matchedCountry.CountryCode;
            this.userLocation.countryCodeISO3 = matchedCountry.iso3c || matchedCountry.ISO3 || matchedCountry.iso3;
            console.log(`✅ Updated location code: ${this.userLocation.countryCode}, ISO3: ${this.userLocation.countryCodeISO3}`);
        } else {
            const iso3Match = this.datasets.regions.find(region =>
                (region.iso3c || region.ISO3 || region.iso3) === this.userLocation.countryCodeISO3
            );
            
            if (iso3Match) {
                this.userLocation.countryCode = iso3Match.CountryCode;
                console.log(`✅ Updated location code via ISO3: ${this.userLocation.countryCode}`);
            } else {
                console.warn(`⚠️ Could not find FABIO code for ${this.userLocation.countryName}`);
            }
        }
    }

    static async loadConfig() {
      try {
        const response = await fetch('/config/data-paths.json');
        this.config = await response.json();
        console.log("⚙️ Loaded config:", this.config);
      } catch (error) {
        throw new Error(`Config load failed: ${error.message}`);
      }
    }

    static async loadImportData() {
      try {
          let importPath;
          
          if (this.userLocation.success) {
            importPath = this.config.datasets.import_data
              .replace('{country}', this.userLocation.countryCodeISO3);
          } else {
            importPath = this.config.datasets.default_import;
          }

          const response = await fetch(importPath);
          if (!response.ok) throw new Error(`Import data not found at ${importPath}`);
          
          const csvData = await response.text();
          const parsedData = this.parseCSV(csvData);
          
          this.datasets.importData = this.processImportData(parsedData);
          console.log("✅ Loaded import data from:", importPath);
        } catch (error) {
          console.warn(`⚠️ Falling back to default import data: ${error.message}`);
          const response = await fetch(this.config.datasets.default_import);
          const csvData = await response.text();
          const parsedData = this.parseCSV(csvData);
          
          this.datasets.importData = this.processImportData(parsedData);
        }
    }

    static processImportData(rawData) {
        const commodityMap = new Map();
        
        rawData.forEach(item => {
          const code = item.Commodity?.trim().toLowerCase();
          const country = item.Country?.trim();
          const value = Number(item.Export_Value);
          const rank = Number(item.Rank);
          
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

        for (const [code, entries] of commodityMap) {
          entries.sort((a, b) => {
            if (b.value !== a.value) return b.value - a.value;
            return a.originalRank - b.originalRank;
          });
          
          commodityMap.set(code, entries.slice(0, 5));
        }
        
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

    static async loadDatabase() {
      try {
        const response = await fetch(this.config.datasets.database);
        if (!response.ok) throw new Error('Database not found');
        
        const csvData = await response.text();
        this.datasets.database = this.parseCSV(csvData)
          .map(item => {
            const foodGroup = item["Food group"]?.trim().replace(/^['"]+|['"]+$/g, '');
            const commCode = item.comm_code.trim().toLowerCase();
            
            const topCountries = this.getTopImportCountries(commCode)
              .map(country => country.trim());
            
            return {
              ...item,
              "Food group": foodGroup,
              Top1: topCountries[0] || '',
              Top2: topCountries[1] || '',
              Top3: topCountries[2] || '',
              Top4: topCountries[3] || '',
              Top5: topCountries[4] || ''
            };
          });
        
        console.log("✅ Loaded database with dynamic Top1-Top5");
        console.log('Sample database entry:', this.datasets.database[1]);
        
      } catch (error) {
        throw new Error(`Database load failed: ${error.message}`);
      }
    }
  
    static async loadRegions() {
      try {
        const response = await fetch(this.config.datasets.regions);
        const csvData = await response.text();
        this.datasets.regions = this.parseCSV(csvData);
        
        this.countryCodeMap = new Map(
          this.datasets.regions.map(region => [
            region.CountryName.toLowerCase().trim(),
            region.CountryCode.trim()
          ])
        );
        
        console.log("✅ Loaded regions data with", this.countryCodeMap.size, "countries");
        
      } catch (error) {
        console.error("⚠️ Region data load failed:", error.message);
      }
    }

    static async loadConversionFactors() {
      try {
        const response = await fetch(this.config.datasets.conversion_factors);
        const csvData = await response.text();
        const parsed = this.parseCSV(csvData);
        
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
        this.conversionMap = new Map();
      }
    }

    static async loadEnvImpacts() {
      try {
        console.log('📄 Environmental impact data will be fetched from backend on-demand');
        console.log('✅ Backend has pre-loaded all Parquet files at startup');
        
        this.envImpactMap = new Map();
        
        const healthCheck = await fetch('/api/health');
        
        if (!healthCheck.ok) {
          console.warn(`⚠️ Backend health check failed: ${healthCheck.status} ${healthCheck.statusText}`);
          return;
        }
        
        const contentType = healthCheck.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn(`⚠️ Backend returned non-JSON response: ${contentType}`);
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
        this.envImpactMap = new Map();
      }
    }

    static async getEnvImpact(countryCode, commodityCode) {
      try {
        const cacheKey = `${countryCode}_${commodityCode}`.toLowerCase();
        
        if (this.envImpactMap.has(cacheKey)) {
          return this.envImpactMap.get(cacheKey);
        }
        
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

    static async batchGetEnvImpacts(items) {
      try {
        const uncachedItems = [];
        const results = [];
        
        for (const item of items) {
          const cacheKey = `${item.importCountryCode}_${item.commodityCode}`.toLowerCase();
          
          if (this.envImpactMap.has(cacheKey)) {
            results.push({
              importCountryCode: item.importCountryCode,
              commodityCode: item.commodityCode,
              impacts: this.envImpactMap.get(cacheKey)
            });
          } else {
            uncachedItems.push({
              country_code: String(item.importCountryCode),
              commodity_code: String(item.commodityCode)
            });
          }
        }
        
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
          
          for (const item of batchResult.results) {
            const cacheKey = `${item.country_code}_${item.commodity_code}`.toLowerCase();
            this.envImpactMap.set(cacheKey, item.impacts);
            
            results.push({
              importCountryCode: item.country_code,
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
          importCountryCode: item.importCountryCode,
          commodityCode: item.commodityCode,
          impacts: { biodiv: 0, gwp100: 0, landuse: 0, water: 0 }
        }));
      }
    }

    static getEnvImpactFactors(countryCode, commCode) {
      const cacheKey = `${countryCode}_${commCode}`.toLowerCase();
      return this.envImpactMap.get(cacheKey) || null;
    }

    static getFabioCountryCode(countryName) {
      if (!countryName || !this.datasets.regions) return null;
      
      const cleanName = countryName.toLowerCase().trim();
      
      const country = this.datasets.regions.find(region => 
        region.CountryName.toLowerCase().trim() === cleanName
      );
      
      return country ? String(country.CountryCode) : null;
    }

    static async loadGeoJsonData() {
        try {
            const response = await fetch(this.config.datasets.geojson);
            this.geoJsonData = await response.json();
            return this.geoJsonData;
         } catch (error) {
            console.error('Failed to load GeoJSON data:', error);
            throw error;
        }
    }

    // 🔥 FIXED: Simplified recipe loading without location interference
    static async loadSavedRecipe() {
      try {
        console.log('📖 Loading saved recipe (preserving current location)...');
        
        const recipe = await ApiClient.getSavedRecipes();
        
        // Handle error responses
        if (!recipe || recipe.success === false) {
          console.warn("⚠️ No recipe loaded or recipe not found");
          return [];
        }
        
        console.log("✅ Loaded saved recipe:", recipe.name || 'Unknown');

        if (recipe?.recipeIngredient) {
          return recipe.recipeIngredient.map(ingredient => ({
            category: recipe.category || "Uncategorized",
            name: ingredient.mainIngredient || ingredient.details?.originalText || ingredient.name,
            mainIngredient: ingredient.mainIngredient,
            amount: ingredient.details?.amount || 0,
            unit: ingredient.details?.unit || 'unit',
            source: ingredient.source || ""
          }));
        }
        return [];
       
      } catch (error) {
        console.error("Error loading saved recipe:", error);
        return [];
      }
    }
    
    static getTopImporters(commCode) {
      return this.datasets.importData?.get(commCode) || [];
    }
  
    static parseCSV(csvText) {
      const rows = csvText.split(/\r?\n/).filter(row => row.trim() !== '');
      if (rows.length < 1) return [];
      
      const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      return rows.slice(1).map(row => {
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
        
        values.push(currentValue.trim().replace(/^"|"$/g, ''));
        
        return headers.reduce((obj, header, index) => {
          obj[header] = values[index] || '';
          return obj;
        }, {});
      });
    }

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
      return ['','USA', 'Canada', 'Mexico', 'China', 'Germany'];
    }

    static getCountryCode(countryName) {
      if (!countryName) return null;
      const cleanName = countryName.toLowerCase().trim();
      return this.countryCodeMap.get(cleanName) || null;
    }

    static getCommCodeByCategory(category) {
      const match = this.database.find(item => 
        item["Food group"].toLowerCase() === category.toLowerCase()
      );
      return match?.comm_code;
    }

    static formatCountryName(name) {
      return name.replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }

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