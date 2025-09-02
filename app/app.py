# app.py - Flask entry point
from flask import Flask, request, render_template, jsonify, send_file, send_from_directory
from backend.routes import api_bp  # Import API Blueprint
from flask_cors import CORS
import os, json, csv
import os
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