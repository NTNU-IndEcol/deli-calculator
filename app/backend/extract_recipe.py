import requests
from bs4 import BeautifulSoup
import json
import time
import os
import re
from urllib.parse import urlparse

RECIPE_FILE = "backend/data/recipe.json"


class RecipeExtractor:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
    
    def extract_recipe_from_url(self, url):
        """Extract recipe information from a given URL"""
        try:
            print(f"\n{'='*60}")
            print(f"🔍 Extracting recipe from: {url}")
            print(f"{'='*60}")
            
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Try extraction methods in order of reliability
            recipe_data = None
            
            # Method 1: JSON-LD structured data (most reliable)
            print("\n📋 Method 1: Trying JSON-LD extraction...")
            recipe_data = self._extract_json_ld(soup)
            if recipe_data and recipe_data.get('recipeIngredient'):
                print("✅ JSON-LD extraction successful!")
                recipe_data['sourceUrl'] = url
                recipe_data['extractedAt'] = time.strftime('%Y-%m-%d')
                return recipe_data
            
            # Method 2: Site-specific extractors
            print("\n📋 Method 2: Trying site-specific extraction...")
            recipe_data = self._extract_site_specific(soup, url)
            if recipe_data and recipe_data.get('recipeIngredient'):
                print("✅ Site-specific extraction successful!")
                recipe_data['sourceUrl'] = url
                recipe_data['extractedAt'] = time.strftime('%Y-%m-%d')
                return recipe_data
            
            # Method 3: HTML parsing fallback
            print("\n📋 Method 3: Trying HTML parsing fallback...")
            recipe_data = self._extract_from_meta(soup, url)
            if recipe_data and recipe_data.get('recipeIngredient'):
                print("✅ HTML parsing extraction successful!")
                recipe_data['sourceUrl'] = url
                recipe_data['extractedAt'] = time.strftime('%Y-%m-%d')
                return recipe_data
            
            # Method 4: Aggressive HTML parsing
            print("\n📋 Method 4: Trying aggressive HTML extraction...")
            recipe_data = self._extract_aggressive(soup, url)
            if recipe_data and recipe_data.get('recipeIngredient'):
                print("✅ Aggressive extraction successful!")
                recipe_data['sourceUrl'] = url
                recipe_data['extractedAt'] = time.strftime('%Y-%m-%d')
                return recipe_data
            
            raise ValueError("❌ No recipe data found using any extraction method")
            
        except requests.exceptions.HTTPError as e:
            status_code = getattr(e.response, 'status_code', None)
            if status_code == 403:
                print(f"❌ Access forbidden (403) - site may require subscription or block scrapers")
            elif status_code == 404:
                print(f"❌ Page not found (404)")
            elif status_code:
                print(f"❌ HTTP Error {status_code}: {str(e)}")
            else:
                print(f"❌ HTTP Error: {str(e)}")
            return None
        except requests.exceptions.Timeout:
            print(f"❌ Request timeout - site took too long to respond")
            return None
        except Exception as e:
            print(f"❌ Error extracting from {url}: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def _extract_aggressive(self, soup, url):
        """Aggressive extraction when other methods fail"""
        print("  🔎 Searching for any list structures that might be ingredients...")
        
        recipe = {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "",
            "recipeIngredient": [],
            "recipeInstructions": [],
            "environmentalImpact": {
                "co2Emissions": None,
                "waterUse": None
            }
        }
        
        # Extract title aggressively
        title = (
            soup.find('h1') or 
            soup.find('h2') or 
            soup.find('title')
        )
        if title:
            recipe['name'] = title.get_text().strip()
            print(f"  📝 Found title: {recipe['name']}")
        
        # Look for any <ul> or <ol> that might contain ingredients
        all_lists = soup.find_all(['ul', 'ol'])
        print(f"  📋 Found {len(all_lists)} list elements to check")
        
        potential_ingredients = []
        for list_elem in all_lists:
            items = list_elem.find_all('li')
            if 3 <= len(items) <= 30:  # Reasonable ingredient list size
                list_text = list_elem.get_text().lower()
                # Check if list looks like ingredients
                ingredient_keywords = ['cup', 'tablespoon', 'teaspoon', 'ounce', 'pound', 
                                      'gram', 'oz', 'lb', 'tsp', 'tbsp', 'chopped', 'diced']
                
                if any(keyword in list_text for keyword in ingredient_keywords):
                    print(f"    ✓ Found potential ingredient list with {len(items)} items")
                    for item in items:
                        text = item.get_text().strip()
                        if text and len(text) > 3:
                            potential_ingredients.append(text)
                    if potential_ingredients:
                        break
        
        if potential_ingredients:
            recipe['recipeIngredient'] = [
                self._parse_ingredient_string(ing) for ing in potential_ingredients
            ]
            print(f"  ✅ Extracted {len(potential_ingredients)} ingredients")
            return recipe
        
        print("  ❌ No ingredient lists found")
        return None
    
    def _extract_site_specific(self, soup, url):
        """Site-specific extraction for problematic sites"""
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.replace('www.', '')
        
        print(f"  🌐 Checking domain: {domain}")
        
        if domain == 'koreanbapsang.com':
            return self._extract_korean_bapsang(soup)
        elif domain == 'food.com':
            return self._extract_food_com(soup)
        elif domain == 'tastefullysimple.com':
            return self._extract_tastefully_simple(soup)
        
        print("  ℹ️ No specific extractor for this domain")
        return None
    
    def _extract_food_com(self, soup):
        """Specific extraction for food.com"""
        print("  🍽️ Using Food.com specific extractor")
        
        recipe = {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "",
            "recipeIngredient": [],
            "recipeInstructions": [],
            "environmentalImpact": {
                "co2Emissions": None,
                "waterUse": None
            }
        }
        
        # Title
        title = soup.find('h1', class_='recipe-title')
        if title:
            recipe['name'] = title.get_text().strip()
            print(f"    📝 Title: {recipe['name']}")
        
        # Ingredients - food.com uses specific classes
        ingredients = []
        ingredient_elements = soup.select('.ingredient-list li, .recipe-ingredients li, [class*="ingredient"] li')
        
        print(f"    🔍 Found {len(ingredient_elements)} ingredient elements")
        
        for elem in ingredient_elements:
            text = elem.get_text().strip()
            if text and len(text) > 3:
                ingredients.append(text)
        
        recipe['recipeIngredient'] = [self._parse_ingredient_string(ing) for ing in ingredients]
        print(f"    ✅ Parsed {len(ingredients)} ingredients")
        
        return recipe if recipe['recipeIngredient'] else None
    
    def _extract_tastefully_simple(self, soup):
        """Specific extraction for tastefullysimple.com"""
        print("  🥗 Using Tastefully Simple specific extractor")
        
        recipe = {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "",
            "recipeIngredient": [],
            "recipeInstructions": [],
            "environmentalImpact": {
                "co2Emissions": None,
                "waterUse": None
            }
        }
        
        # Title
        title = soup.find('h1')
        if title:
            recipe['name'] = title.get_text().strip()
            print(f"    📝 Title: {recipe['name']}")
        
        # Ingredients
        ingredients = []
        ingredient_sections = soup.select('.recipe-ingredients, [class*="ingredients"]')
        
        for section in ingredient_sections:
            items = section.find_all('li')
            for item in items:
                text = item.get_text().strip()
                if text and len(text) > 3:
                    ingredients.append(text)
        
        recipe['recipeIngredient'] = [self._parse_ingredient_string(ing) for ing in ingredients]
        print(f"    ✅ Parsed {len(ingredients)} ingredients")
        
        return recipe if recipe['recipeIngredient'] else None
    
    def _extract_korean_bapsang(self, soup):
        """Specific extraction for Korean Bapsang website"""
        print("  🍜 Using Korean Bapsang specific extractor")
        
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
                print(f"    📝 Title: {recipe['name']}")
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
        print(f"    ✅ Parsed {len(ingredients)} ingredients")
        
        return recipe if recipe['recipeIngredient'] else None

    def _extract_json_ld(self, soup):
        """Extract recipe data from JSON-LD structured data"""
        script_tags = soup.find_all('script', type='application/ld+json')
        print(f"  🔍 Found {len(script_tags)} JSON-LD script tags")
        
        for i, script in enumerate(script_tags):
            try:
                script_content = script.string
                if not script_content:
                    continue
                
                # Remove CDATA if present
                if script_content.strip().startswith('/*<![CDATA[*/') or script_content.strip().startswith('//<![CDATA['):
                    script_content = re.sub(r'/\*<!\[CDATA\[\*/(.*?)/\*\]\]>\*/', r'\1', script_content, flags=re.DOTALL)
                
                data = json.loads(script_content)
                recipe = self._find_recipe_in_json(data)
                
                if recipe:
                    print(f"    ✓ Found recipe data in script tag #{i+1}")
                    parsed_recipe = self._parse_structured_recipe(recipe)
                    if parsed_recipe.get('recipeIngredient'):
                        ingredient_count = len(parsed_recipe['recipeIngredient'])
                        print(f"    ✅ Successfully parsed {ingredient_count} ingredients")
                        return parsed_recipe
                    
            except json.JSONDecodeError as e:
                print(f"    ⚠️ JSON decode error in script #{i+1}: {e}")
                continue
            except Exception as e:
                print(f"    ⚠️ Error parsing script #{i+1}: {e}")
                continue
        
        print("  ❌ No valid recipe data found in JSON-LD")
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
                parsed = self._parse_ingredient_string(ingredient)
                structured_ingredients.append(parsed)
        
        return structured_ingredients
        
    def _parse_ingredient_string(self, ingredient_text):
        """Parse a single ingredient string into structured format"""
        units = ['teaspoon', 'tsp', 'tablespoon', 'tbsp', 'cup', 'cups', 'ounce', 'oz', 'ounces', 
                'pound', 'lb', 'pounds', 'gram', 'g', 'grams', 'kg', 'kilogram', 'milliliter', 
                'ml', 'liter', 'l', 'pinch', 'dash', 'can', 'package', 'pkg', 'bunch', 'clove',
                'cloves', 'piece', 'pieces', 'slice', 'slices', 'package', 'pack', 'large',
                'medium', 'small', 'whole', 'fresh', 'dried', 'chopped', 'minced', 'sliced',
                'tablespoons', 'teaspoons', 'lbs']
        
        amount_pattern = r'^([\d\/\.\s-]+)\s*([a-zA-Z]*)\s*(.*)$'
        original_ingredient = ingredient_text.strip()
        match = re.match(amount_pattern, original_ingredient)
        
        if match:
            amount = match.group(1).strip()
            unit = match.group(2).strip()
            ingredient = match.group(3).strip()
            
            unit_lower = unit.lower()
            if unit and unit_lower in [u.lower() for u in units]:
                unit = unit_lower
            else:
                ingredient = f"{unit} {ingredient}".strip()
                unit = ""
            
            amount = self._convert_fraction_to_decimal(amount)
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
        """Extract only the main ingredient name"""
        if not ingredient_text:
            return ""
        
        cleaned = re.sub(r'\([^)]*\)', '', ingredient_text).strip()
        cleaned = re.sub(r'\[[^\]]*\]', '', cleaned).strip()
        
        preparation_terms = [
            'to taste', 'for serving', 'for garnish', 'garnish', 'optional',
            'divided', 'warm', 'cold', 'hot', 'room temperature'
        ]
        
        for term in preparation_terms:
            cleaned = re.sub(r'\b' + re.escape(term) + r'\b', '', cleaned, flags=re.IGNORECASE)
        
        quantity_patterns = [
            r'\b\d+\s*-\s*\d+\b',
            r'\b\d+\s*to\s*\d+\b',
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
        
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        cleaned = re.sub(r'^,\s*|\s*,$', '', cleaned)
        
        if not cleaned:
            cleaned = re.sub(r'\([^)]*\)', '', ingredient_text).strip()
        
        prefixes_to_remove = [
            r'^of\s+', r'^and\s+', r'^or\s+', r'^plus\s+',
            r'^about\s+', r'^approximately\s+',
        ]
        
        for prefix in prefixes_to_remove:
            cleaned = re.sub(prefix, '', cleaned, flags=re.IGNORECASE)
        
        cleaned = re.sub(r'^[,\s.-]+|[,\s.-]+$', '', cleaned)
        
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
        print("  🔍 Extracting from HTML meta tags and structure...")
        
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
        
        if recipe['name']:
            print(f"    📝 Title: {recipe['name']}")
        if recipe['recipeIngredient']:
            print(f"    ✅ Found {len(recipe['recipeIngredient'])} ingredients")
        
        return {k: v for k, v in recipe.items() if v}
    
    def _extract_title(self, soup):
        """Extract recipe title"""
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
                if text and len(text) > 20:
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


def extract_recipe_data(url):
    """Extract recipe data from a given URL."""
    try:
        print(f"\n🌐 Fetching URL: {url}")
        extractor = RecipeExtractor()
        recipe = extractor.extract_recipe_from_url(url)
        
        if not recipe:
            print("\n❌ Error: No recipe data found.")
            return None
        
        print(f"\n✅ Successfully extracted recipe: {recipe.get('name', 'Unknown')}")
        print(f"   Ingredients: {len(recipe.get('recipeIngredient', []))}")
        print(f"   Instructions: {len(recipe.get('recipeInstructions', []))}")
        return recipe
    except Exception as e:
        print(f"\n❌ Error extracting recipe: {e}")
        import traceback
        traceback.print_exc()
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