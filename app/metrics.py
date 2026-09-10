from flask import Blueprint, request, jsonify # type: ignore
from datetime import datetime
from backend.metrics.db_connection import get_db_connection # type: ignore

metrics_bp = Blueprint('metrics', __name__)

@metrics_bp.route('/api/track-usage', methods=['POST'])
def track_usage():
    """Simply increment counter for a country"""
    try:
        data = request.json
        country_code_iso3 = data.get('countryCodeISO3')
        country_name = data.get('countryName')
        action = data.get('action', 'view')  # 'view' or 'calculation'
        
        if not country_code_iso3 or not country_name:
            return jsonify({'error': 'Missing country information'}), 400
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if country exists
            cursor.execute("""
                SELECT id FROM app_usage_stats 
                WHERE country_code_iso3 = ?
            """, (country_code_iso3,))
            
            existing = cursor.fetchone()
            
            if existing:
                # Update existing record
                if action == 'calculation':
                    cursor.execute("""
                        UPDATE app_usage_stats 
                        SET calculation_count = calculation_count + 1,
                            last_updated = CURRENT_TIMESTAMP
                        WHERE country_code_iso3 = ?
                    """, (country_code_iso3,))
                else:
                    cursor.execute("""
                        UPDATE app_usage_stats 
                        SET view_count = view_count + 1,
                            last_updated = CURRENT_TIMESTAMP
                        WHERE country_code_iso3 = ?
                    """, (country_code_iso3,))
            else:
                # Insert new record
                view_count = 1 if action == 'view' else 0
                calc_count = 1 if action == 'calculation' else 0
                
                cursor.execute("""
                    INSERT INTO app_usage_stats 
                    (country_code_iso3, country_name, view_count, calculation_count)
                    VALUES (?, ?, ?, ?)
                """, (country_code_iso3, country_name, view_count, calc_count))
            
            conn.commit()
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"Error tracking usage: {e}")
        return jsonify({'error': str(e)}), 500

@metrics_bp.route('/api/metrics/overview')
def get_metrics_overview():
    """Get overall statistics"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Total views
            cursor.execute("SELECT COALESCE(SUM(view_count), 0) FROM app_usage_stats")
            total_views = cursor.fetchone()[0]
            
            # Total calculations
            cursor.execute("SELECT COALESCE(SUM(calculation_count), 0) FROM app_usage_stats")
            recipes_analyzed = cursor.fetchone()[0]
            
            # Countries reached
            cursor.execute("SELECT COUNT(*) FROM app_usage_stats")
            countries_reached = cursor.fetchone()[0]
            
            # Estimate unique visitors (rough estimate: views / 3)
            unique_visitors = max(1, int(total_views / 3))
        
        return jsonify({
            'totalViews': total_views,
            'uniqueVisitors': unique_visitors,
            'recipesAnalyzed': recipes_analyzed,
            'countriesReached': countries_reached
        })
    except Exception as e:
        print(f"Error getting overview: {e}")
        return jsonify({'error': str(e)}), 500

@metrics_bp.route('/api/metrics/by-country')
def get_users_by_country():
    """Get usage statistics by country"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    country_code_iso3,
                    country_name,
                    view_count
                FROM app_usage_stats
                WHERE view_count > 0
                ORDER BY view_count DESC
                LIMIT 20
            """)
            
            results = cursor.fetchall()
            
            countries = [{
                'countryCode': row['country_code_iso3'],
                'country': row['country_name'],
                'count': row['view_count']
            } for row in results]
        
        return jsonify({'countries': countries})
    except Exception as e:
        print(f"Error getting countries: {e}")
        return jsonify({'error': str(e)}), 500

@metrics_bp.route('/api/metrics/monthly-trends')
def get_monthly_trends():
    """Get monthly trends - simplified for SQLite"""
    try:
        # For now, return mock data since we need time-series tracking
        # You can enhance this later with a separate table for daily/monthly stats
        months = [
            {'month': 'Jan', 'views': 0, 'visitors': 0},
            {'month': 'Feb', 'views': 0, 'visitors': 0},
            {'month': 'Mar', 'views': 0, 'visitors': 0},
            {'month': 'Apr', 'views': 0, 'visitors': 0},
            {'month': 'May', 'views': 0, 'visitors': 0},
            {'month': 'Jun', 'views': 0, 'visitors': 0}
        ]
        
        return jsonify({'months': months})
    except Exception as e:
        print(f"Error getting trends: {e}")
        return jsonify({'error': str(e)}), 500