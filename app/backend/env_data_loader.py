"""
backend/env_data_loader.py
Environmental data loader for Parquet files with matrix structure
CSV Structure:
- First column: area_code (producing country: 1, 2, 3...)
- Other columns: commodity codes like "1_c001", "2_c002" (production_type_commodity)
- Values: environmental impact per unit
- To get total impact: SUM entire column for that commodity
"""
import pandas as pd
import time
import os
from flask import Blueprint, jsonify, request # type: ignore

# Create Blueprint
env_data_bp = Blueprint('env_data', __name__, url_prefix='/api')

# ============================================================================
# GLOBAL DATA CACHE
# Key format: "impactType_commodityCode" -> total_value (sum of column)
# Example: "biodiv_1_c001" -> 12.345 (sum of all countries for this commodity)
# ============================================================================
env_impact_cache = {}
env_dataframes = {}  # Store original dataframes for flexibility
metadata_cache = {}
_data_loaded = False

def get_data_path(filename):
    """Get path to data file in backend/data/FABIO_DELI/"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, 'data', 'FABIO_DELI', filename)

def load_env_impact_files():
    """
    Load all environmental impact Parquet files at startup
    CSV Structure:
    area_code,1_c001,1_c002,2_c001,2_c002,...
    1,0.123,0.456,0.789,0.111,...
    2,0.222,0.333,0.444,0.555,...
    3,0.666,0.777,0.888,0.999,...
    
    For each commodity column (e.g., "2_c002"), we sum all rows to get total impact
    """
    global _data_loaded
    
    if _data_loaded:
        print("⚙️ Environmental data already loaded, skipping...")
        return
    
    print("\n" + "="*70)
    print("LOADING ENVIRONMENTAL IMPACT DATA (Matrix Structure)")
    print("="*70)
    
    # Define your four impact files
    impact_files = {
        'biodiv': 'M_biodiv_2020',
        'gwp100': 'M_gwp100_2020',
        'landuse': 'M_landuse_2020',
        'water': 'M_water_2020'
    }
    
    total_start = time.time()
    total_entries = 0
    
    for impact_type, filename in impact_files.items():
        start_time = time.time()
        
        # Try Parquet first, fall back to CSV
        parquet_path = get_data_path(f'{filename}.parquet')
        csv_path = get_data_path(f'{filename}.csv')
        
        try:
            if os.path.exists(parquet_path):
                print(f"\n📊 Loading {filename}.parquet...")
                df = pd.read_parquet(parquet_path)
                file_type = "Parquet"
            elif os.path.exists(csv_path):
                print(f"\n📊 Loading {filename}.csv...")
                df = pd.read_csv(csv_path)
                file_type = "CSV"
            else:
                print(f"\n❌ Error: {filename} not found in backend/data/FABIO_DELI/")
                continue
            
            # Store the original dataframe
            env_dataframes[impact_type] = df
            
            # Get column names (skip first column which is area_code)
            area_code_col = df.columns[0]
            commodity_columns = df.columns[1:]
            
            print(f"   ✓ Loaded {len(df)} countries × {len(commodity_columns)} commodities")
            print(f"   ✓ Area code column: {area_code_col}")
            print(f"   ✓ Sample commodity columns: {list(commodity_columns[:5])}")
            
            # Process each commodity column - sum all values to get total impact
            entries_count = 0
            for commodity_code in commodity_columns:
                # Sum all values in this column (across all producing countries)
                column_sum = df[commodity_code].sum()
                
                # Store with key: "impactType_commodityCode"
                # Example: "biodiv_2_c002" -> 12.345
                cache_key = f"{impact_type}_{commodity_code}".lower()
                env_impact_cache[cache_key] = float(column_sum) if pd.notna(column_sum) else 0.0
                entries_count += 1
            
            total_entries += entries_count
            
            # Store metadata
            metadata_cache[impact_type] = {
                'countries': len(df),
                'commodities': len(commodity_columns),
                'entries_cached': entries_count,
                'memory_mb': round(df.memory_usage(deep=True).sum() / 1024**2, 2),
                'sample_columns': list(commodity_columns[:3])
            }
            
            elapsed = time.time() - start_time
            print(f"   ✓ Cached {entries_count:,} commodity totals")
            print(f"   ✓ Memory: {metadata_cache[impact_type]['memory_mb']} MB")
            print(f"   ✓ Time: {elapsed:.2f}s ({file_type})")
            
        except Exception as e:
            print(f"\n❌ Error loading {filename}: {e}")
            import traceback
            traceback.print_exc()
    
    total_time = time.time() - total_start
    print("\n" + "="*70)
    print(f"ENVIRONMENTAL DATA LOADED IN {total_time:.2f}s")
    print(f"Total datasets: {len(metadata_cache)}")
    print(f"Total cache entries: {total_entries:,}")
    print("="*70 + "\n")
    
    # Print sample lookups for verification
    print("📝 Sample cache keys:")
    sample_keys = list(env_impact_cache.keys())[:8]
    for key in sample_keys:
        print(f"   {key}: {env_impact_cache[key]:.6f}")
    print()
    
    _data_loaded = True


def lookup_impact(commodity_code, impact_type):
    """
    Fast lookup for total impact of a commodity
    
    Args:
        commodity_code: str (e.g., "1_c001", "2_c002" - with production type prefix)
        impact_type: str (e.g., "biodiv", "gwp100", "landuse", "water")
    
    Returns:
        float: total impact value (sum of entire column), or 0.0 if not found
    """
    # Normalize inputs
    commodity_code = str(commodity_code).strip().lower()
    impact_type = str(impact_type).strip().lower()
    
    # Build cache key
    cache_key = f"{impact_type}_{commodity_code}"
    
    return env_impact_cache.get(cache_key, 0.0)


def lookup_all_impacts(commodity_code):
    """
    Look up all four impact types for a given commodity
    
    Args:
        commodity_code: str (e.g., "1_c001", "2_c002")
    
    Returns:
        dict with all four impact values
    """
    return {
        'biodiv': lookup_impact(commodity_code, 'biodiv'),
        'gwp100': lookup_impact(commodity_code, 'gwp100'),
        'landuse': lookup_impact(commodity_code, 'landuse'),
        'water': lookup_impact(commodity_code, 'water')
    }


def find_commodity_columns(base_commodity_code):
    """
    Find all commodity columns that match a base code (e.g., find all variants of c001)
    
    Args:
        base_commodity_code: str (e.g., "c001", "c002")
    
    Returns:
        list of full commodity codes found (e.g., ["1_c001", "2_c001"])
    """
    base_code = base_commodity_code.lower().strip()
    
    # Get columns from first available dataframe
    if not env_dataframes:
        return []
    
    first_df = next(iter(env_dataframes.values()))
    columns = first_df.columns[1:]  # Skip area_code column
    
    # Find all columns that end with the base commodity code
    matching_columns = [
        col for col in columns 
        if col.lower().endswith(f"_{base_code}") or col.lower() == base_code
    ]
    
    return matching_columns


# ============================================================================
# API ENDPOINTS
# ============================================================================

@env_data_bp.route('/env-impacts/lookup', methods=['POST'])
def lookup_env_impact():
    """
    Look up environmental impact values
    
    Request body:
    {
        "commodity_code": "2_c002",  // Full code with production type
        "impact_type": "biodiv"       // Optional, if omitted returns all 4
    }
    
    OR search by base code:
    {
        "base_commodity_code": "c002",  // Find all variants (1_c002, 2_c002, etc.)
        "import_country_code": "2"       // Optional: filter by import country
    }
    """
    try:
        data = request.json
        
        # Option 1: Direct lookup with full commodity code
        if 'commodity_code' in data:
            commodity_code = data.get('commodity_code')
            impact_type = data.get('impact_type')
            
            # If specific impact type requested
            if impact_type:
                value = lookup_impact(commodity_code, impact_type)
                return jsonify({
                    'commodity_code': commodity_code,
                    'impact_type': impact_type,
                    'value': value
                })
            
            # Return all impact types
            impacts = lookup_all_impacts(commodity_code)
            return jsonify({
                'commodity_code': commodity_code,
                'impacts': impacts
            })
        
        # Option 2: Search by base commodity code
        elif 'base_commodity_code' in data:
            base_code = data.get('base_commodity_code')
            import_country = data.get('import_country_code')
            
            # Find all matching commodity columns
            matching_columns = find_commodity_columns(base_code)
            
            # Filter by import country if specified
            if import_country:
                matching_columns = [
                    col for col in matching_columns 
                    if col.startswith(f"{import_country}_")
                ]
            
            # Get impacts for each matching column
            results = []
            for col in matching_columns:
                impacts = lookup_all_impacts(col)
                results.append({
                    'commodity_code': col,
                    'impacts': impacts
                })
            
            return jsonify({
                'base_code': base_code,
                'import_country': import_country,
                'matches': len(results),
                'results': results
            })
        
        else:
            return jsonify({
                'error': 'Either commodity_code or base_commodity_code is required'
            }), 400
        
    except Exception as e:
        print(f"❌ Error in lookup_env_impact: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@env_data_bp.route('/env-impacts/breakdown', methods=['POST'])
def get_production_breakdown():
    """
    Get breakdown by producing country for a specific import/commodity
    
    Returns individual cell values from the matrix:
    - Each row (area_code) = producing country
    - Column value = that producer's contribution to the import
    
    Request body:
    {
        "import_country_code": "33",
        "commodity_code": "c002"
    }
    
    Returns impact from each producing country (each row/cell) for this commodity
    """
    try:
        data = request.json
        import_country_code = str(data.get('import_country_code', '')).strip()
        commodity_code = str(data.get('commodity_code', '')).strip()
        
        if not import_country_code or not commodity_code:
            return jsonify({
                'error': 'import_country_code and commodity_code are required'
            }), 400
        
        # Build full commodity column name
        full_commodity_code = f"{import_country_code}_{commodity_code}"
        
        # Check if environmental data is loaded
        if not env_dataframes:
            return jsonify({
                'error': 'Environmental data not loaded'
            }), 503
        
        # Get the first dataframe to check column existence
        first_df = next(iter(env_dataframes.values()))
        
        # Normalize column name for matching
        full_commodity_code_lower = full_commodity_code.lower()
        
        # Find matching column (case-insensitive)
        matching_column = None
        for col in first_df.columns[1:]:  # Skip area_code column
            if col.lower() == full_commodity_code_lower:
                matching_column = col
                break
        
        if not matching_column:
            return jsonify({
                'error': f'Commodity {full_commodity_code} not found',
                'requested': full_commodity_code,
                'sample_columns': list(first_df.columns[1:6])  # Show first 5 for debugging
            }), 404
        
        print(f"Found column: {matching_column} for request: {full_commodity_code}")
        
        # Get area_code column name
        area_code_col = first_df.columns[0]
        
        # Collect data from each producing country (each row)
        producing_countries = []
        
        for idx, row in first_df.iterrows():
            producing_country_code = str(row[area_code_col])
            
            # Get impact values from each dataset for this producing country
            impacts = {}
            has_data = False
            
            for impact_type, df in env_dataframes.items():
                if matching_column in df.columns:
                    cell_value = df.loc[idx, matching_column]
                    value = float(cell_value) if pd.notna(cell_value) else 0.0
                    impacts[impact_type] = value
                    if value != 0.0:
                        has_data = True
                else:
                    impacts[impact_type] = 0.0
            
            # Only include producing countries with non-zero impact
            if has_data:
                producing_countries.append({
                    'area_code': producing_country_code,
                    'biodiv': impacts.get('biodiv', 0.0),
                    'gwp100': impacts.get('gwp100', 0.0),
                    'landuse': impacts.get('landuse', 0.0),
                    'water': impacts.get('water', 0.0)
                })
        
        print(f"Found {len(producing_countries)} producing countries for {matching_column}")
        
        return jsonify({
            'success': True,
            'import_country_code': import_country_code,
            'commodity_code': commodity_code,
            'full_commodity_code': matching_column,
            'producing_countries': producing_countries,
            'total_producers': len(producing_countries)
        })
        
    except Exception as e:
        print(f"❌ Error in get_production_breakdown: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@env_data_bp.route('/env-impacts/batch', methods=['POST'])
def batch_lookup():
    """
    Efficient batch lookup for multiple commodities
    
    Request body:
    {
        "items": [
            {"commodity_code": "1_c001"},
            {"commodity_code": "2_c002"},
            ...
        ]
    }
    
    Returns all 4 impact types for each item
    """
    try:
        data = request.json
        items = data.get('items', [])
        
        results = []
        for item in items:
            commodity_code = item.get('commodity_code')
            
            if commodity_code:
                impacts = lookup_all_impacts(commodity_code)
                results.append({
                    'commodity_code': commodity_code,
                    'impacts': impacts
                })
        
        return jsonify({
            'success': True,
            'count': len(results),
            'results': results
        })
        
    except Exception as e:
        print(f"❌ Error in batch_lookup: {e}")
        return jsonify({'error': str(e)}), 500


@env_data_bp.route('/env-impacts/stats')
def get_env_stats():
    """Get statistics about loaded environmental data"""
    if not env_impact_cache:
        return jsonify({
            'loaded': False,
            'message': 'Environmental data not loaded'
        })
    
    return jsonify({
        'loaded': True,
        'datasets': metadata_cache,
        'total_entries': len(env_impact_cache),
        'total_memory_mb': sum(m['memory_mb'] for m in metadata_cache.values()),
        'structure': 'matrix (countries × commodities)'
    })


@env_data_bp.route('/env-impacts/commodities', methods=['GET'])
def get_available_commodities():
    """Get list of all available commodity codes"""
    try:
        if not env_dataframes:
            return jsonify({'commodities': [], 'count': 0})
        
        # Get commodity columns from first dataset
        first_df = next(iter(env_dataframes.values()))
        commodity_columns = list(first_df.columns[1:])  # Skip area_code
        
        return jsonify({
            'commodities': commodity_columns,
            'count': len(commodity_columns)
        })
    except Exception as e:
        print(f"❌ Error getting commodities: {e}")
        return jsonify({'error': str(e)}), 500


@env_data_bp.route('/env-impacts/test', methods=['GET'])
def test_lookup():
    """
    Test endpoint to verify lookups are working
    Tests a few sample lookups
    """
    # Get sample commodity codes from cache
    sample_keys = [key for key in env_impact_cache.keys() if key.startswith('biodiv_')][:3]
    
    test_results = []
    for key in sample_keys:
        # Extract commodity code from key
        commodity_code = key.replace('biodiv_', '')
        impacts = lookup_all_impacts(commodity_code)
        
        test_results.append({
            'commodity_code': commodity_code,
            'impacts': impacts,
            'has_data': any(v != 0.0 for v in impacts.values())
        })
    
    return jsonify({
        'test_cases': test_results,
        'total_cache_entries': len(env_impact_cache),
        'sample_cache_keys': list(env_impact_cache.keys())[:10]
    })


@env_data_bp.route('/health')
def health_check():
    """Check if data is loaded and service is ready"""
    return jsonify({
        'status': 'ok' if _data_loaded else 'loading',
        'datasets_loaded': len(metadata_cache),
        'datasets': list(metadata_cache.keys()),
        'cache_entries': len(env_impact_cache),
        'ready': _data_loaded,
        'structure': 'matrix'
    })