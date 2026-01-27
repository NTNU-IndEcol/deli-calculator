import sqlite3
import os
from backend.metrics.db_connection import DB_PATH

def view_statistics():
    """Display all usage statistics from the database"""
    
    # Check if database exists
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at: {DB_PATH}")
        print("Run your Flask app first to create the database.")
        return
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("\n" + "="*70)
        print("📊 DELI Calculator Usage Statistics")
        print("="*70 + "\n")
        
        # Get all country stats
        cursor.execute("""
            SELECT country_name, country_code_iso3, view_count, calculation_count, last_updated
            FROM app_usage_stats
            ORDER BY view_count DESC
        """)
        
        results = cursor.fetchall()
        
        if results:
            print(f"{'Country':<25} {'Code':<6} {'Views':<8} {'Calcs':<8} {'Last Updated':<20}")
            print("-"*70)
            
            for row in results:
                country = row[0] or 'Unknown'
                code = row[1] or 'N/A'
                views = row[2] or 0
                calcs = row[3] or 0
                updated = row[4] or 'Never'
                print(f"{country:<25} {code:<6} {views:<8} {calcs:<8} {updated:<20}")
        else:
            print("📭 No usage data yet. Visit your app to generate some statistics!")
        
        # Get totals
        cursor.execute("""
            SELECT 
                COALESCE(SUM(view_count), 0) as total_views,
                COALESCE(SUM(calculation_count), 0) as total_calcs,
                COUNT(*) as total_countries
            FROM app_usage_stats
        """)
        
        totals = cursor.fetchone()
        
        print("\n" + "="*70)
        print(f"📈 Total Views:           {totals[0]}")
        print(f"🧮 Total Calculations:    {totals[1]}")
        print(f"🌍 Countries Reached:     {totals[2]}")
        print(f"👥 Est. Unique Visitors:  {max(1, int(totals[0] / 3))}")
        print("="*70 + "\n")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    view_statistics()