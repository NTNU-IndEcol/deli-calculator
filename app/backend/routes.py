# backend/routes.py
from flask import Blueprint, jsonify, request, send_file, Flask
import os, json, sys
from .extract_recipe import extract_recipe_data, save_recipe

api_bp = Blueprint('api', __name__, url_prefix='/api')

# File path for storing recipes
RECIPES_FILE = os.path.join(os.path.dirname(__file__), 'data', 'recipes.json')

def save_recipe(recipe_data):
    """Save recipe to JSON file with validation"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(RECIPES_FILE), exist_ok=True)
        
        # Validate recipe structure
        if not isinstance(recipe_data, dict) or 'recipeIngredient' not in recipe_data:
            raise ValueError("Invalid recipe format")
            
        # Write to file
        with open(RECIPES_FILE, 'w') as f:
            json.dump(recipe_data, f, indent=2)
            
        return True
    except Exception as e:
        print(f"Save error: {str(e)}")
        return False
    
@api_bp.route('/process-recipe', methods=['POST'])
def process_recipe():
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'Missing URL parameter'}), 400
        
        url = data['url']
        
        # Validate URL format
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                return jsonify({'error': 'Invalid URL format'}), 400
        except:
            return jsonify({'error': 'Invalid URL format'}), 400
        
        # Validate and extract recipe
        recipe = extract_recipe_data(url)
        if not recipe:
            return jsonify({'error': 'Failed to extract recipe from URL. The site might use an unsupported format.'}), 400
        
        # Check if we got meaningful data
        if not recipe.get('recipeIngredient') or len(recipe['recipeIngredient']) == 0:
            return jsonify({'error': 'No ingredients found in the recipe'}), 400
        
        # Save the recipe
        save_recipe(recipe)
        
        # Format ingredients for frontend
        formatted_ingredients = []
        for ingredient in recipe.get('recipeIngredient', []):
            formatted_ingredients.append({
                'id': f"ing_{len(formatted_ingredients)}",
                'name': ingredient.get('mainIngredient', ''),
                'amount': ingredient.get('details', {}).get('amount'),
                'unit': ingredient.get('details', {}).get('unit'),
                'original_text': ingredient.get('details', {}).get('originalText', ''),
                'matched': False
            })
        
        return jsonify({
            'success': True,
            'recipe': recipe,
            'ingredients': formatted_ingredients
        })
        
    except Exception as e:
        print(f"Error processing recipe: {e}")
        return jsonify({'error': f'Recipe extraction failed: {str(e)}'}), 400

@api_bp.route('/saved-recipes', methods=['GET'])
def get_saved_recipes():
    try:
        recipe_file = "backend/data/recipes.json"
        if os.path.exists(recipe_file):
            with open(recipe_file, 'r', encoding='utf-8') as f:
                recipe = json.load(f)
            return jsonify(recipe)
        else:
            return jsonify({'error': 'No saved recipes found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    
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

# Add this to your Flask app
app = Flask(__name__)
app.register_blueprint(api_bp)