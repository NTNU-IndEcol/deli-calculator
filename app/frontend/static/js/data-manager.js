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
      selectedIngredients: []
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
            .replace('{country}', this.userLocation.countryName);
        } else {
          importPath = this.config.datasets.default_import;
        }
  
        const response = await fetch(importPath);
        if (!response.ok) throw new Error(`Import data not found at ${importPath}`);
        
        const csvData = await response.text();
        this.datasets.importData = this.processImportData(this.parseCSV(csvData));
        console.log("✅ Loaded import data from:", importPath);
      } catch (error) {
        console.warn(`⚠️ Falling back to default import data: ${error.message}`);
        const response = await fetch(this.config.datasets.default_import);
        const csvData = await response.text();
        this.datasets.importData = this.processImportData(this.parseCSV(csvData));
      }
    }

    static processImportData(rawData) {
      const commodityMap = new Map();
      
      rawData.forEach(item => {
        // Normalize commodity code to lowercase for consistency
        const code = item.Commodity.trim().toLowerCase();
        
        if (!commodityMap.has(code)) {
          commodityMap.set(code, []);
        }
        
        commodityMap.get(code).push({
          country: item.Country.trim(),
          value: Number(item.Export_Value),
          originalRank: Number(item.Rank) // Keep original rank for reference
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

          // Debug: Show sample commodity data
      console.log('Processed importData for c002:', commodityMap.get('c002'));
      return commodityMap;

      } 
      
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
    
        // Extract headers (metric names)
        const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
        // Initialize impact map
        this.envImpactMap = new Map();
    
        // Process each countryCode_commCode row
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i].split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
          const id = cells[0]; // Format: "countryCode_commCode" (e.g., "1_c001")
          const [countryCode, commCode] = id.split('_');
          const key = `${countryCode}-${commCode}`.toLowerCase();
    
          // Create or get impact entry
          if (!this.envImpactMap.has(key)) {
            this.envImpactMap.set(key, {
              landuse: 0,
              blue_water: 0,
              green_water: 0,
              CO2: 0,
              CH4: 0,
              N2O: 0,
              p_application: 0,
              n_application: 0
            });
          }
          const entry = this.envImpactMap.get(key);
    
          // Map metric columns to their values
          for (let col = 1; col < headers.length; col++) {
            const metric = headers[col];
            const value = parseFloat(cells[col]) || 0;
    
            // Assign values based on metric type
            switch (true) {
              case metric === 'landuse':
                entry.landuse = value;
                break;
              case metric === 'blue':
                entry.blue_water = value;
                break;
              case metric === 'green':
                entry.green_water = value;
                break;
              case metric === 'p_application':
                entry.p_application = value;
                break;
              case metric === 'n_application':
                entry.n_application = value;
                break;
              case metric.includes('CH4'):
                entry.CH4 += value;
                break;
              case metric.includes('CO2'):
                entry.CO2 += value;
                break;
              case metric.includes('N2O'):
                entry.N2O += value;
                break;
            }
          }
        }
    
        console.log("✅ Environmental data loaded:", this.envImpactMap.size, "entries");
      } catch (error) {
        console.error("🚨 Failed to load environmental data:", error);
      }
    }
    /*
    static async loadEnvImpacts() {
      try {
        const response = await fetch(this.config.datasets.env_impacts);
        const csvData = await response.text();
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
    
        // Extract headers (countryCode_commCode pairs)
        const headers = rows[0].split(',').slice(1); // ["1_c001", "1_c002", ...]
    
        // Initialize impact map
        this.envImpactMap = new Map();
    
        // Process each metric row
      // Process each metric row
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].split(',');
        const rawMetric = cells[0].trim();
        const metric = rawMetric.toLowerCase().replace(/[()]/g, '').trim();
  
        headers.forEach((header, colIndex) => {
          const cleanHeader = header.replace(/"/g, '');
          const [countryCode, commCode] = cleanHeader.split('_');
          const key = `${countryCode}-${commCode}`.toLowerCase();
  
          const rawValue = cells[colIndex + 1]?.trim() || '';
          const value = parseFloat(rawValue) || 0;
  
          if (!this.envImpactMap.has(key)) {
            this.envImpactMap.set(key, {
              landuse: 0,
              blue_water: 0,
              green_water: 0,
              CO2: 0,
              CH4: 0,    // Will aggregate all CH4 types
              N2O: 0,    // Will aggregate all N2O types
              p_application: 0,
              n_application: 0
            });
          }
  
          const entry = this.envImpactMap.get(key);
  
          // Handle metric mapping with better pattern matching
          if (metric.startsWith('land use')) {
            entry.landuse = value;
          } else if (metric.includes('blue')) {
            entry.blue_water = value;
          } else if (metric.includes('green')) {
            entry.green_water = value;
          } else if (metric.includes('co2')) {
            entry.CO2 += value;
          } else if (metric.includes('ch4')) {
            entry.CH4 += value;  // Aggregate all CH4 sources
          } else if (metric.includes('n2o')) {
            entry.N2O += value;  // Aggregate all N2O sources
          } else if (metric.includes('p_application')) {
            entry.p_application = value;
          } else if (metric.includes('n_application')) {
            entry.n_application = value;
          } else {
            console.warn(`Unhandled metric: ${rawMetric}`);
          }
        });
      }
    
        console.log("✅ Environmental data loaded:", this.envImpactMap.size, "entries");
        console.log(this.envImpactMap)

      } catch (error) {
        console.error("🚨 Failed to load environmental data:", error);
      }
    }
    */  
    /*
    static async loadEnvImpacts() {
      try {
        const response = await fetch(this.config.datasets.env_impacts);
        const csvData = await response.text();
        this.datasets.envImpacts = this.parseCSV(csvData);
        
        this.envImpactMap = new Map(
          this.datasets.envImpacts.map(impact => {
            // Land Use and Blue Water (direct values)
            const landuse = parseFloat(impact.landuse) || 0;
            const blue_water = parseFloat(impact.blue) || 0;
    
            // CO₂ Emissions (sum all CO2-related columns)
            const CO2 = [
              "Emissions (CO2) (Drained organic soils (CO2))",
              "Direct emissions (CO2) (On farm - Energy use)",
              "Direct emissions (CO2) (Food - Energy use)"
            ].reduce((sum, col) => sum + parseFloat(impact[col] || 0), 0);
    
            // CH₄ Emissions (sum all CH4-related columns)
            const CH4 = [
              "Emissions (CH4) (Enteric)",
              "Emissions (CH4) (Rice cultivation)",
              "Emissions (CH4) (Burning crop residues)",
              "Emissions (CH4) (Manure management)",
              "Direct emissions (CH4) (On farm - Energy use)",
              "Direct emissions (CH4) (Food - Energy use)",
              "Emissions (CH4) (Savanna fires)"
            ].reduce((sum, col) => sum + parseFloat(impact[col] || 0), 0);
    
            // N₂O Emissions (sum all N2O-related columns)
            const N2O = [
              "Direct emissions (N2O) (On farm - Energy use)",
              "Direct emissions (N2O) (Food - Energy use)",
              "Direct emissions (N2O) (Manure management)",
              "Indirect emissions (N2O) (Manure management)",
              "Emissions (N2O) (Savanna fires)",
              "Direct emissions (N2O) (Crop residues)",
              "Indirect emissions (N2O) (Crop residues)",
              "Emissions (N2O) (Burning crop residues)",
              "Direct emissions (N2O) (Manure on pasture)",
              "Indirect emissions (N2O that leaches) (Manure on pasture)",
              "Indirect emissions (N2O that volatilises) (Manure on pasture)",
              "Emissions (N2O) (Drained organic soils (N2O))",
              "Direct emissions (N2O) (Manure applied)",
              "Indirect emissions (N2O) (Manure applied)",
              "Direct emissions (N2O) (Synthetic fertilizers)",
              "Indirect emissions (N2O that leaches) (Synthetic fertilizers)"
            ].reduce((sum, col) => sum + parseFloat(impact[col] || 0), 0);
    
            return [
              `${impact.CountryCode}-${impact.CommCode}`.toLowerCase(),
              { landuse, blue_water, CO2, CH4, N2O }
            ];
          })
        );
    
        console.log("✅ Loaded environmental impacts with", 
                  this.envImpactMap.size, "entries");
      } catch (error) {
        console.error("⚠️ Environmental impacts load failed:", error.message);
      }
    }
    */
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
    // --- Data Processing ---

  
    static getTopImporters(commCode) {
      return this.datasets.importData?.get(commCode) || [];
    }
  
    // ParseCSV

    static parseCSV(csvText) {
      const rows = csvText.split(/\r?\n/); // Split rows
      const headers = rows[0].split(',').map(h => h.trim()); // Extract headers
    
      return rows.slice(1).map(row => {
        // Split row into columns while respecting quoted commas
        const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const obj = {};
        
        headers.forEach((header, i) => {
          let value = cols[i]?.trim() || '';
          // Remove surrounding quotes if present
          value = value.replace(/^"(.*)"$/, '$1');
          obj[header] = value;
        });
        
        return obj;
      });
    }
    /*
    static parseCSV(csvText) {
      const lines = csvText.split('\n').filter(line => line.trim());
      if (lines.length < 1) return [];
      
      const headers = lines.shift().split(',').map(h => h.trim());
      
      return lines.map(line => {
        const values = line.split(',').map(v => v.trim());
        return headers.reduce((obj, header, index) => {
          obj[header] = values[index] || '';
          return obj;
        }, {});
      });
    }
   */
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
    
    /*
    static findCommCode(ingredientName) {
      const match = this.database.find(item => 
        this.fuzzyMatch(item.Ingredient, ingredientName)
      );
      return match?.comm_code;
    }

    fuzzyMatch(dbName, inputName) {
      const cleanDb = dbName.toLowerCase().replace(/[^a-z]/g, '');
      const cleanInput = inputName.toLowerCase().replace(/[^a-z]/g, '');
      
      // Split into words and check partial matches
      const inputWords = cleanInput.split(' ');
      return inputWords.some(word => cleanDb.includes(word));
    }
  */

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
