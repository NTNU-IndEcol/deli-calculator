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

# API endpoint for calculations
@app.route("/calculate", methods=["POST"])
def calculate():
    data = request.json
    ingredient = data.get("ingredient")
    amount = float(data.get("amount"))
    unit = data.get("unit")
    import_location = data.get("import_location")

    try:
        emission = calculator.calculate_emission(ingredient, amount, unit, import_location)
        return jsonify({"emission": emission})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)
