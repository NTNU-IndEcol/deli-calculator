import sqlite3
import os
from contextlib import contextmanager

# Get the absolute path to the database file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'data', 'deli_metrics.db')

@contextmanager
def get_db_connection():
    """Get database connection with automatic cleanup"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Return rows as dictionaries
    try:
        yield conn
    finally:
        conn.close()

def get_cursor():
    """Get database cursor (for simple queries)"""
    conn = sqlite3.connect(DB_PATH)
    return conn, conn.cursor()