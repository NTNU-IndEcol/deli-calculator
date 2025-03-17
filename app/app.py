from flask import Flask, request, jsonify, send_from_directory
from backend.carbon_calculator import CarbonCalculator
from backend.extract_recipe import extract_recipe_data, save_recipe
from dotenv import load_dotenv
import os, json
import pandas as pd

load_dotenv()  # Load .env file

API_KEY = os.getenv("OPENCAGE_API_KEY")
RECIPE_FILE = "backend/data/recipes.json"
DATABASE_FIEL = "backend/data/food_item_poore_and_nemecek.csv"
#print($OPENCAGE_API_KEY)

app = Flask(__name__)
calculator = CarbonCalculator("backend/data/food_emissions.csv")

# Serve frontend files
@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")

@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory("frontend", filename)

@app.route('/backend/data/<filename>')
def serve_csv(filename):
    return send_from_directory('backend/data', filename)

# Extract recipe
@app.route("/extract-recipe", methods=["POST"])
def extract_recipe():
    data = request.get_json()
    url = data.get("url")

    if not url:
        return jsonify({"error": "URL is required"}), 400

    recipe = extract_recipe_data(url)

    if not recipe:
        return jsonify({"error": "Failed to extract recipe. Check logs for details."}), 500

    # Save the recipe
    save_recipe(recipe)

    return jsonify({"recipe": recipe})

# Load recipes
@app.route("/saved-recipes", methods=["GET"])
def get_saved_recipes():
    """Retrieve the latest saved recipe from the JSON file."""
    try:
        if os.path.exists(RECIPE_FILE):
            with open(RECIPE_FILE, "r", encoding="utf-8") as f:
                recipe = json.load(f)  # Read as a single object, not a list
            return jsonify(recipe)

        return jsonify({})
    except Exception as e:
        return jsonify({"error": f"Failed to load recipe: {e}"}), 500

# Load database
@app.route("/load-database", methods=["GET"])
def load_database():
    """Retrieve the latest saved recipe from the JSON file."""
    try:
        if os.path.exists(DATABASE_FIEL):
       #     with open(DATABASE_FIEL, "r", encoding="utf-8") as f:
       #         database = json.load(f)  # Read as a single object, not a list
            df = pd.read_csv(DATABASE_FIEL, encoding="ISO-8859-1")  # Load CSV into a DataFrame
            database = df.to_dict(orient="records")  # Convert DataFrame to list of dictionaries
 
            return jsonify(database)

        return jsonify({"error": "Database file not found"}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to load database: {e}"}), 500
    

# Add ingredient list endpoint
@app.route("/ingredients")
def get_ingredients():
    ingredients = calculator.data['ingredient'].tolist()
    return jsonify({"ingredients": ingredients})

# API endpoint for calculations
@app.route("/calculate", methods=["POST"])
def calculate():
    try:
        data = request.json
        entries = data.get("entries", [])
        
        total_emission = 0
        breakdown = []
        
        for entry in entries:
            # Validate required fields
            if not all(key in entry for key in ["name", "amount", "unit"]):
                return jsonify({"error": "Missing required fields"}), 400
            
            try:
                emission = calculator.calculate_emission(
                    entry["name"],
                    float(entry["amount"]),
                    entry["unit"],
                    entry.get("importLocation", "local")
                )
                total_emission += emission
                breakdown.append({
                    "ingredient": entry["name"],
                    "emission": emission
                })
            except ValueError as e:
                return jsonify({"error": str(e)}), 400
            
        return jsonify({
            "total_emission": total_emission,
            "breakdown": breakdown
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Transportation emissions

@app.route("/transport-emissions", methods=["POST"])
def transport_emissions():
    data = request.json
    import_location = data.get("import_location")
    user_coords = data.get("user_coords")
    mass_kg = data.get("mass_kg", 1)
    transport_mode = data.get("transport_mode", "sea")

    try:
        # Geocode import location
        import_coords = calculator.geocode_location(import_location)
        if not import_coords:
            return jsonify({"error": "Invalid import location"}), 400

        print(f"🌍 Import Location {import_location} -> {import_coords}")  # Debugging line
        print(f"📍 User Location -> {user_coords}")  # Debugging line

        # ✅ Explicitly ensure `haversine_distance()` exists
        if not hasattr(calculator, "haversine_distance"):
            print("❌ ERROR: haversine_distance() is missing in CarbonCalculator!")
            return jsonify({"error": "haversine_distance method not found"}), 500

        
        # Calculate distance
        distance_km = calculator.haversine_distance(user_coords, import_coords)

        # Calculate emissions
        emissions = calculator.calculate_transport_emission(
            distance_km, transport_mode, mass_kg
        )

        return jsonify({
            "distance_km": distance_km,
            "emissions": emissions
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
'''
# Debug
@app.route("/debug-geocode", methods=["GET"])
def debug_geocode():
    location = request.args.get("location", "Spain")
    coords = calculator.geocode_location(location)
    return jsonify({"location": location, "coordinates": coords})
'''

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)
