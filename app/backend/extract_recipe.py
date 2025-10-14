import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
from fractions import Fraction
import os
import re
from urllib.parse import urlparse

ALLOWED_DOMAINS = [
    'koreanbapsang.com', 'www.koreanbapsang.com',
    'allrecipes.com', 'www.allrecipes.com', 
    'simplehomeedit.com', 'www.simplehomeedit.com',
    'howtocook.recipes', 'www.howtocook.recipes',
    'your-recipesite.com'
]

RECIPE_FILE = "backend/data/recipes.json"

def validate_url(url):
    """Ensure URL is from allowed domains"""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    domain = parsed.netloc.replace('www.', '')
    base_domains = [domain.replace('www.', '') for domain in ALLOWED_DOMAINS]
    
    if domain not in base_domains:
        raise ValueError(f"Domain {domain} not allowed")
    return True

def detect_recipe_format(soup, url):
    """Detect which recipe format the site uses."""
    domain = urlparse(url).netloc.lower()
    
    # Domain-specific detection first
    if 'allrecipes.com' in domain:
        return 'allrecipes'
    elif 'howtocook.recipes' in domain:
        return 'howtocook'
    elif 'koreanbapsang.com' in domain:
        return 'koreanbapsang'
    elif 'simplehomeedit.com' in domain:
        return 'simplehomeedit'
    
    # Check for Schema.org/JSON-LD
    script_tag = soup.find('script', type='application/ld+json')
    if script_tag:
        try:
            data = json.loads(script_tag.string)
            if isinstance(data, list):
                for item in data:
                    if item.get('@type') == 'Recipe':
                        return 'schema'
            elif data.get('@type') == 'Recipe':
                return 'schema'
        except:
            pass
    
    # Check for different recipe plugins and formats
    if soup.select('li.wprm-recipe-ingredient'):
        return 'wprm'
    elif soup.select('div.tasty-recipes-ingredients li'):
        return 'tasty'
    elif soup.select('li.ingredients-item'):
        return 'allrecipes_fallback'
    elif soup.select('div.recipe-ingredients li'):
        return 'generic'
    elif soup.select('[itemprop="recipeIngredient"]'):
        return 'microdata'
    
    return 'generic'

def parse_amount(amount_text):
    """Convert amount text to a float value."""
    if not amount_text:
        return None

    # Handle 'to taste' cases with an optional amount
    taste_match = re.match(r"(.+?)\s*(to taste)", amount_text, re.IGNORECASE)
    if taste_match:
        fixed_amount = parse_amount(taste_match.group(1))
        return fixed_amount if fixed_amount else "to taste"

    # Handle ranges (e.g., "5 to 6")
    range_match = re.match(r"(\d+)\s*(to|-)\s*(\d+)", amount_text)
    if range_match:
        low = float(range_match.group(1))
        high = float(range_match.group(3))
        return (low + high) / 2  # Average of range

    # Handle fractions (e.g., "1/4")
    try:
        return float(sum(Fraction(s) for s in amount_text.split()))
    except ValueError:
        return None

def extract_main_ingredient(name):
    """Extract the main component from ingredient name."""
    if not name:
        return ""
        
    descriptors = {
        'size': ['medium', 'small', 'large', 'jumbo', 'baby', 'piece', 'pieces'],
        'state': ['fresh', 'dried', 'dry', 'minced', 'chopped', 'sliced', 
                 'thinly', 'shaved', 'divided', 'optional', 'to taste', 'marinated'],
        'type': ['korean', 'asian', 'plump', 'thumb-sized', 'soup', 'other'],
        'preparation': ['thinly sliced', 'shaved', 'sliced', 'minced', 'grated', 'crushed']
    }
    
    # Split into alternatives separated by 'or'
    alternatives = re.split(r'\s+or\s+', name, flags=re.IGNORECASE)
    main_ingredients = []
    
    for alt in alternatives:
        # Clean the alternative
        clean_alt = re.sub(
            r'\([^)]*\)|[\d%]+|-\s*|(\b(?:optional|to taste)\b)',
            '', 
            alt, 
            flags=re.IGNORECASE
        ).strip(' -')
        
        # Remove preparation terms from the start
        prep_pattern = r'^\s*(?:' + '|'.join(descriptors['preparation']) + r')\s+'
        clean_alt = re.sub(prep_pattern, '', clean_alt, flags=re.IGNORECASE)
        
        # Split into words and filter descriptors
        words = [
            word.lower() for word in clean_alt.split() 
            if word.lower() not in [item for sublist in descriptors.values() for item in sublist]
        ]
        
        # Join remaining words to form the main ingredient
        main_ingredient = ' '.join(words) if words else clean_alt
        
        # Handle compound terms
        if ' ' in main_ingredient:
            parts = main_ingredient.split()
            if parts[0] in ['pork', 'beef', 'chicken', 'lamb']:
                main_ingredient = parts[0]
        
        # Singularize
        if main_ingredient.endswith('s'):
            main_ingredient = main_ingredient.rstrip('s')
            
        main_ingredients.append(main_ingredient.capitalize())
    
    return ' or '.join(main_ingredients)

