import pandas as pd
import requests
from math import radians, sin, cos, sqrt, atan2
import os, difflib 

class CarbonCalculator:
    def __init__(self, csv_path):
        # Load CSV and clean column names
        self.data = pd.read_csv(csv_path, encoding="ISO-8859-1")
        self.data.columns = self.data.columns.str.strip().str.lower()  # Standardize column names
        self.data["ingredient"] = self.data["ingredient"].str.lower()  # Convert ingredients to lowercase

    def get_impact_factors(self, ingredient_name):
        """Find impact factors for an ingredient using partial matching if no exact match exists."""
        ingredient_name = ingredient_name.lower()

        # Try exact match first
        match = self.data[self.data["ingredient"] == ingredient_name]
        if not match.empty:
            return match.iloc[0].to_dict()  # Return first exact match

        # Use fuzzy matching to find a close match
        all_ingredients = self.data["ingredient"].tolist()
        closest_match = difflib.get_close_matches(ingredient_name, all_ingredients, n=1, cutoff=0.3)

        if closest_match:
            print(f"🔍 No exact match for '{ingredient_name}', using closest match: '{closest_match[0]}'")
            match = self.data[self.data["ingredient"] == closest_match[0]]
            return match.iloc[0].to_dict()

        print(f"❌ No suitable match found for: {ingredient_name}")
        return None  # No match found
    
    def calculate_emission(self, ingredient_name, amount, unit="g", import_location="Local"):
        """
        Calculate total GHG emissions for a given ingredient.
        - Uses impact factors from dataset
        - Converts amount to kilograms
        - Adds transport emissions if imported
        """
        impact_factors = self.get_impact_factors(ingredient_name)
        if not impact_factors:
            return None  # No valid match found

        # Convert amount to kg
        if unit.lower() in ["g", "grams"]:
            amount_kg = amount / 1000
        elif unit.lower() in ["kg", "kilograms"]:
            amount_kg = amount
        elif unit.lower() in ["lb", "pounds"]:
            amount_kg = amount * 0.453592  # 1 pound = 0.453592 kg
        elif unit.lower() in ["oz", "ounces"]:
            amount_kg = amount * 0.0283495  # 1 ounce = 0.0283495 kg
        elif unit.lower() in ["cup", "cups"]:
            amount_kg = amount * 0.24  # Approximate, varies by ingredient
        elif unit.lower() in ["l", "liter", "liters"]:
            amount_kg = amount  # Assuming water density (1L ≈ 1kg)
        elif unit.lower() in ["tb", "tbsp", "tablespoon", "tablespoons"]:
            amount_kg = amount * 0.015  # Approximate, varies by ingredient
        else:
            print(f"❌ Unsupported unit: {unit}")
            return None

        # Sum up GHG emissions (kg CO2eq per kg ingredient)
        total_ghg_per_kg = (
            impact_factors.get("ghg (kg co2eq, ipcc 2013) luc", 0) +
            impact_factors.get("ghg (kg co2eq, ipcc 2013) feed", 0) +
            impact_factors.get("ghg (kg co2eq, ipcc 2013) farm", 0) +
            impact_factors.get("ghg (kg co2eq, ipcc 2013) processing", 0) +
            impact_factors.get("ghg (kg co2eq, ipcc 2013) transport", 0) +
            impact_factors.get("ghg (kg co2eq, ipcc 2013) packging", 0) +
            impact_factors.get("ghg (kg co2eq, ipcc 2013) retail", 0)
        )

        ingredient_emission = total_ghg_per_kg * amount_kg

        # If ingredient is imported, add transport emissions
        if import_location.lower() != "local":
            transport_emission = self.calculate_transport_emission(import_location, amount_kg)
            ingredient_emission += transport_emission

        return round(ingredient_emission, 2)  # Return result rounded to 2 decimal places


    def geocode_location(self, location_name):
        """Convert location name to coordinates using OpenCage API."""
        try:
            country = location_name.strip().title()
            url = "https://api.opencagedata.com/geocode/v1/json"
            api_key = os.getenv("OPENCAGE_API_KEY")  # Explicitly fetch API key

            if not api_key:
                print("❌ ERROR: OPENCAGE_API_KEY is missing!")
                return None

            params = {
                "q": country,
                "key": api_key,  # Pass the API key here
                "limit": 1
            }
            headers = {"User-Agent": "YourAppName/1.0 (your@email.com)"}

            response = requests.get(url, params=params, headers=headers)
            
            #print(f"Geocoding API Response for {country}: {response.status_code} - {response.text}")  # Debug

            if response.status_code != 200:
                print(f"Geocoding API error: {response.status_code}, {response.text}")
                return None

            data = response.json()
            if "results" not in data or not data["results"]:
                print(f"Geocoding failed: No results for {location_name}")
                return None
            
            # Extract lat/lon
            result = data["results"][0]["geometry"]
            lat, lon = result["lat"], result["lng"]

            print(f"Geocoding success: {country} -> ({lat}, {lon})")
            return {"lat": lat, "lon": lon}

        except Exception as e:
            print(f"Geocoding error for {location_name}: {e}")
            return None
'''

        # distance
    def haversine_distance(self, coord1, coord2):
        """Calculate distance between two coordinates (in km)."""
        print(f"Calculating distance between: {coord1} and {coord2}")  # Debugging

        if not coord1 or not coord2:
            print("❌ ERROR: One of the coordinates is None!")
            return 0

        from math import radians, sin, cos, sqrt, atan2

        lat1, lon1 = radians(coord1["lat"]), radians(coord1["lon"])
        lat2, lon2 = radians(coord2["lat"]), radians(coord2["lon"])

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))

        distance = 6371 * c  # Earth radius in km
        print(f"✅ Calculated Distance: {distance:.2f} km")

        return distance

    def calculate_transport_emission(self, distance_km, transport_mode="sea", mass_kg=1):
        """Calculate emissions from transportation."""
        emission_factor = self.transport_emission_factors.get(transport_mode, 0.01)
        return distance_km * mass_kg * emission_factor  # kg CO₂
        
    def calculate_emission(self, ingredient, amount, unit, import_location):
        # Validate ingredient
        if not ingredient or not isinstance(ingredient, str):
            raise ValueError("Invalid ingredient name")

        # Rest of the code remains the same
        ingredient_data = self.data[self.data['ingredient'].str.lower() == ingredient.lower()]
        if ingredient_data.empty:
            raise ValueError(f"Ingredient '{ingredient}' not found in the dataset.")

        emission_factor = ingredient_data['emission_factor'].values[0]  # kg CO₂ per kg of food

        # Adjust emission factor based on import location (if necessary)
        if import_location.lower() != "local":
            emission_factor += 0.1

        # Calculate total emissions
        total_emission = amount * emission_factor
        return total_emission
'''
