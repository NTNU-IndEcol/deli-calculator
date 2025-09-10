# app.py - Flask entry point
from flask import Flask, request, render_template, jsonify, send_file, send_from_directory
from backend.routes import api_bp  # Import API Blueprint
from flask_cors import CORS
import os, json, csv
import shutil

# Initialize Flask app with custom folders
app = Flask(__name__,
            static_folder='frontend/static',
            template_folder='frontend/templates')
CORS(app)

# Register API Blueprint with URL prefix
app.register_blueprint(api_bp, url_prefix='/api')

# Load dataset paths config once
#with open("config/data-paths.json", "r") as f:
#    DATA_PATHS = json.load(f)["datasets"]

# Main route serving the frontend
@app.route('/')
def index():
    """Serve the main interface"""
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')  # You'll need to create this template

@app.route('/feeback')
def feedback():
    """Serve the recipes gallery page"""
    return render_template('feeback.html')

@app.route('/recipes')
def recipes():
    """Serve the recipes gallery page"""
    return render_template('recipes.html')

def list_routes():
    return jsonify([str(rule) for rule in app.url_map.iter_rules()])

@app.route('/config/data-paths.json')
def serve_config():
    return send_file('config/data-paths.json')


@app.route("/api/saved-recipes", methods=["GET"])
def get_saved_recipes():
    try:
        return jsonify({"recipes": []})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/backend/data/<path:filename>')
def serve_backend_data(filename):
    return send_from_directory('backend/data', filename)

@app.route('/api/load-recipe', methods=['POST'])
def load_recipe():
    try:
        data = request.get_json()
        recipe_name = data.get('recipe')
        
        if not recipe_name:
            return jsonify({'success': False, 'message': 'No recipe specified'})
        
        # Path to the recipe files - using absolute paths for clarity
        base_dir = os.path.dirname(os.path.abspath(__file__))
        recipe_file = os.path.join(base_dir, 'backend', 'data', 'recipes', f"{recipe_name}.json")
        target_file = os.path.join(base_dir, 'backend', 'data', 'recipes.json')
        
        # Debugging: Print paths to check
        #print(f"Looking for recipe file: {recipe_file}")
        #print(f"Target file: {target_file}")
        
        # Check if the recipe file exists
        if not os.path.exists(recipe_file):
            print(f"Recipe file not found: {recipe_file}")
            return jsonify({'success': False, 'message': 'Recipe not found'})
        
        # Copy the file
        shutil.copyfile(recipe_file, target_file)
        print(f"Successfully copied {recipe_file} to {target_file}")
        
        return jsonify({
            'success': True, 
            'message': 'Recipe loaded successfully'
        })
        
    except Exception as e:
        print(f"Error in load_recipe: {str(e)}")
        return jsonify({'success': False, 'message': str(e)})

# The saved recipes in the backend
@app.route('/recipes_list')
def recipes_list():
    """Serve the recipes gallery page with dynamic recipe data"""
    try:
        # Use absolute path to ensure we're looking in the right location
        base_dir = os.path.dirname(os.path.abspath(__file__))
        recipes_dir = os.path.join(base_dir, 'backend', 'data', 'recipes')
        images_dir = os.path.join(base_dir, 'backend', 'data', 'recipes', 'images')
        
        # Debug output - check if directories exist
        print(f"Looking for recipes in: {recipes_dir}")
        print(f"Directory exists: {os.path.exists(recipes_dir)}")
        
        if os.path.exists(recipes_dir):
            print(f"Files in recipes directory: {os.listdir(recipes_dir)}")
        
        recipes_data = []
        
        # Create images directory if it doesn't exist
        os.makedirs(images_dir, exist_ok=True)
        
        # Check if recipes directory exists
        if not os.path.exists(recipes_dir):
            return render_template('recipes.html', recipes=[])
        
        # Read all recipe files
        for filename in os.listdir(recipes_dir):
            if filename.endswith('.json') and filename != 'recipes.json':
                try:
                    filepath = os.path.join(recipes_dir, filename)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        recipe_data = json.load(f)
                        recipe_data['id'] = filename.replace('.json', '')
                        
                        # Set default values if they don't exist
                        recipe_data.setdefault('category', 'all')
                        recipe_data.setdefault('servings', 4)
                        recipe_data.setdefault('time', 30)
                        
                        # Check if image exists
                        image_name = recipe_data.get('image', f"{recipe_data['id']}.jpg")
                        image_path = os.path.join(images_dir, image_name)
                        if os.path.exists(image_path):
                            recipe_data['image'] = image_name
                        else:
                            recipe_data['image'] = None
                            
                        recipes_data.append(recipe_data)
                except Exception as e:
                    print(f"Error reading recipe file {filename}: {e}")
        
        print(f"Found {len(recipes_data)} recipes")
        return render_template('recipes.html', recipes=recipes_data)
        
    except Exception as e:
        print(f"Error in recipes route: {e}")
        return render_template('recipes.html', recipes=[])
# Add this route to serve recipe images
@app.route('/recipe-image/<filename>')
def recipe_image(filename):
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        images_dir = os.path.join(base_dir, 'backend', 'data', 'recipes', 'images')
        
        # Check if file exists
        if not os.path.exists(os.path.join(images_dir, filename)):
            # Return a default image or 404
            return send_from_directory('static', 'images/recipe-placeholder.jpg')
            
        return send_from_directory(images_dir, filename)
    except Exception as e:
        print(f"Error serving image {filename}: {e}")
        return send_from_directory('static', 'images/recipe-placeholder.jpg')
        images_dir = os.path.join(base_dir, 'backend', 'data', 'recipes', 'images')

'''
@app.route("/api/load-dataset", methods=["GET"])
def load_dataset():
    try:
        key = request.args.get("key")
        country = request.args.get("country", None)

        if key not in DATA_PATHS:
            return jsonify({"error": f"Invalid dataset key: {key}"}), 400

        path_template = DATA_PATHS[key]
        path = path_template.replace("{country}", country.replace(" ", "_")) if "{country}" in path_template else path_template

        if not os.path.isfile(path):
            return jsonify({"error": f"File not found: {path}"}), 404

        # Load CSV
        with open(path, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            data = list(reader)

        return jsonify({key: data})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

'''
    

    
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)