def extract_ingredients(soup, format_type, url):
    """Extract ingredients based on detected format."""
    ingredients = []
    
    if format_type == 'schema':
        script_tag = soup.find('script', type='application/ld+json')
        if script_tag:
            try:
                data = json.loads(script_tag.string)
                if isinstance(data, list):
                    for item in data:
                        if item.get('@type') == 'Recipe':
                            ingredients_list = item.get('recipeIngredient', [])
                            for ingredient in ingredients_list:
                                ingredients.append({
                                    "name": extract_main_ingredient(ingredient),
                                    "amount": None,
                                    "unit": None,
                                    "original_text": ingredient
                                })
                elif data.get('@type') == 'Recipe':
                    ingredients_list = data.get('recipeIngredient', [])
                    for ingredient in ingredients_list:
                        ingredients.append({
                            "name": extract_main_ingredient(ingredient),
                            "amount": None,
                            "unit": None,
                            "original_text": ingredient
                        })
            except Exception as e:
                print(f"Schema extraction error: {e}")
    
    elif format_type == 'allrecipes':
        # AllRecipes specific selectors
        for ingredient in soup.select('li.ingredients-item'):
            # Try multiple selectors for amount/unit/name
            amount_elem = (ingredient.select_one('[data-ingredient-quantity="true"]') or 
                          ingredient.select_one('.ingredient-amount'))
            unit_elem = (ingredient.select_one('[data-ingredient-unit="true"]') or 
                        ingredient.select_one('.ingredient-unit'))
            name_elem = (ingredient.select_one('[data-ingredient="true"]') or 
                        ingredient.select_one('.ingredient-name') or
                        ingredient.select_one('.ingredient-description'))
            
            raw_amount = parse_amount(amount_elem.get_text(strip=True)) if amount_elem else None
            raw_unit = unit_elem.get_text(strip=True) if unit_elem else ''
            raw_name = name_elem.get_text(strip=True) if name_elem else ingredient.get_text(strip=True)
            
            # Clean up the name
            raw_name = re.sub(r'^\d+\s*\w*\s*', '', raw_name).strip()
            
            ingredients.append({
                "name": extract_main_ingredient(raw_name),
                "amount": raw_amount,
                "unit": raw_unit,
                "original_text": raw_name
            })
    
    elif format_type == 'howtocook':
        # HowToCook.recipes specific selectors
        for ingredient in soup.select('li.wprm-recipe-ingredient'):
            amount_elem = ingredient.select_one('.wprm-recipe-ingredient-amount')
            unit_elem = ingredient.select_one('.wprm-recipe-ingredient-unit')
            name_elem = ingredient.select_one('.wprm-recipe-ingredient-name')
            
            raw_amount = parse_amount(amount_elem.get_text(strip=True)) if amount_elem else None
            raw_unit = unit_elem.get_text(strip=True) if unit_elem else ''
            raw_name = name_elem.get_text(strip=True) if name_elem else ''
            
            ingredients.append({
                "name": extract_main_ingredient(raw_name),
                "amount": raw_amount,
                "unit": raw_unit,
                "original_text": f"{raw_amount} {raw_unit} {raw_name}".strip() if raw_amount else raw_name
            })
    
    elif format_type == 'koreanbapsang':
        for ingredient in soup.select('li.wprm-recipe-ingredient'):
            amount_elem = ingredient.select_one('.wprm-recipe-ingredient-amount')
            unit_elem = ingredient.select_one('.wprm-recipe-ingredient-unit')
            name_elem = ingredient.select_one('.wprm-recipe-ingredient-name')
            
            raw_amount = parse_amount(amount_elem.get_text(strip=True)) if amount_elem else None
            raw_unit = unit_elem.get_text(strip=True) if unit_elem else ''
            raw_name = name_elem.get_text(strip=True) if name_elem else ''
            
            ingredients.append({
                "name": extract_main_ingredient(raw_name),
                "amount": raw_amount,
                "unit": raw_unit,
                "original_text": f"{raw_amount} {raw_unit} {raw_name}".strip() if raw_amount else raw_name
            })
    
    elif format_type == 'simplehomeedit':
        for ingredient in soup.select('li.recipe-ingredient'):
            amount_elem = ingredient.select_one('.ingredient-amount')
            unit_elem = ingredient.select_one('.ingredient-unit')
            name_elem = ingredient.select_one('.ingredient-name')
            
            raw_amount = parse_amount(amount_elem.get_text(strip=True)) if amount_elem else None
            raw_unit = unit_elem.get_text(strip=True) if unit_elem else ''
            raw_name = name_elem.get_text(strip=True) if name_elem else ''
            
            ingredients.append({
                "name": extract_main_ingredient(raw_name),
                "amount": raw_amount,
                "unit": raw_unit,
                "original_text": f"{raw_name}".strip()
            })
    
    elif format_type == 'wprm':
        for ingredient in soup.select('li.wprm-recipe-ingredient'):
            amount_elem = ingredient.select_one('.wprm-recipe-ingredient-amount')
            unit_elem = ingredient.select_one('.wprm-recipe-ingredient-unit')
            name_elem = ingredient.select_one('.wprm-recipe-ingredient-name')
            
            raw_amount = parse_amount(amount_elem.get_text(strip=True)) if amount_elem else None
            raw_unit = unit_elem.get_text(strip=True) if unit_elem else ''
            raw_name = name_elem.get_text(strip=True) if name_elem else ''
            
            ingredients.append({
                "name": extract_main_ingredient(raw_name),
                "amount": raw_amount,
                "unit": raw_unit,
                "original_text": f"{raw_amount} {raw_unit} {raw_name}".strip() if raw_amount else raw_name
            })
    
    # Fallback: try generic ingredient detection
    if not ingredients:
        generic_selectors = [
            'li.ingredient',
            '.ingredients li',
            '[itemprop="recipeIngredient"]',
            '.recipe-ingredients li'
        ]
        for selector in generic_selectors:
            elements = soup.select(selector)
            if elements:
                for element in elements:
                    raw_text = element.get_text(strip=True)
                    ingredients.append({
                        "name": extract_main_ingredient(raw_text),
                        "amount": None,
                        "unit": None,
                        "original_text": raw_text
                    })
                break
    
    return ingredients

