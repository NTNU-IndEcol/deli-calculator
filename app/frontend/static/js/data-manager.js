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
      geoJsonData: null,
      countryCentroids: []
    };
  
    static userLocation = {
      countryName: 'Norway',
      countryCodeISO3: 'NOR',
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
       // await this.loadCountryCentroids();
        await Promise.all([this.loadRegions(), this.loadEnvImpacts()]);
        
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
          success: !!data.country_name
        };
        
        console.log(`🌍 Detected location: ${this.userLocation.countryName}`);
      } catch (error) {
        console.error('Location detection failed:', error);
        this.userLocation = {
          countryName: 'Norway',
          countryCodeISO3: 'NOR',
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
  
    // --- Data Loading ---
   static async loadImportData() {
      try {
        let importPath;
        
        if (this.userLocation.success) {
          importPath = this.config.datasets.import_data
            .replace('{country}', this.userLocation.countryCodeISO3);
        } else {
          importPath = this.config.datasets.default_import;
        }

        console.log('📥 Loading import data from:', importPath);
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

    static async loadEnvImpacts() {
      try {
        const response = await fetch(this.config.datasets.env_impacts);
        const csvData = await response.text();
        const rows = csvData.split('\n').filter(row => row.trim() !== '');

        // Extract headers
        const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

        // Initialize impact map
        this.envImpactMap = new Map();

        // Process each row
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i].split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
          const id = cells[0];
          const [countryCode, commCode] = id.split('_');
          const key = `${countryCode}-${commCode}`.toLowerCase();

          // Parse values first
          const CH4Value = parseFloat(cells[6]) || 0;
          const CO2Value = parseFloat(cells[7]) || 0;
          const N2OValue = parseFloat(cells[8]) || 0;

          // Create impact entry with all columns including biodiversity data
          const entry = {
            landuse: parseFloat(cells[1]) || 0,
            blue_water: parseFloat(cells[2]) || 0,
            green_water: parseFloat(cells[3]) || 0,
            p_application: parseFloat(cells[4]) || 0,
            n_application: parseFloat(cells[5]) || 0,
            CH4: CH4Value, /// 1000,  // Correctly divided by 1000
            CO2: CO2Value, // / 1000,  // Correctly divided by 1000
            N2O: N2OValue ,// / 1000,  // Correctly divided by 1000
            landuse_bd: parseFloat(cells[9]) || 0,
            water_bd: parseFloat(cells[10]) || 0,
            P_bd: parseFloat(cells[11]) || 0,
            N_bd: parseFloat(cells[12]) || 0,
            CH4_bd: parseFloat(cells[13]) || 0,
            CO2_bd: parseFloat(cells[14]) || 0,
            N2O_bd: parseFloat(cells[15]) || 0
          };

          // Calculate total biodiversity impact
          entry.total_bd = entry.landuse_bd + 
                          entry.water_bd + 
                          entry.CH4_bd + 
                          entry.CO2_bd + 
                          entry.N2O_bd;

          this.envImpactMap.set(key, entry);
        }

        console.log("✅ Environmental data loaded:", this.envImpactMap.size, "entries");
        console.log("Sample entry:", Array.from(this.envImpactMap.values())[0]);
      } catch (error) {
        console.error("🚨 Failed to load environmental data:", error);
      }
    }
   
    //load saved recipe
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

    
  
    //load country centroids
    static getCountryCentroid(countryCode) {
        if (!this.countryCentroids || !countryCode) {
            console.warn("Missing country centroids data or country code");
            return null;
        }
        
        // Ensure we have features array
        if (!this.countryCentroids.features || !Array.isArray(this.countryCentroids.features)) {
            console.error("Invalid country centroids format - missing features array");
            return null;
        }
        
        // Find centroid by matching ISO3 code
        const country = this.countryCentroids.features.find(feature => {
            const props = feature.properties || {};
            return props.ISO_A3 === countryCode;
        });
        
        if (!country) {
            console.warn(`Centroid not found for country code: ${countryCode}`);
            return null;
        }
        
        const props = country.properties || {};
        const lat = parseFloat(props.latitude);
        const lng = parseFloat(props.longitude);
        
        if (isNaN(lat) || isNaN(lng)) {
            console.warn(`Invalid coordinates for ${countryCode}: ${props.latitude}, ${props.longitude}`);
            return null;
        }
        
        return [lat, lng];
    }
    
    // --- Data Processing ---

  
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
