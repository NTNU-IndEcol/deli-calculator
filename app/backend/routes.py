# backend/routes.py
from flask import Blueprint, jsonify, request, send_file
import os, json
from .extract_recipe import extract_recipe_data, save_recipe

api_bp = Blueprint('api', __name__)

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
        # Get URL from POST request
        print("\n=== Received request ===")  # Backend Debug 1
        print("Headers:", request.headers)   # Backend Debug 2
        print("JSON Data:", request.json)    # Backend Debug 3

        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({"error": "Missing URL in request"}), 400
            
        recipe_url = data['url']
        
        # Extract and save recipe
        recipe = extract_recipe_data(recipe_url)
        if not recipe:
            return jsonify({"error": "Recipe extraction failed"}), 400
            
        save_recipe(recipe)
        
        return jsonify({
            "message": "Recipe processed successfully",
            "recipe": recipe
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@api_bp.route('/saved-recipes', methods=['GET'])
def get_saved_recipes():
    """Retrieve saved recipes"""
    try:
        if not os.path.exists(RECIPES_FILE):
            return jsonify({"error": "No recipes found"}), 404
            
        with open(RECIPES_FILE, 'r') as f:
            recipes = json.load(f)
            
        return jsonify(recipes)
        
    except json.JSONDecodeError:
        return jsonify({"error": "Corrupted recipe file"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
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
        'country_name': 'Norway',
        'country_code_iso3': 'NOR'
    })