def extract_instructions(soup, format_type, url):
    """Extract instructions based on detected format."""
    instructions = []
    
    if format_type == 'schema':
        script_tag = soup.find('script', type='application/ld+json')
        if script_tag:
            try:
                data = json.loads(script_tag.string)
                instructions_data = []
                
                if isinstance(data, list):
                    for item in data:
                        if item.get('@type') == 'Recipe':
                            instructions_data = item.get('recipeInstructions', [])
                            break
                elif data.get('@type') == 'Recipe':
                    instructions_data = data.get('recipeInstructions', [])
                
                if isinstance(instructions_data, list):
                    for step in instructions_data:
                        if isinstance(step, dict):
                            instructions.append(step.get('text', ''))
                        else:
                            instructions.append(str(step))
            except Exception as e:
                print(f"Schema instructions error: {e}")
    
    elif format_type == 'allrecipes':
        instructions = [instruction.get_text(strip=True) 
                       for instruction in soup.select('li.instructions-item')]
    
    elif format_type == 'howtocook':
        instructions = [instruction.get_text(strip=True) 
                       for instruction in soup.select('div.wprm-recipe-instruction-text')]
    
    elif format_type == 'koreanbapsang':
        instructions = [instruction.get_text(strip=True) 
                       for instruction in soup.select('div.wprm-recipe-instruction-text')]
    
    elif format_type == 'simplehomeedit':
        instructions = [instruction.get_text(strip=True) 
                       for instruction in soup.select('div.recipe-instruction-text')]
    
    elif format_type == 'wprm':
        instructions = [instruction.get_text(strip=True) 
                       for instruction in soup.select('div.wprm-recipe-instruction-text')]
    
    # Fallback: try generic instruction detection
    if not instructions:
        generic_selectors = [
            'li.instruction',
            '.instructions li',
            '[itemprop="recipeInstructions"]',
            '.recipe-steps li',
            '.direction'
        ]
        for selector in generic_selectors:
            elements = soup.select(selector)
            if elements:
                instructions = [elem.get_text(strip=True) for elem in elements]
                break
    
    return instructions

