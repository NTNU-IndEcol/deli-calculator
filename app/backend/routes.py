# backend/routes.py
from flask import Blueprint, jsonify, request, send_file, Flask # type: ignore
import os, json
from .extract_recipe import extract_recipe_data, save_recipe # type: ignore

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