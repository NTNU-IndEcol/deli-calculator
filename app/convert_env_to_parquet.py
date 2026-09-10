"""
convert_to_parquet.py
One-time conversion script for environmental impact CSV files
Run this from your project root: python convert_to_parquet.py
"""
import pandas as pd
import time
import os

# Path to your CSV files
DATA_DIR = 'backend/data/FABIO_DELI'

files = [
    'M_biodiv_2020',
    'M_gwp100_2020',
    'M_landuse_2020',
    'M_water_2020'
]

print("="*70)
print("CSV to Parquet Conversion Script")
print("="*70)
print(f"\nData directory: {DATA_DIR}\n")

total_start = time.time()

for filename in files:
    csv_path = os.path.join(DATA_DIR, f'{filename}.csv')
    parquet_path = os.path.join(DATA_DIR, f'{filename}.parquet')
    
    if not os.path.exists(csv_path):
        print(f"❌ {filename}.csv not found, skipping...")
        continue
    
    print(f"\n📄 Processing {filename}.csv...")
    start_time = time.time()
    
    try:
        # Read CSV
        print("   Reading CSV...")
        df = pd.read_csv(csv_path)
        
        # Display info
        print(f"   ✓ Rows: {len(df):,}")
        print(f"   ✓ Columns: {len(df.columns)}")
        print(f"   ✓ Column names: {list(df.columns)}")
        
        csv_size_mb = os.path.getsize(csv_path) / 1024**2
        memory_mb = df.memory_usage(deep=True).sum() / 1024**2
        print(f"   ✓ CSV file size: {csv_size_mb:.2f} MB")
        print(f"   ✓ Memory usage: {memory_mb:.2f} MB")
        
        # Save as Parquet with compression
        print("   Writing Parquet...")
        df.to_parquet(parquet_path, compression='snappy', index=False)
        
        # Compare file sizes
        parquet_size_mb = os.path.getsize(parquet_path) / 1024**2
        compression_ratio = (1 - parquet_size_mb/csv_size_mb) * 100
        
        elapsed = time.time() - start_time
        
        print(f"   ✓ Parquet file size: {parquet_size_mb:.2f} MB")
        print(f"   ✓ Compression: {compression_ratio:.1f}% smaller")
        print(f"   ✓ Time: {elapsed:.2f}s")
        print(f"   ✅ Saved {filename}.parquet")
        
        # Test loading speed
        test_start = time.time()
        test_df = pd.read_parquet(parquet_path)
        test_time = time.time() - test_start
        print(f"   ✓ Load test: {test_time:.2f}s (Parquet)")
        
        # Compare with CSV load time
        csv_start = time.time()
        test_csv = pd.read_csv(csv_path)
        csv_time = time.time() - csv_start
        speedup = csv_time / test_time
        print(f"   ✓ CSV load time: {csv_time:.2f}s")
        print(f"   🚀 Speedup: {speedup:.1f}x faster!")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()

total_time = time.time() - total_start

print("\n" + "="*70)
print(f"Conversion completed in {total_time:.2f}s")
print("="*70)

print("\n📝 Next steps:")
print("1. Your Parquet files are ready in backend/data/FABIO_DELI/")
print("2. You can keep the CSV files as backup or delete them")
print("3. Start your app: python app.py")
print("4. The backend will automatically use Parquet files for 5-10x faster loading!")