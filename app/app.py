# app.py - Flask entry point
from flask import Flask, request, render_template, jsonify, send_file, send_from_directory # type: ignore
from flask_cors import CORS # type: ignore
import os
import shutil
import json
from metrics import metrics_bp

# Import Blueprints
from backend.routes import api_bp
from backend.feedback import feedback_bp
from backend.recipes import recipes_bp
from backend.env_data_loader import env_data_bp, load_env_impact_files
from backend.metrics.init_db import init_database

# Initialize Flask app with custom folders
app = Flask(__name__,
            static_folder='frontend/static',
            template_folder='frontend/templates')
CORS(app)

# ============================================
# Recipe File Paths Configuration
# ============================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RECIPE_FILE = os.path.join(BASE_DIR, 'backend', 'data', 'recipe.json')
RECIPES_DIR = os.path.join(BASE_DIR, 'backend', 'data', 'recipes')

# Load environmental data at startup
print("\n🚀 Loading environmental impact data...")
load_env_impact_files()
print("✅ Environmental data ready!")

# Initialize database on startup
try:
    init_database()
    print("✅ Database ready")
except Exception as e:
    print(f"❌ Database initialization error: {e}")

# Register Blueprints
app.register_blueprint(api_bp, url_prefix='/api')
app.register_blueprint(feedback_bp)
app.register_blueprint(recipes_bp)
app.register_blueprint(env_data_bp)
app.register_blueprint(metrics_bp)

# Cloudflare Turnstile Configuration
app.config['TURNSTILE_SITEKEY'] = os.environ.get('TURNSTILE_SITEKEY')
app.config['TURNSTILE_SECRET'] = os.environ.get('TURNSTILE_SECRET')

# ============================================
# Main Routes
# ============================================
@app.route('/')
def index():
    """Serve the main interface"""
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/feedback', methods=['GET', 'POST'])
def feedback():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        issue_type = request.form.get('issue_type')
        subject = request.form.get('subject')
        message = request.form.get('message')
        
        # TODO: Add your form processing logic here
        
        return jsonify({'success': True, 'message': 'Feedback submitted successfully!'})
    
    return render_template('feedback.html')

@app.route('/config/data-paths.json')
def serve_config():
    return send_file('config/data-paths.json')

# ============================================
# Recipe Management API Routes
# ============================================

@app.route("/api/saved-recipes", methods=["GET"])
def get_saved_recipes():
    """
    Returns the current active recipe from recipe.json
    """
    try:
        if not os.path.exists(RECIPE_FILE):
            return jsonify({
                'success': False,
                'message': 'No recipe currently loaded'
            }), 404
        
        # Read and return the recipe
        with open(RECIPE_FILE, 'r', encoding='utf-8') as f:
            recipe_data = json.load(f)
        
        return jsonify(recipe_data), 200
        
    except json.JSONDecodeError as e:
        app.logger.error(f"Invalid JSON in recipe file: {str(e)}")
        return jsonify({
            'success': False, 
            'error': 'Invalid recipe format'
        }), 400
        
    except Exception as e:
        app.logger.error(f"Error loading recipe: {str(e)}")
        return jsonify({
            'success': False, 
            'error': str(e)
        }), 500


@app.route('/api/load-recipe', methods=['POST'])
def load_recipe():
    """
    Loads a specific recipe from the recipes/ folder and copies it to recipe.json
    This makes it the "active" recipe that the app displays
    """
    try:
        data = request.get_json()
        recipe_name = data.get('recipe')
        
        if not recipe_name:
            return jsonify({
                'success': False, 
                'message': 'No recipe specified'
            }), 400
        
        # Source and target paths
        source_file = os.path.join(RECIPES_DIR, f"{recipe_name}.json")
        target_file = RECIPE_FILE
        
        # Check if source recipe exists
        if not os.path.exists(source_file):
            app.logger.error(f"Recipe file not found: {source_file}")
            return jsonify({
                'success': False, 
                'message': f'Recipe "{recipe_name}" not found in library'
            }), 404
        
        # Read and validate source JSON
        try:
            with open(source_file, 'r', encoding='utf-8') as f:
                recipe_data = json.load(f)
        except json.JSONDecodeError as e:
            app.logger.error(f"Invalid JSON in {source_file}: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'Recipe file has invalid JSON format'
            }), 400
        
        # Copy to active recipe file
        shutil.copyfile(source_file, target_file)
        
        # Verify the copy was successful
        if not os.path.exists(target_file):
            app.logger.error(f"Copy failed - target file doesn't exist!")
            return jsonify({
                'success': False,
                'message': 'Failed to copy recipe file'
            }), 500
        
        recipe_name_display = recipe_data.get('name', recipe_name)
        app.logger.info(f"Successfully loaded recipe: {recipe_name_display}")
        
        return jsonify({
            'success': True, 
            'message': f'Recipe "{recipe_name_display}" loaded successfully',
            'recipe': recipe_data
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error in load_recipe: {str(e)}")
        return jsonify({
            'success': False, 
            'message': str(e)
        }), 500


@app.route('/api/recipes/list', methods=['GET'])
def list_recipes():
    """
    Returns a list of all available recipes in the recipes/ folder
    Used by the recipes gallery page
    """
    try:
        if not os.path.exists(RECIPES_DIR):
            os.makedirs(RECIPES_DIR, exist_ok=True)
            return jsonify({
                'success': True, 
                'recipes': [],
                'count': 0
            })
        
        recipes = []
        
        for filename in os.listdir(RECIPES_DIR):
            if not filename.endswith('.json'):
                continue
            
            file_path = os.path.join(RECIPES_DIR, filename)
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    recipe_data = json.load(f)
                
                recipes.append({
                    'id': filename.replace('.json', ''),
                    'name': recipe_data.get('name', filename.replace('.json', '')),
                    'description': recipe_data.get('description', ''),
                    'category': recipe_data.get('category', ['Main Course']),
                    'image': recipe_data.get('image'),
                    'servings': recipe_data.get('recipeYield', ['4'])[0] if recipe_data.get('recipeYield') else '4',
                    'ingredientCount': len(recipe_data.get('recipeIngredient', []))
                })
                
            except Exception as e:
                app.logger.warning(f"Could not load recipe {filename}: {str(e)}")
                continue
        
        recipes.sort(key=lambda x: x['name'])
        
        return jsonify({
            'success': True,
            'recipes': recipes,
            'count': len(recipes)
        })
        
    except Exception as e:
        app.logger.error(f"Error listing recipes: {str(e)}")
        return jsonify({
            'success': False, 
            'error': str(e)
        }), 500

# ============================================
# Data Serving Routes
# ============================================
@app.route('/backend/data/<path:filename>')
def serve_backend_data(filename):
    return send_from_directory('backend/data', filename)

@app.route('/backend/data/FABIO_DELI/<path:filename>')
def serve_fabio_deli_data(filename):
    return send_from_directory('backend/data/FABIO_DELI', filename)

# ============================================
# Development Helper
# ============================================
def list_routes():
    """Print all registered routes (useful for debugging)"""
    if app.debug:
        print("\n" + "="*60)
        print("📋 Registered Routes:")
        print("="*60)
        for rule in app.url_map.iter_rules():
            methods = ','.join(sorted(rule.methods - {'HEAD', 'OPTIONS'}))
            print(f"{methods:10s} {rule.rule}")
        print("="*60 + "\n")

if __name__ == "__main__":
    # Print routes in debug mode
    list_routes()
    
    app.run(host="0.0.0.0", port=9000, debug=True)