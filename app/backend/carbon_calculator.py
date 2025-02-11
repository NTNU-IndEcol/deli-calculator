import pandas as pd
import requests
import pycountry  # <-- NEW: Helps convert country codes to English names
from math import radians, sin, cos, sqrt, atan2
import os

class CarbonCalculator:
    def __init__(self, data_path):
        self.data = pd.read_csv(data_path)
        self.transport_emission_factors = {
            "sea": 0.01,  # kg CO₂ per ton-km (sea freight)
            "air": 0.5,   # kg CO₂ per ton-km (air freight)
            "road": 0.1   # kg CO₂ per ton-km (road freight)
        }

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
        # Convert amount to kg (if necessary)
        if unit.lower() == "g":
            amount = amount / 1000
        elif unit.lower() == "lb":
            amount = amount * 0.453592

        # Lookup emission factor for the ingredient
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
