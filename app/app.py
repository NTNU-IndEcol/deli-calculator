from flask import Flask, request, jsonify, send_from_directory
from backend.carbon_calculator import CarbonCalculator
import os

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

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)
