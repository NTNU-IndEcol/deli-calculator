// frontend/static/js/ingredient-name-extractor.js

/**
 * Extracts the core ingredient name from detailed product descriptions
 * Examples:
 *   "norvegia cheese 26% large slice 550 g" → "cheese"
 *   "soft flora original butter" → "butter"
 *   "red paprika" → "paprika"
 *   "sandwich baguette 90g molin" → "baguette"
 */
export class IngredientNameExtractor {
    
    // Common food keywords that should be kept as the main ingredient
    static CORE_INGREDIENTS = [
        // Dairy
        'cheese', 'butter', 'milk', 'cream', 'yogurt', 'yoghurt',
        // Meat & Fish
        'chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'prawn',
        // Vegetables
        'tomato', 'potato', 'onion', 'garlic', 'carrot', 'lettuce', 'cabbage', 'pepper', 'paprika',
        'cucumber', 'spinach', 'broccoli', 'cauliflower', 'mushroom', 'corn', 'peas',
        // Fruits
        'apple', 'banana', 'orange', 'lemon', 'lime', 'berry', 'strawberry', 'blueberry',
        // Grains & Bread
        'bread', 'baguette', 'rice', 'pasta', 'noodle', 'flour', 'wheat', 'oat', 'barley',
        // Other
        'egg', 'oil', 'sugar', 'salt', 'pepper', 'sauce', 'wine', 'beer', 'water'
    ];
    
    // Words to remove (measurements, brands, modifiers)
    static NOISE_WORDS = [
        // Measurements
        'g', 'kg', 'ml', 'l', 'oz', 'lb', 'cup', 'tbsp', 'tsp',
        // Numbers and percentages
        '\\d+', '%', 'percent',
        // Size descriptors
        'large', 'small', 'medium', 'big', 'mini', 'jumbo',
        // Quality descriptors
        'fresh', 'organic', 'natural', 'pure', 'extra', 'premium', 'original', 'classic',
        // Processing
        'whole', 'sliced', 'diced', 'chopped', 'shredded', 'grated', 'ground',
        // Packaging
        'pack', 'package', 'can', 'bottle', 'jar', 'box', 'bag',
        // Common brand words
        'brand', 'co', 'company', 'farm', 'valley', 'mountain', 'river'
    ];
    
    /**
     * Extract the core ingredient name from a detailed description
     */
    static extract(fullName) {
        if (!fullName) return '';
        
        console.log(`🔍 Extracting core name from: "${fullName}"`);
        
        // Step 1: Clean and normalize
        let cleaned = fullName
            .toLowerCase()
            .trim()
            // Remove common measurements with numbers (e.g., "550g", "26%")
            .replace(/\d+\s*(g|kg|ml|l|oz|lb|%|percent)/gi, '')
            // Remove standalone numbers
            .replace(/\b\d+\b/g, '')
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            .trim();
        
        console.log(`  → Cleaned: "${cleaned}"`);
        
        // Step 2: Try to find a core ingredient keyword
        const words = cleaned.split(' ');
        
        for (const coreIngredient of this.CORE_INGREDIENTS) {
            // Check if core ingredient appears in the text
            if (cleaned.includes(coreIngredient)) {
                console.log(`  ✓ Found core ingredient: "${coreIngredient}"`);
                return coreIngredient;
            }
        }
        
        // Step 3: If no core ingredient found, remove noise words and take the most significant word
        const significantWords = words.filter(word => {
            // Skip very short words
            if (word.length < 3) return false;
            
            // Skip noise words
            const isNoise = this.NOISE_WORDS.some(noise => {
                const pattern = new RegExp(`^${noise}$`, 'i');
                return pattern.test(word);
            });
            
            return !isNoise;
        });
        
        console.log(`  → Significant words: [${significantWords.join(', ')}]`);
        
        // Step 4: Return the last significant word (usually the main noun)
        // Examples: "soft flora original butter" → "butter"
        //           "red bell pepper" → "pepper"
        if (significantWords.length > 0) {
            const extracted = significantWords[significantWords.length - 1];
            console.log(`  ✓ Extracted: "${extracted}"`);
            return extracted;
        }
        
        // Step 5: Fallback - return first word if nothing else works
        console.log(`  ⚠ Fallback to first word: "${words[0]}"`);
        return words[0] || fullName;
    }
    
    /**
     * Extract with display name
     * Returns: { display: original name, core: extracted name }
     */
    static extractWithDisplay(fullName) {
        const core = this.extract(fullName);
        
        // Create a simplified display name (remove measurements but keep brand/style)
        const display = fullName
            .replace(/\d+\s*(g|kg|ml|l|oz|lb)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        return {
            display: display,
            core: core,
            original: fullName
        };
    }
    
    /**
     * Test the extraction with common examples
     */
    static test() {
        const examples = [
            'norvegia cheese 26% large slice 550 g',
            'soft flora original butter',
            'red paprika',
            'Crispi salad',
            'sandwich baguette 90g molin',
            'organic free range chicken breast 500g',
            'extra virgin olive oil 1l',
            'whole milk 2%',
            'fresh strawberries 250g'
        ];
        
        console.log('🧪 Testing ingredient extraction:');
        examples.forEach(example => {
            const result = this.extractWithDisplay(example);
            console.log(`\n"${example}"`);
            console.log(`  → Display: "${result.display}"`);
            console.log(`  → Core: "${result.core}"`);
        });
    }
}