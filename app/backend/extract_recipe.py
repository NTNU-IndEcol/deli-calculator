import requests
from bs4 import BeautifulSoup
import json
import time
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


class RecipeExtractor:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def extract_recipe_from_url(self, url):
        """Extract recipe information from a given URL"""
        try:
            print(f"Extracting recipe from: {url}")
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Try to find JSON-LD structured data first
            recipe_data = self._extract_json_ld(soup)
            
            if not recipe_data:
                # Fall back to meta tags and HTML parsing
                recipe_data = self._extract_from_meta(soup, url)
            
            # If still no data, try site-specific parsing
            if not recipe_data or not recipe_data.get('recipeIngredient'):
                recipe_data = self._extract_site_specific(soup, url)
            
            if not recipe_data or not recipe_data.get('recipeIngredient'):
                raise ValueError("No recipe data found on the page")
            
            # Add URL information
            recipe_data['sourceUrl'] = url
            recipe_data['extractedAt'] = time.strftime('%Y-%m-%d')
            
            return recipe_data
            
        except Exception as e:
            print(f"Error extracting from {url}: {str(e)}")
            return None
    
    def _extract_site_specific(self, soup, url):
        """Site-specific extraction for problematic sites"""
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.replace('www.', '')
        
        if domain == 'koreanbapsang.com':
            return self._extract_korean_bapsang(soup)
        
        return None
    
    def _extract_korean_bapsang(self, soup):
        """Specific extraction for Korean Bapsang website"""
        print("Using Korean Bapsang specific extractor")
        
        recipe = {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "",
            "author": "",
            "description": "",
            "recipeIngredient": [],
            "recipeInstructions": [],
            "environmentalImpact": {
                "co2Emissions": None,
                "waterUse": None
            }
        }
        
        # Extract title
        title_selectors = [
            'h1.entry-title',
            '.entry-title',
            'h1.post-title',
            'h1.title',
            'h1'
        ]
        
        for selector in title_selectors:
            title_elem = soup.select_one(selector)
            if title_elem:
                recipe['name'] = title_elem.get_text().strip()
                break
        
        # Extract ingredients - Korean Bapsang specific
        ingredient_selectors = [
            '.entry-content ul li',
            '.wprm-recipe-ingredient',
            '.ingredients li',
            '[class*="ingredient"] li'
        ]
        
        ingredients = []
        for selector in ingredient_selectors:
            elements = soup.select(selector)
            if elements:
                for elem in elements:
                    text = elem.get_text().strip()
                    # Filter out non-ingredient items
                    if text and len(text) > 3 and not any(word in text.lower() for word in ['instruction', 'method', 'step', 'note']):
                        ingredients.append(text)
                if ingredients:
                    break
        
        recipe['recipeIngredient'] = [self._parse_ingredient_string(ing) for ing in ingredients]
        
        # Extract instructions
        instruction_selectors = [
            '.entry-content ol li',
            '.wprm-recipe-instruction',
            '.instructions li',
            '[class*="instruction"] li'
        ]
        
        instructions = []
        for selector in instruction_selectors:
            elements = soup.select(selector)
            if elements:
                for i, elem in enumerate(elements, 1):
                    text = elem.get_text().strip()
                    if text:
                        instructions.append({
                            "@type": "HowToStep",
                            "text": text
                        })
                if instructions:
                    break
        
        recipe['recipeInstructions'] = instructions
        
        # Extract description
        desc_selectors = [
            '.entry-content p',
            '.post-content p',
            '[class*="description"]'
        ]
        
        for selector in desc_selectors:
            elem = soup.select_one(selector)
            if elem:
                text = elem.get_text().strip()
                if text and len(text) > 50:  # Reasonable description length
                    recipe['description'] = text
                    break
        
        return recipe if recipe['recipeIngredient'] else None

    def _extract_json_ld(self, soup):
        """Extract recipe data from JSON-LD structured data"""
        script_tags = soup.find_all('script', type='application/ld+json')
        
        for script in script_tags:
            try:
                # Clean the script content
                script_content = script.string
                if not script_content:
                    continue
                    
                # Remove CDATA if present
                if script_content.strip().startswith('/*<![CDATA[*/') or script_content.strip().startswith('//<![CDATA['):
                    script_content = re.sub(r'/\*<!\[CDATA\[\*/(.*?)/\*\]\]>\*/', r'\1', script_content, flags=re.DOTALL)
                
                data = json.loads(script_content)
                recipe = self._find_recipe_in_json(data)
                if recipe:
                    parsed_recipe = self._parse_structured_recipe(recipe)
                    if parsed_recipe.get('recipeIngredient'):
                        return parsed_recipe
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
                continue
            except Exception as e:
                print(f"Error parsing JSON-LD: {e}")
                continue
        
        return None
    
    def _find_recipe_in_json(self, data):
        """Recursively find recipe data in JSON-LD"""
        if isinstance(data, dict):
            if data.get('@type') == 'Recipe' or 'recipeIngredient' in data:
                return data
            # Check for graph array
            if data.get('@graph'):
                for item in data['@graph']:
                    if isinstance(item, dict) and (item.get('@type') == 'Recipe' or 'recipeIngredient' in item):
                        return item
            for key, value in data.items():
                if isinstance(value, (dict, list)):
                    result = self._find_recipe_in_json(value)
                    if result:
                        return result
        elif isinstance(data, list):
            for item in data:
                result = self._find_recipe_in_json(item)
                if result:
                    return result
        return None
    
    def _parse_structured_recipe(self, recipe_data):
        """Parse structured recipe data into our format"""
        # Handle author field which can be string, dict, or list
        author = recipe_data.get('author', '')
        if isinstance(author, dict):
            author = author.get('name', '')
        elif isinstance(author, list):
            author = ', '.join([a.get('name', '') if isinstance(a, dict) else str(a) for a in author])
        
        # Handle image field
        image = recipe_data.get('image', '')
        if isinstance(image, dict):
            image = image.get('url', '')
        elif isinstance(image, list):
            image = image[0] if image else ''
            if isinstance(image, dict):
                image = image.get('url', '')
        
        recipe = {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": recipe_data.get('name', ''),
            "author": author,
            "datePublished": recipe_data.get('datePublished', ''),
            "category": recipe_data.get('recipeCategory', ''),
            "recipeIngredient": self._parse_ingredients(recipe_data.get('recipeIngredient', [])),
            "recipeInstructions": self._parse_instructions(recipe_data.get('recipeInstructions', [])),
            "recipeYield": recipe_data.get('recipeYield', ''),
            "prepTime": recipe_data.get('prepTime', ''),
            "cookTime": recipe_data.get('cookTime', ''),
            "totalTime": recipe_data.get('totalTime', ''),
            "image": image,
            "description": recipe_data.get('description', ''),
            "environmentalImpact": {
                "co2Emissions": None,
                "waterUse": None
            }
        }
        
        # Clean up empty values
        return {k: v for k, v in recipe.items() if v}
    
    def _parse_ingredients(self, ingredients):
        """Parse ingredients into structured format"""
        structured_ingredients = []
        
        for ingredient in ingredients:
            if isinstance(ingredient, str):
                # Parse ingredient string into components
                parsed = self._parse_ingredient_string(ingredient)
                structured_ingredients.append(parsed)
        
        return structured_ingredients
        
    def _parse_ingredient_string(self, ingredient_text):
        """Parse a single ingredient string into structured format"""
        # Common units and patterns
        units = ['teaspoon', 'tsp', 'tablespoon', 'tbsp', 'cup', 'cups', 'ounce', 'oz', 'ounces', 
                'pound', 'lb', 'pounds', 'gram', 'g', 'grams', 'kg', 'kilogram', 'milliliter', 
                'ml', 'liter', 'l', 'pinch', 'dash', 'can', 'package', 'pkg', 'bunch', 'clove',
                'cloves', 'piece', 'pieces', 'slice', 'slices', 'package', 'pack', 'large',
                'medium', 'small', 'whole', 'fresh', 'dried', 'chopped', 'minced', 'sliced',
                'tablespoons', 'teaspoons', 'lbs']
        
        # Improved pattern to match amount and unit
        amount_pattern = r'^([\d\/\.\s-]+)\s*([a-zA-Z]*)\s*(.*)$'
        
        # First, extract the original ingredient components
        original_ingredient = ingredient_text.strip()
        match = re.match(amount_pattern, original_ingredient)
        
        if match:
            amount = match.group(1).strip()
            unit = match.group(2).strip()
            ingredient = match.group(3).strip()
            
            # Clean up unit
            unit_lower = unit.lower()
            if unit and unit_lower in [u.lower() for u in units]:
                unit = unit_lower
            else:
                # If the "unit" doesn't match known units, it's probably part of the ingredient
                ingredient = f"{unit} {ingredient}".strip()
                unit = ""
            
            # Convert fraction amounts to decimal
            amount = self._convert_fraction_to_decimal(amount)
            
            # Extract main ingredient by cleaning the ingredient string
            main_ingredient = self._extract_main_ingredient(ingredient)
            
            return {
                "mainIngredient": main_ingredient,
                "details": {
                    "amount": float(amount) if amount and self._is_convertible_to_float(amount) else amount,
                    "unit": unit if unit else None,
                    "originalText": original_ingredient
                }
            }
        else:
            # No amount/unit found, use the whole string as ingredient
            main_ingredient = self._extract_main_ingredient(original_ingredient)
            return {
                "mainIngredient": main_ingredient,
                "details": {
                    "amount": None,
                    "unit": None,
                    "originalText": original_ingredient
                }
            }

    def _extract_main_ingredient(self, ingredient_text):
        """Extract only the main ingredient name by removing explanations, measurements, etc."""
        if not ingredient_text:
            return ""
        
        # Remove content within parentheses (including Korean text and explanations)
        cleaned = re.sub(r'\([^)]*\)', '', ingredient_text).strip()
        
        # Remove content within brackets
        cleaned = re.sub(r'\[[^\]]*\]', '', cleaned).strip()
        
        # Remove common measurement words and preparation terms that might be left
        preparation_terms = [
            'to taste', 'for serving', 'for garnish', 'garnish', 'optional',
            'divided', 'warm', 'cold', 'hot', 'room temperature'
        ]
        
        # Remove preparation terms
        for term in preparation_terms:
            cleaned = re.sub(r'\b' + re.escape(term) + r'\b', '', cleaned, flags=re.IGNORECASE)
        
        # Remove common quantity indicators
        quantity_patterns = [
            r'\b\d+\s*-\s*\d+\b',  # "6 to 8"
            r'\b\d+\s*to\s*\d+\b',  # "6 to 8"
            r'\bdepending on the size\b',
            r'\babout\b',
            r'\bapproximately\b',
            r'\broughly\b',
            r'\bplus more\b',
            r'\badditional\b',
            r'\bextra\b',
        ]
        
        for pattern in quantity_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
        
        # Remove extra spaces and commas at beginning/end
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        cleaned = re.sub(r'^,\s*|\s*,$', '', cleaned)
        
        # If the cleaned text is empty, fall back to the original (without parentheses)
        if not cleaned:
            # Remove just the parenthetical content but keep the rest
            cleaned = re.sub(r'\([^)]*\)', '', ingredient_text).strip()
        
        # Final cleanup - remove any remaining non-ingredient words at the start
        # Common prefixes to remove
        prefixes_to_remove = [
            r'^of\s+',
            r'^and\s+',
            r'^or\s+',
            r'^plus\s+',
            r'^about\s+',
            r'^approximately\s+',
        ]
        
        for prefix in prefixes_to_remove:
            cleaned = re.sub(prefix, '', cleaned, flags=re.IGNORECASE)
        
        # Remove any remaining leading/trailing punctuation
        cleaned = re.sub(r'^[,\s.-]+|[,\s.-]+$', '', cleaned)
        
        # Capitalize first letter for consistency
        if cleaned:
            cleaned = cleaned[0].upper() + cleaned[1:]
        
        return cleaned.strip()

    def _is_convertible_to_float(self, s):
        """Check if string can be converted to float"""
        try:
            float(s)
            return True
        except ValueError:
            return False
    
    def _convert_fraction_to_decimal(self, amount_str):
        """Convert fraction strings to decimal"""
        if '/' in amount_str:
            try:
                # Handle mixed numbers like "1 1/2"
                parts = amount_str.split()
                total = 0.0
                for part in parts:
                    if '/' in part:
                        num, denom = part.split('/')
                        total += float(num) / float(denom)
                    else:
                        total += float(part)
                return str(total)
            except:
                return amount_str
        return amount_str
    
    def _parse_instructions(self, instructions):
        """Parse cooking instructions"""
        structured_instructions = []
        
        if isinstance(instructions, str):
            # Split by newlines or numbers
            steps = re.split(r'\n+|\d+\.', instructions)
            steps = [step.strip() for step in steps if step.strip()]
            for i, step in enumerate(steps, 1):
                structured_instructions.append({
                    "@type": "HowToStep",
                    "text": step
                })
        elif isinstance(instructions, list):
            for i, step in enumerate(instructions, 1):
                if isinstance(step, dict):
                    text = step.get('text', '') or step.get('name', '') or str(step)
                    structured_instructions.append({
                        "@type": "HowToStep",
                        "text": text
                    })
                else:
                    structured_instructions.append({
                        "@type": "HowToStep",
                        "text": str(step)
                    })
        
        return structured_instructions
    
    def _extract_from_meta(self, soup, url):
        """Fallback method to extract recipe data from meta tags and HTML structure"""
        recipe = {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": self._extract_title(soup),
            "author": self._extract_author(soup),
            "description": self._extract_description(soup),
            "image": self._extract_image(soup),
            "recipeIngredient": self._extract_ingredients_from_html(soup),
            "recipeInstructions": self._extract_instructions_from_html(soup),
            "prepTime": self._extract_prep_time(soup),
            "cookTime": self._extract_cook_time(soup),
            "recipeYield": self._extract_yield(soup),
            "environmentalImpact": {
                "co2Emissions": None,
                "waterUse": None
            }
        }
        
        return {k: v for k, v in recipe.items() if v}
    
    def _extract_title(self, soup):
        """Extract recipe title"""
        # Try multiple selectors
        selectors = [
            'h1[class*="recipe"]', 
            '[class*="recipe-title"]',
            'h1.entry-title',
            'h1',
            'title'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                return element.get_text().strip()
        
        return ""
    
    def _extract_author(self, soup):
        """Extract recipe author"""
        selectors = [
            '[class*="author"]',
            '[class*="byline"]',
            '.author',
            'meta[name="author"]'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                if element.name == 'meta':
                    return element.get('content', '').strip()
                return element.get_text().strip()
        
        return ""
    
    def _extract_description(self, soup):
        """Extract recipe description"""
        selectors = [
            'meta[name="description"]',
            '[class*="description"]',
            '[class*="summary"]',
            '.entry-content p'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                if element.name == 'meta':
                    return element.get('content', '').strip()
                text = element.get_text().strip()
                if text and len(text) > 20:  # Only return substantial descriptions
                    return text
        
        return ""
    
    def _extract_image(self, soup):
        """Extract recipe image"""
        selectors = [
            'meta[property="og:image"]',
            'img[class*="recipe"]',
            '.recipe-image img',
            '.entry-content img',
            '.wp-post-image'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                if element.name == 'meta':
                    return element.get('content', '').strip()
                src = element.get('src', '').strip()
                if src:
                    return src
        
        return ""
    
    def _extract_ingredients_from_html(self, soup):
        """Extract ingredients from HTML structure"""
        ingredients = []
        selectors = [
            '[class*="ingredient"]',
            '[class*="ingredients"] li',
            '.ingredients li',
            '.wprm-recipe-ingredient',
            '.entry-content ul li'
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            if elements:
                for element in elements:
                    text = element.get_text().strip()
                    # Filter out very short texts and obvious non-ingredients
                    if (text and len(text) > 2 and 
                        not any(word in text.lower() for word in ['instruction', 'method', 'step', 'note:', 'tips:'])):
                        ingredients.append(text)
                if ingredients:
                    break
        
        return [self._parse_ingredient_string(ing) for ing in ingredients] if ingredients else []
    
    def _extract_instructions_from_html(self, soup):
        """Extract instructions from HTML structure"""
        instructions = []
        selectors = [
            '[class*="instruction"]',
            '[class*="step"]',
            '[class*="direction"]',
            '.instructions li',
            '.wprm-recipe-instruction',
            '.entry-content ol li'
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            if elements:
                for i, element in enumerate(elements, 1):
                    text = element.get_text().strip()
                    if text and len(text) > 2:
                        instructions.append({
                            "@type": "HowToStep",
                            "text": text
                        })
                if instructions:
                    break
        
        return instructions
    
    def _extract_prep_time(self, soup):
        """Extract preparation time"""
        return self._extract_time(soup, 'prep')
    
    def _extract_cook_time(self, soup):
        """Extract cooking time"""
        return self._extract_time(soup, 'cook')
    
    def _extract_time(self, soup, time_type):
        """Extract time information"""
        selectors = [
            f'[class*="{time_type}-time"]',
            f'[class*="{time_type}time"]',
            f'.{time_type}-time'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                return element.get_text().strip()
        
        return ""
    
    def _extract_yield(self, soup):
        """Extract recipe yield/servings"""
        selectors = [
            '[class*="yield"]',
            '[class*="serving"]',
            '[class*="portion"]'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                return element.get_text().strip()
        
        return ""

def validate_url(url):
    """Ensure URL is from allowed domains"""
    parsed = urlparse(url)
    domain = parsed.netloc.replace('www.', '')
    base_domains = [d.replace('www.', '') for d in ALLOWED_DOMAINS]
    
    if domain not in base_domains:
        raise ValueError(f"Domain {domain} not allowed")
    return True

def extract_recipe_data(url):
    """Extract recipe data from a given URL."""
    try:
        print(f"Fetching URL: {url}")
        validate_url(url)
        extractor = RecipeExtractor()
        recipe = extractor.extract_recipe_from_url(url)
        
        if not recipe:
            print("Error: No recipe data found.")
            return None
        
        print(f"Successfully extracted recipe: {recipe.get('name', 'Unknown')}")
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