def clean_time_text(time_text):
    """Clean and standardize time text."""
    if not time_text:
        return None
    
    # Handle ISO duration format
    if time_text.startswith('PT'):
        hours = re.search(r'(\d+)H', time_text)
        minutes = re.search(r'(\d+)M', time_text)
        total_minutes = 0
        if hours:
            total_minutes += int(hours.group(1)) * 60
        if minutes:
            total_minutes += int(minutes.group(1))
        
        if total_minutes >= 60:
            hours = total_minutes // 60
            mins = total_minutes % 60
            if mins > 0:
                return f"{hours} Hours {mins} Minutes"
            else:
                return f"{hours} Hours"
        else:
            return f"{total_minutes} Minutes"
    
    # Handle regular time text
    match = re.search(r'(\d+)\s*(minutes|hours|seconds|days)', time_text, re.IGNORECASE)
    if match:
        quantity = match.group(1)
        unit = match.group(2).lower()
        if "minute" in unit:
            return f"{quantity} Minutes"
        elif "hour" in unit:
            return f"{quantity} Hours"
        elif "second" in unit:
            return f"{quantity} Seconds"
        elif "day" in unit:
            return f"{quantity} Days"
    
    return time_text

def extract_title(soup, format_type, url):
    """Extract recipe title."""
    # Try domain-specific selectors first
    domain_specific_selectors = {
        'allrecipes.com': ['h1.heading-content'],
        'howtocook.recipes': ['h1.entry-title'],
        'koreanbapsang.com': ['h1.entry-title'],
        'simplehomeedit.com': ['h1.entry-title']
    }
    
    domain = urlparse(url).netloc.lower()
    for site, selectors in domain_specific_selectors.items():
        if site in domain:
            for selector in selectors:
                element = soup.select_one(selector)
                if element:
                    return element.get_text(strip=True)
    
    # Generic selectors
    generic_selectors = [
        'h1.entry-title',
        'h1.recipe-title',
        '[itemprop="name"]',
        'h1',
        '.title',
        'h1.heading'
    ]
    
    for selector in generic_selectors:
        element = soup.select_one(selector)
        if element:
            return element.get_text(strip=True)
    
    return "Untitled Recipe"

