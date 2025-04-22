import pandas as pd
import json
from fuzzywuzzy import process, fuzz
import csv

# Configuration
RECIPE_FILE = "./data/recipes.json"
DATABASE_FILE = "./data/food_item_poore_and_nemecek_fabio.csv"
NEW_INGREDIENTS_FILE = "./data/new_ingredients.csv"
SIMILARITY_THRESHOLD = 80  # Minimum match confidence percentage

def load_data():
    """Load recipe and database files"""
    with open(RECIPE_FILE) as f:
        recipe = json.load(f)
    
    db = pd.read_csv(DATABASE_FILE)
    return recipe, db

def find_closest_match(ingredient, database_names):
    """Find best match using fuzzy string matching"""
    matches = process.extractBests(
        ingredient,
        database_names,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=SIMILARITY_THRESHOLD
    )
    return matches[0] if matches else (None, 0)

def match_ingredients(recipe, db):
    """Match recipe ingredients to database"""
    database_names = db['Ingredient'].str.lower().tolist()
    matches = []
    new_ingredients = []
    
    for item in recipe['recipeIngredient']:
        ingredient = item['mainIngredient'].lower()
        match, score = find_closest_match(ingredient, database_names)
        
        if match:
            db_entry = db[db['Ingredient'].str.lower() == match].iloc[0].to_dict()
            matches.append({
                'recipe_ingredient': item['mainIngredient'],
                'matched_ingredient': db_entry['Ingredient'],
                'similarity_score': score,
                'database_data': db_entry
            })
        else:
            new_ingredients.append({
                'recipe_ingredient': item['mainIngredient'],
                'original_details': item['details'],
                'suggested_category': '',
                'notes': ''
            })
    
    return matches, new_ingredients

def save_new_ingredients(new_ingredients):
    """Save unmatched ingredients to CSV for review"""
    if new_ingredients:
        with open(NEW_INGREDIENTS_FILE, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=new_ingredients[0].keys())
            writer.writeheader()
            writer.writerows(new_ingredients)

def main():
    recipe, db = load_data()
    matches, new_ingredients = match_ingredients(recipe, db)
    save_new_ingredients(new_ingredients)
    
    print(f"Matched {len(matches)} ingredients:")
    for match in matches:
        print(f"- {match['recipe_ingredient']} → {match['matched_ingredient']} ({match['similarity_score']}%)")
    
    if new_ingredients:
        print(f"\n{len(new_ingredients)} new ingredients saved to {NEW_INGREDIENTS_FILE}")

if __name__ == "__main__":
    main()