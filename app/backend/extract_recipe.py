import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
from fractions import Fraction
import os
import re

RECIPE_FILE = "backend/data/recipes.json"

def parse_amount(amount_text):
    """Convert amount text to a float value."""
    if not amount_text:
        return None

    # Handle 'to taste' cases with an optional amount
    taste_match = re.match(r"(.+?)\s*(to taste)", amount_text, re.IGNORECASE)
    if taste_match:
        fixed_amount = parse_amount(taste_match.group(1))
        return fixed_amount if fixed_amount else "to taste"

    # Handle ranges (e.g., "5 to 6")
    range_match = re.match(r"(\d+)\s*(to|-)\s*(\d+)", amount_text)
    if range_match:
        low = float(range_match.group(1))
        high = float(range_match.group(3))
        return (low + high) / 2  # Average of range

    # Handle fractions (e.g., "1/4")
    try:
        return float(sum(Fraction(s) for s in amount_text.split()))
    except ValueError:
        return None  # Return None if parsing fails

def map_to_si_unit(name, unit):
    """Convert ingredient descriptions into SI units when possible."""
    name = name.lower()
    unit = unit.lower()

    volume_units = ["cup", "cups", "tbsp", "tablespoon", "tsp", "teaspoon", "liter", "l"]
    weight_units = ["lb", "pound", "oz", "ounce", "g", "gram", "kg", "kilogram"]

    # If the unit is already standard, return it
    if unit in volume_units + weight_units:
        return unit

    # Convert descriptive sizes to approximate SI units
    size_map = {
        "medium": "g",
        "small": "g",
        "large": "g",
        "clove": "g",
        "head": "g",
        "stalk": "stalks",
        "slice": "g",
        "leaf": "leaves",
        "chestnuts": "pieces",
        "scallions": "stalks",
    }

    for keyword, si_unit in size_map.items():
        if keyword in name:
            return si_unit

    return ""  # Default to empty if no clear unit is found

def clean_ingredient_text(ingredient):
    """Extract and clean ingredient details."""
    amount_text = ingredient.select_one('.wprm-recipe-ingredient-amount')
    unit_text = ingredient.select_one('.wprm-recipe-ingredient-unit')
    name_text = ingredient.select_one('.wprm-recipe-ingredient-name')

    amount = parse_amount(amount_text.get_text(strip=True) if amount_text else '')
    unit = unit_text.get_text(strip=True) if unit_text else ''
    name = name_text.get_text(strip=True) if name_text else ''

    # Handle 'to taste' properly
    if amount == "to taste":
        unit = "to taste"

    # If unit is missing, infer from name
    if not unit:
        unit = map_to_si_unit(name, unit)

    return {
        "amount": amount,
        "unit": unit,
        "name": name
    }



'''

def clean_ingredient_text(ingredient):
    """Extract and clean ingredient details."""
    amount = ingredient.select_one('.wprm-recipe-ingredient-amount')
    unit = ingredient.select_one('.wprm-recipe-ingredient-unit')
    name = ingredient.select_one('.wprm-recipe-ingredient-name')
    
    cleaned_amount = amount.get_text(strip=True) if amount else ''
    cleaned_unit = unit.get_text(strip=True) if unit else ''
    cleaned_name = name.get_text(strip=True) if name else ''
    
    return {
        "amount": cleaned_amount,
        "unit": cleaned_unit,
        "name": cleaned_name
    }
'''
def clean_time_text(time_text):
    """Clean and standardize time text."""
    match = re.search(r'(\d+)\s*(minutes|hours|seconds|days)', time_text, re.IGNORECASE)
    if match:
        quantity = match.group(1)
        unit = match.group(2).lower()
        if "minute" in unit:
            return f"{quantity} Minutes"
        elif "hour" in unit:
            return f"{quantity} Hours"
        elif "second" in unit:
            return f"{quantity} Seconds"
        elif "day" in unit:
            return f"{quantity} Days"
    return None


def extract_category(soup):
    """Extract the recipe category from the webpage."""
    sub_menu = soup.select_one('ul.sub-menu .current-menu-parent a span')
    return sub_menu.get_text(strip=True) if sub_menu else None



def extract_recipe_details(url, recipe_id):
    """Extract recipe details from a given URL using the recipe4food logic."""
    response = requests.get(url)
    if response.status_code != 200:
        print(f"Failed to retrieve the URL: {url}")
        return None
    
    soup = BeautifulSoup(response.content, 'html.parser')
    title = soup.find('h1', class_='entry-title').get_text(strip=True)
    category = extract_category(soup) if extract_category(soup) else ""

    ingredients = [clean_ingredient_text(ingredient) for ingredient in soup.select('li.wprm-recipe-ingredient')]
    instructions = [instruction.get_text(strip=True) for instruction in soup.select('div.wprm-recipe-instruction-text')]

    prep_time = soup.find('div', class_='wprm-recipe-prep-time-container')
    cook_time = soup.find('div', class_='wprm-recipe-cook-time-container')
    prep_time_cleaned = clean_time_text(prep_time.get_text(strip=True)) if prep_time else None
    cook_time_cleaned = clean_time_text(cook_time.get_text(strip=True)) if cook_time else None

    servings = soup.find('div', class_='wprm-recipe-servings-container')
    servings = re.search(r'\d+', servings.get_text(strip=True)).group(0) if servings else None

    image_url = soup.find('meta', property='og:image')
    image_url = image_url['content'] if image_url else None

    schema_recipe = {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "id": recipe_id,
        "name": title,
        "author": "Korean Bapsang",
        "datePublished": datetime.now().strftime('%Y-%m-%d'),
        "category": category,
        "recipeIngredient": ingredients,
        "recipeInstructions": [{"@type": "HowToStep", "text": instruction} for instruction in instructions],
        "recipeYield": servings,
        "prepTime": prep_time_cleaned,
        "cookTime": cook_time_cleaned,
        "image": image_url,
        "description": soup.find('meta', attrs={"name": "description"})['content'] if soup.find('meta', attrs={"name": "description"}) else title,
        "environmentalImpact": {  # Placeholder for environmental impact calculations
            "co2Emissions": None,  # Later filled in kg CO2 equivalent
            "waterUse": None       # Later filled in liters
        }
    }

    return schema_recipe

def extract_recipe_data(url):
    """Extract recipe data from a given URL using the recipe4food logic."""
    try:
        print(f"Fetching URL: {url}")
        recipe = extract_recipe_details(url, recipe_id=1)  # Use recipe_id=1 as a placeholder
        if not recipe:
            print("Error: No recipe data found.")
            return None
        return recipe  # Return the extracted recipe data
    except Exception as e:
        print(f"Error extracting recipe: {e}")
        return None
    
def save_recipe(recipe):
    try:
        print("🚀 Saving recipe...")  # Debugging
        os.makedirs(os.path.dirname(RECIPE_FILE), exist_ok=True)

        if not isinstance(recipe, dict):
            raise ValueError("Invalid recipe format: Expected a dictionary.")

        recipe["environmentalImpact"] = {
            "co2Emissions": 0,
            "waterUse": 0
        }

        with open(RECIPE_FILE, "w", encoding="utf-8") as f:
            json.dump(recipe, f, indent=4, ensure_ascii=False)

        print(f"✅ Recipe saved successfully: {recipe['name']}")
    except Exception as e:
        print(f"❌ Error saving recipe: {e}")