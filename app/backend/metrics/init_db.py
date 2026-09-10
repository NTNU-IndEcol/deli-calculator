import sqlite3
import os

def init_database():
    """Initialize SQLite database with metrics table"""
    
    # Create database directory if it doesn't exist
    db_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    os.makedirs(db_dir, exist_ok=True)
    
    # Database file path
    db_path = os.path.join(db_dir, 'deli_metrics.db')
    
    # Connect to database (creates file if doesn't exist)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create metrics table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_usage_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            country_code_iso3 VARCHAR(3) UNIQUE NOT NULL,
            country_name VARCHAR(100),
            view_count INTEGER DEFAULT 0,
            calculation_count INTEGER DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create index for faster lookups
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_usage_country 
        ON app_usage_stats(country_code_iso3)
    """)
    
    conn.commit()
    conn.close()
    
    print(f"✅ Database initialized at: {db_path}")
    return db_path

if __name__ == '__main__':
    init_database()