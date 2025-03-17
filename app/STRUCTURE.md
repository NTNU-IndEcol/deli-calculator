# Project Structure

```
foodCalculator/
│
├── app.py                      # Flask backend server (entry point)
│
├── backend/
│   ├── carbon_calculator.py    # Logic for calculating emissions
│   ├── data/                   # Dataset for food emissions
│   │   ├── food_item_poore_and_nemecek.csv # Database, Poore and Nemecek
|   |   ├── Conversion_factors.csv          # Conversion ingredient unit to gram 
|   |   └── food_emissions.csv  # Sample dataset
|   |   
│   └── requirements.txt        # Python dependencies
│
├── frontend/                   # Frontend files
│   ├── index.html              # Main HTML file
│   ├── style.css               # CSS for styling
│   └── script.js               # JavaScript for handling user input
│
├── README.md                   # Project documentation
├── STRUCTURE.md                # Project structure documentation
└── setup.sh                    # Bash script to set up the project
```