def extract_category(soup, url):
    """Extract recipe category."""
    selectors = [
        'ul.sub-menu .current-menu-parent a span',
        '.breadcrumb a:last-child',
        '.category',
        '[itemprop="recipeCategory"]',
        '.recipe-category'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            return element.get_text(strip=True)
    
    return ""

def extract_servings(soup):
    """Extract servings information."""
    selectors = [
        'div.wprm-recipe-servings-container',
        '[itemprop="recipeYield"]',
        '.servings',
        '.recipe-yield'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            text = element.get_text(strip=True)
            match = re.search(r'\d+', text)
            if match:
                return match.group(0)
    
    return None

def extract_times(soup):
    """Extract prep and cook times."""
    times = {'prep': None, 'cook': None}
    
    # Try WPRM format
    prep_elem = soup.select_one('div.wprm-recipe-prep-time-container')
    cook_elem = soup.select_one('div.wprm-recipe-cook-time-container')
    
    if prep_elem:
        times['prep'] = clean_time_text(prep_elem.get_text(strip=True))
    if cook_elem:
        times['cook'] = clean_time_text(cook_elem.get_text(strip=True))
    
    # Try Schema.org format
    if not times['prep'] or not times['cook']:
        script_tag = soup.find('script', type='application/ld+json')
        if script_tag:
            try:
                data = json.loads(script_tag.string)
                if isinstance(data, list):
                    for item in data:
                        if item.get('@type') == 'Recipe':
                            if not times['prep'] and 'prepTime' in item:
                                times['prep'] = clean_time_text(item['prepTime'])
                            if not times['cook'] and 'cookTime' in item:
                                times['cook'] = clean_time_text(item['cookTime'])
                elif data.get('@type') == 'Recipe':
                    if not times['prep'] and 'prepTime' in data:
                        times['prep'] = clean_time_text(data['prepTime'])
                    if not times['cook'] and 'cookTime' in data:
                        times['cook'] = clean_time_text(data['cookTime'])
            except:
                pass
    
    return times

def extract_image(soup):
    """Extract recipe image URL."""
    selectors = [
        'meta[property="og:image"]',
        '[itemprop="image"]',
        '.recipe-image img',
        '.featured-image img'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            if element.name == 'meta':
                return element.get('content', '')
            else:
                src = element.get('src', '')
                if src.startswith('//'):
                    src = 'https:' + src
                return src
    
    return None

def extract_description(soup):
    """Extract recipe description."""
    selectors = [
        'meta[name="description"]',
        '[itemprop="description"]',
        '.recipe-description',
        '.entry-content p'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            if element.name == 'meta':
                return element.get('content', '')
            else:
                return element.get_text(strip=True)
    
    return ""

def extract_author(soup, url):
    """Extract recipe author."""
    selectors = [
        '[itemprop="author"]',
        '.author',
        '.recipe-author',
        '.entry-author'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            return element.get_text(strip=True)
    
    # Fallback to domain-based author
    domain = urlparse(url).netloc.lower()
    if 'allrecipes.com' in domain:
        return "AllRecipes"
    elif 'howtocook.recipes' in domain:
        return "HowToCook.Recipes"
    elif 'koreanbapsang.com' in domain:
        return "Korean Bapsang"
    elif 'simplehomeedit.com' in domain:
        return "Simple Home Edit"
    
    return "Unknown"

def extract_recipe_details(url, recipe_id):
    """Extract recipe details from a given URL."""
    try:
        from urllib.parse import urlparse
        
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            print(f"Failed to retrieve the URL: {url} - Status: {response.status_code}")
            return None
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Detect recipe format
        format_type = detect_recipe_format(soup, url)
        print(f"Detected recipe format: {format_type} for {url}")
        
        if not format_type:
            print("No recognized recipe format found")
            return None
        
        # Extract recipe components
        title = extract_title(soup, format_type, url)
        category = extract_category(soup, url)
        ingredients = extract_ingredients(soup, format_type, url)
        instructions = extract_instructions(soup, format_type, url)
        times = extract_times(soup)
        servings = extract_servings(soup)
        image_url = extract_image(soup)
        description = extract_description(soup)
        author = extract_author(soup, url)
        
        print(f"Extracted {len(ingredients)} ingredients and {len(instructions)} instructions")
        
        schema_recipe = {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "id": recipe_id,
            "name": title,
            "author": author,
            "datePublished": datetime.now().strftime('%Y-%m-%d'),
            "category": category,
            "recipeIngredient": [{
                "mainIngredient": ingredient["name"],
                "details": {
                    "amount": ingredient["amount"],
                    "unit": ingredient["unit"],
                    "originalText": ingredient["original_text"]
                }
            } for ingredient in ingredients],    
            "recipeInstructions": [{"@type": "HowToStep", "text": instruction} for instruction in instructions],
            "recipeYield": servings,
            "prepTime": times['prep'],
            "cookTime": times['cook'],
            "image": image_url,
            "description": description,
            "environmentalImpact": {
                "co2Emissions": None,
                "waterUse": None
            }
        }

        return schema_recipe
        
    except Exception as e:
        print(f"Error extracting recipe from {url}: {e}")
        return None

def extract_recipe_data(url):
    """Extract recipe data from a given URL."""
    try:
        print(f"Fetching URL: {url}")
        validate_url(url)
        recipe = extract_recipe_details(url, recipe_id=1)
        if not recipe:
            print("Error: No recipe data found.")
            return None
        return recipe
    except Exception as e:
        print(f"Error extracting recipe: {e}")
        return None

def save_recipe(recipe):
    """Save recipe to JSON file."""
    try:
        print("🚀 Saving recipe...")
        os.makedirs(os.path.dirname(RECIPE_FILE), exist_ok=True)

        if not isinstance(recipe, dict):
            raise ValueError("Invalid recipe format: Expected a dictionary.")

        recipe["environmentalImpact"] = {
            "co2Emissions": 0,
            "waterUse": 0
        }

        with open(RECIPE_FILE, "w", encoding="utf-8") as f:
            json.dump(recipe, f, indent=4, ensure_ascii=False)

        print(f"✅ Recipe saved successfully: {recipe['name']}")
    except Exception as e:
        print(f"❌ Error saving recipe: {e}")

