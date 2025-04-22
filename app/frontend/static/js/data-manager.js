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
  
    static async loadRegions() {
      try {
        const response = await fetch(this.config.datasets.regions);
        const csvData = await response.text();
        this.datasets.regions = this.parseCSV(csvData);
        console.log("✅ Loaded regions data");
      } catch (error) {
        console.error("⚠️ Region data load failed:", error.message);
      }
    }
  
    static async loadEnvImpacts() {
      try {
        const response = await fetch(this.config.datasets.env_impacts);
        const csvData = await response.text();
        this.datasets.envImpacts = this.parseCSV(csvData);
        console.log("✅ Loaded environmental impacts");
      } catch (error) {
        console.error("⚠️ Environmental impacts load failed:", error.message);
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
    // --- Data Processing ---

  
    static getTopImporters(commCode) {
      return this.datasets.importData?.get(commCode) || [];
    }
  
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
