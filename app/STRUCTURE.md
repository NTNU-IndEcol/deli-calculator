# Project Structure

```
foodCalculator/
│
├── app.py                      # Flask backend (keep in root for easy deployment)
│
├── backend/
│   ├── carbon_calculator.py    # Core calculation logic
│   ├── data_loader.py          # CSV/data processing
│   ├── routes.py               # API endpoint definitions
│   └── data/
│       ├── food_items.csv
│       ├── conversion_factors.csv
│       └── regions.csv
│
├── frontend/
│   ├── static/
│   │   ├── js/
│   │   │   ├── core/
│   │   │   │   ├── data-manager.js    # Data initialization
│   │   │   │   └── api-client.js      # HTTP communication
│   │   │   ├── ui/
│   │   │   │   ├── autocomplete.js    # Search components
│   │   │   │   ├── form-handler.js     # Ingredient form
│   │   │   │   └── results-view.js     # Calculation display
│   │   │   └── main.js                 # Entry point
│   │   │
│   │   └── css/
│   │       └── style.css
│   │
│   └── templates/
│       └── index.html
│
├── tests/                      # Test directory
│   ├── unit/
│   └── integration/
│
├── config.py                  # Configuration settings
├── requirements.txt           # Python dependencies
├── README.md
└── setup.sh
```
