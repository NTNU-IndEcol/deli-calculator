# backend/recipes.py
import os
import json
from flask import Blueprint, render_template, send_from_directory, current_app # type: ignore

recipes_bp = Blueprint('recipes', __name__)


def classify_recipe_tags(recipe_data):
    """Infer filter tags from ingredient text."""
    ingredients = recipe_data.get('recipeIngredient', []) or []
    ingredient_text = ' '.join(
        f"{item.get('mainIngredient', '')} {item.get('details', {}).get('originalText', '')}".lower()
        for item in ingredients
        if isinstance(item, dict)
    )

    meat_terms = [
        'pork', 'beef', 'ham', 'chicken', 'turkey', 'lamb', 'meat', 'bacon', 'sausage'
    ]
    seafood_terms = [
        'fish', 'salmon', 'tuna', 'shrimp', 'seafood', 'seaweed', 'oyster', 'anchovy'
    ]
    dairy_terms = [
        'milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'ghee'
    ]

    tags = ['all']

    has_meat = any(term in ingredient_text for term in meat_terms)
    has_seafood = any(term in ingredient_text for term in seafood_terms)
    has_dairy = any(term in ingredient_text for term in dairy_terms)

    if has_meat:
        tags.append('meat')
    if has_seafood:
        tags.append('seafood')
    if has_dairy:
        tags.append('dairy')
    if not has_meat and not has_seafood:
        tags.append('vegetarian')

    return tags

def get_recipes_data():
    """Get all recipes data from the recipes directory"""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.dirname(base_dir)  # Go up one level to app root
        recipes_dir = os.path.join(base_dir, 'backend', 'data', 'recipes')
        images_dir = os.path.join(base_dir, 'backend', 'data', 'recipes', 'images')
        
        current_app.logger.debug(f"Looking for recipes in: {recipes_dir}")
        
        recipes_data = []
        
        # Create images directory if it doesn't exist
        os.makedirs(images_dir, exist_ok=True)
        
        # Check if recipes directory exists
        if not os.path.exists(recipes_dir):
            return []
        
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
                        recipe_data.setdefault('prepTime', 30)
                        recipe_data['filter_tags'] = classify_recipe_tags(recipe_data)
                        
                        # Check if image exists. Some recipe files explicitly set image to null.
                        image_name = recipe_data.get('image') or f"{recipe_data['id']}.jpg"
                        image_path = os.path.join(images_dir, image_name)
                        if os.path.exists(image_path):
                            recipe_data['image'] = image_name
                        else:
                            recipe_data['image'] = None
                            
                        recipes_data.append(recipe_data)
                except Exception as e:
                    current_app.logger.error(f"Error reading recipe file {filename}: {e}")
        
        current_app.logger.debug(f"Found {len(recipes_data)} recipes")
        return recipes_data
        
    except Exception as e:
        current_app.logger.error(f"Error in get_recipes_data: {e}")
        return []

@recipes_bp.route('/recipes')
def recipes():
    """Serve the recipes gallery page"""
    recipes_data = get_recipes_data()
    return render_template('recipes.html', recipes=recipes_data)

@recipes_bp.route('/recipes_list')
def recipes_list():
    """Serve the recipes gallery page (alias for /recipes)"""
    return recipes()

@recipes_bp.route('/recipe-image/<filename>')
def recipe_image(filename):
    """Serve recipe images"""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.dirname(base_dir)  # Go up one level to app root
        images_dir = os.path.join(base_dir, 'backend', 'data', 'recipes', 'images')
        
        # Check if file exists
        if not os.path.exists(os.path.join(images_dir, filename)):
            # Return a default image
            return send_from_directory('static', 'images/recipe-placeholder.jpg')
            
        return send_from_directory(images_dir, filename)
    except Exception as e:
        current_app.logger.error(f"Error serving image {filename}: {e}")
        return send_from_directory('static', 'images/recipe-placeholder.jpg')
