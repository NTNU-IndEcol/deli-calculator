# Project Structure

```
app/
│
├── app.py                      # Flask backend (keep in root for easy deployment)
│
├── backend/
│   ├── extract_recipe.py       # Recipe extraction logic
│   ├── routes.py               # API endpoint definitions
│   ├── pycache/                # Python cache files (generated)
│   │
│   └── data/
│       ├── Conversion_factors.csv
│       ├── regions.csv
│       ├── food_item_poore_and_nemecek_fabio.csv
│       ├── recipes.json
│       ├── top_exporters_to_Norway.csv
│       ├── world.geojson
│       ├── E_2020_biodiversity.csv
│       ├── E_full_2020.csv
│       ├── EL_2020_biodiversity.csv
│       │
|       ├── import/             # import country rank for each commodity
|       |
│       └── recipes/            # Individual recipe files
|           |    
│           └── images/
│
├── frontend/
│   ├── static/
│   │   ├── js/
│   │   │   ├── api-client.js   # HTTP communication
│   │   │   ├── autocomplete.js # Search components
│   │   │   ├── data-manager.js # Data initialization
│   │   │   ├── food-calculator-app.js # Main application logic
│   │   │   ├── form-handler.js # Ingredient form
│   │   │   ├── main.js         # Entry point
│   │   │   ├── map-view.js     # Map visualization
│   │   │   ├── results-view.js # Calculation display
│   │   │   └── selected-recipe-load.js # Recipe loading
│   │   │
│   │   └── css/
│   │   │   └── style.css
│   │   │
│   │   └── img/                # Image assets
│   │
│   └── templates/
│       ├── index.html          # Main calculator page
│       ├── about.html          # About page
│       ├── recipes.html        # Recipes page
│       ├── feeback.html        # Feedback page
│       └── footer.html         # Footer partial
│
├── tests/ # Test directory
│   ├── unit/
│   └── integration/
│
├── config/                      # Configuration settings
|   └── data-paths.json  
|
├── requirements.txt # Python dependencies
└── README.md
```
