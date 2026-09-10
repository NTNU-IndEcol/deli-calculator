# backend/routes.py
from flask import Blueprint, jsonify, request, send_file, Flask
import os, json
from .extract_recipe import extract_recipe_data, save_recipe

api_bp = Blueprint('api', __name__, url_prefix='/api')

# 🔥 FIXED: Use recipe.json (singular) to match app.py
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECIPE_FILE = os.path.join(BASE_DIR, 'backend', 'data', 'recipe.json')
RECIPES_DIR = os.path.join(BASE_DIR, 'backend', 'data', 'recipes')

print(f"🔍 [routes.py] RECIPE_FILE: {RECIPE_FILE}")

def save_recipe(recipe_data):
    """Save recipe to recipe.json file with validation"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(RECIPE_FILE), exist_ok=True)
        
        # Validate recipe structure
        if not isinstance(recipe_data, dict) or 'recipeIngredient' not in recipe_data:
            raise ValueError("Invalid recipe format")
            
        # Write to file (using recipe.json)
        with open(RECIPE_FILE, 'w', encoding='utf-8') as f:
            json.dump(recipe_data, f, indent=2, ensure_ascii=False)
            
        print(f"✅ Saved recipe to: {RECIPE_FILE}")
        return True
    except Exception as e:
        print(f"❌ Save error: {str(e)}")
        return False
    
@api_bp.route('/process-recipe', methods=['POST'])
def process_recipe():
    """Extract recipe from URL and save to recipe.json"""
    try:
        data = request.get_json()
        url = data.get('url')
        
        if not url:
            return jsonify({'success': False, 'error': 'No URL provided'})
        
        recipe = extract_recipe_data(url)
        
        if recipe:
            save_recipe(recipe)
            return jsonify({
                'success': True, 
                'recipe': recipe,
                'ingredients': recipe.get('recipeIngredient', [])
            })
        else:
            return jsonify({
                'success': False, 
                'error': 'Failed to extract recipe from URL. The site might use an unsupported format.'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# 🔥 REMOVED: This route was conflicting with app.py
# The /saved-recipes route is now ONLY in app.py
# This blueprint should NOT define /saved-recipes
# @api_bp.route('/saved-recipes', methods=['GET'])
# def get_saved_recipes():
#     ...

# 🔥 REMOVED: This route was also conflicting
# Load-recipe is now ONLY in app.py
# @api_bp.route('/load-recipe', methods=['POST'])
# def load_recipe():
#     ...

    
def get_data_path(filename):
    return os.path.join(os.path.dirname(__file__), 'data', filename)

@api_bp.route('/config/data-paths.json')
def get_data_config():
    return send_file(get_data_path('data-paths.json'))

@api_bp.route('/data/<path:filename>')
def serve_data_file(filename):
    return send_file(get_data_path(filename))

@api_bp.route('/detect-location')
def detect_location():
    # You might want to handle this server-side instead
    return jsonify({
        'country_name': 'China',
        'country_code_iso3': 'NOR'
    })