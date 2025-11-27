# app.py - Flask entry point (Simplified)
from flask import Flask, request, render_template, jsonify, send_file, send_from_directory # type: ignore
from flask_cors import CORS # type: ignore
import os
import shutil


# Import Blueprints
from backend.routes import api_bp
from backend.feedback import feedback_bp
from backend.recipes import recipes_bp
#from backend.get_env_impacts import env_bp  # type: ignore # Add environment impact routes
from backend.env_data_loader import env_data_bp, load_env_impact_files

# Initialize Flask app with custom folders
app = Flask(__name__,
            static_folder='frontend/static',
            template_folder='frontend/templates')
CORS(app)

# NEW: Load data at startup (after Flask app creation)
print("\n🚀 Loading environmental impact data...")
load_env_impact_files()
print("✅ Environmental data ready!\n")

# Register all Blueprints
app.register_blueprint(api_bp, url_prefix='/api')
app.register_blueprint(feedback_bp)
app.register_blueprint(recipes_bp)
#app.register_blueprint(env_bp)  # Register environment impact routes
app.register_blueprint(env_data_bp) # NEW: Register the blueprint

# Cloudflare Turnstile Configuration only
app.config['TURNSTILE_SITEKEY'] = os.environ.get('TURNSTILE_SITEKEY')
app.config['TURNSTILE_SECRET'] = os.environ.get('TURNSTILE_SECRET')

# Main route serving the frontend
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
        # Process the form data
        name = request.form.get('name')
        email = request.form.get('email')
        issue_type = request.form.get('issue_type')
        subject = request.form.get('subject')
        message = request.form.get('message')
        
        # TODO: Add your form processing logic here
        # Save to database, send email, etc.
        
        # Return JSON response for AJAX
        return jsonify({'success': True, 'message': 'Feedback submitted successfully!'})
    
    # If GET request, just render the form
    return render_template('feedback.html')

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

@app.route('/backend/data/FABIO_DELI/<path:filename>')
def serve_fabio_deli_data(filename):
    return send_from_directory('backend/data/FABIO_DELI', filename)

@app.route('/api/load-recipe', methods=['POST'])
def load_recipe():
    try:
        data = request.get_json()
        recipe_name = data.get('recipe')
        
        if not recipe_name:
            return jsonify({'success': False, 'message': 'No recipe specified'})
        
        # Path to the recipe files
        base_dir = os.path.dirname(os.path.abspath(__file__))
        recipe_file = os.path.join(base_dir, 'backend', 'data', 'recipes', f"{recipe_name}.json")
        target_file = os.path.join(base_dir, 'backend', 'data', 'recipes.json')
        
        # Check if the recipe file exists
        if not os.path.exists(recipe_file):
            app.logger.error(f"Recipe file not found: {recipe_file}")
            return jsonify({'success': False, 'message': 'Recipe not found'})
        
        # Copy the file
        shutil.copyfile(recipe_file, target_file)
        app.logger.info(f"Successfully copied {recipe_file} to {target_file}")
        
        return jsonify({
            'success': True, 
            'message': 'Recipe loaded successfully'
        })
        
    except Exception as e:
        app.logger.error(f"Error in load_recipe: {str(e)}")
        return jsonify({'success': False, 'message': str(e)})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9000, debug=True)
    