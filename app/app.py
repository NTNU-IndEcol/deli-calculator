from flask import Flask, request, jsonify, send_from_directory
from backend.carbon_calculator import CarbonCalculator
from dotenv import load_dotenv
import os

load_dotenv()  # Load .env file

API_KEY = os.getenv("OPENCAGE_API_KEY")

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
            emission = calculator.calculate_emission(
                entry.get("ingredient"),
                float(entry.get("amount")),
                entry.get("unit"),
                entry.get("importLocation")
            )
            total_emission += emission
            breakdown.append({
                "ingredient": entry.get("ingredient"),
                "emission": emission
            })
            
        return jsonify({
            "total_emission": total_emission,
            "breakdown": breakdown
        })
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

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
