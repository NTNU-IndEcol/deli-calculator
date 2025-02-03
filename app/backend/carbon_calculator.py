import pandas as pd

class CarbonCalculator:
    def __init__(self, data_path):
        self.data = pd.read_csv(data_path)

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
