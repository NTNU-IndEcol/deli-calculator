import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
from fractions import Fraction
import os
import re
ALLOWED_DOMAINS = ['koreanbapsang.com', 'your-recipesite.com', 'simplehomeedit.com']

RECIPE_FILE = "backend/data/recipes.json"

def validate_url(url):
    """Ensure URL is from allowed domains"""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.netloc not in ALLOWED_DOMAINS:
        raise ValueError(f"Domain {parsed.netloc} not allowed")
    return True

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

def extract_main_ingredient(name):
    """Extract the main component from ingredient name, handling alternatives."""
    descriptors = {
        'size': ['medium', 'small', 'large', 'jumbo', 'baby', 'piece', 'pieces'],
        'state': ['fresh', 'dried', 'dry', 'minced', 'chopped', 'sliced', 
                 'thinly', 'shaved', 'divided', 'optional', 'to taste', 'marinated'],
        'type': ['korean', 'asian', 'plump', 'thumb-sized', 'soup', 'other'],
        'preparation': ['thinly sliced', 'shaved', 'sliced', 'minced', 'grated', 'crushed']
    }
    
    # Split into alternatives separated by 'or'
    alternatives = re.split(r'\s+or\s+', name, flags=re.IGNORECASE)
    main_ingredients = []
    
    for alt in alternatives:
        # Clean the alternative
        clean_alt = re.sub(
            r'\([^)]*\)|[\d%]+|-\s*|(\b(?:optional|to taste)\b)',
            '', 
            alt, 
            flags=re.IGNORECASE
        ).strip(' -')
        
        
        # Remove preparation terms from the start (e.g., "thinly sliced")
        prep_pattern = r'^\s*(?:' + '|'.join(descriptors['preparation']) + r')\s+'
        clean_alt = re.sub(prep_pattern, '', clean_alt, flags=re.IGNORECASE)
        
        # Split into words and filter descriptors
        words = [
            word.lower() for word in clean_alt.split() 
            if word.lower() not in [item for sublist in descriptors.values() for item in sublist]
        ]
        
        # Join remaining words to form the main ingredient
        main_ingredient = ' '.join(words) if words else clean_alt
        
        # Handle compound terms (e.g., "pork belly" → "pork")
        if ' ' in main_ingredient:
            parts = main_ingredient.split()
            if parts[0] in ['pork', 'beef', 'chicken']:  # Known meat bases
                main_ingredient = parts[0]
        
        # Singularize
        if main_ingredient.endswith('s'):
            main_ingredient = main_ingredient.rstrip('s')
            
        main_ingredients.append(main_ingredient.capitalize())
    
    return ' or '.join(main_ingredients)

def map_to_si_unit(name, unit):
    """Convert units to grams and return (standard_unit, conversion_factor)."""
    unit = unit.lower().strip('s')
    name = name.lower()
    
    conversion_map = {
        # Weight conversions
        'pound': ('g', 453.592),
        'lb': ('g', 453.592),
        'ounce': ('g', 28.3495),
        'oz': ('g', 28.3495),
        'kg': ('g', 1000),
        'g': ('g', 1),
        'gram': ('g', 1),
        
        # Volume conversions
        'cup': ('cup', 1),
        'tablespoon': ('tbsp', 1),
        'teaspoon': ('tsp', 1),
        'tsp': ('tsp', 1),
        'dl': ('dl', 1),
        'Liter': ('L', 1),

        # Special food items
        'package': ('g', 400),        # Tofu package standard size
        'head': ('unit', 1),          # e.g., head of lettuce
        'bunch': ('bunch', 1),
        'clove': ('clove', 1),
        'slice': ('slice', 1)
    }

    # Check direct unit matches first
    for key, (std_unit, factor) in conversion_map.items():
        if key == unit:
            return (std_unit, factor)

    # Check for unit clues in ingredient name
    if any(x in name for x in ['lb', 'pound']):
        return ('g', 453.592)
    if any(x in name for x in ['oz', 'ounce']):
        return ('g', 28.3495)
    if 'package' in name and 'tofu' in name:
        return ('g', 400)

    # Default for unknown units
    return ('unit', 1)

def clean_ingredient_text(ingredient):
    """Convert ingredients to standardized units with gram conversion."""
    amount_text = ingredient.select_one('.wprm-recipe-ingredient-amount')
    unit_text = ingredient.select_one('.wprm-recipe-ingredient-unit')
    name_text = ingredient.select_one('.wprm-recipe-ingredient-name')

    # Parse original values
    raw_amount = parse_amount(amount_text.get_text(strip=True)) if amount_text else None
    raw_unit = unit_text.get_text(strip=True) if unit_text else ''
    raw_name = name_text.get_text(strip=True) if name_text else ''

    # Get standardized unit and conversion
    std_unit, conversion_factor = map_to_si_unit(raw_name, raw_unit)
    
    # Convert amount to grams if applicable
    final_amount = raw_amount * conversion_factor if std_unit == 'g' and raw_amount else raw_amount
    
    # Handle special cases
    if 'marinated' in raw_name.lower() and std_unit == 'g':
        final_amount *= 1.2  # Account for marinade weight
    
    return {
       # "amount": final_amount,
       # "unit": std_unit,
        "name": extract_main_ingredient(raw_name),
       # "original_text": f"{raw_amount} {raw_unit} {raw_name}".strip() if raw_amount else raw_name
        "amount": raw_amount,
        "unit": raw_unit,
        "original_text": f"{raw_name}".strip() if raw_amount else raw_name
    }




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
        #"recipeIngredient": ingredients,
        "recipeIngredient": [{
            "mainIngredient": ingredient["name"],
            "details": {
                "amount": ingredient["amount"],
                "unit": ingredient["unit"],
                "originalText": ingredient["original_text"]
            }
        } for ingredient in ingredients],    
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