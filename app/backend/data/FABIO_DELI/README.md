# FABIO results for DELI calculator

Data files are full supply chain multipliers

run on 2025-12-01 (excluding water biodiversity)


## Data format:

Row index: area code (see 

Column index: areacode_sectorcode (see 

## Usage

1. Check for where the product is coming from (area code)
2. Check which product (c_ sector code)
3. Convert unit product mass tonnes or 1000 heads (as in M_unit_2020.csv)
3. Build the areacode_sectorcode string
4. Select the corresponding column in the data file
5. Get all impacts in all countries in the row of the corresponding column
6. Do this for all impacts and get the corresponding units from M_units_2020.csv 

## History

First provided by Konstantin Stadler on 19/11/2025 based on FABIO with stimulants extension provided by Eli Wilson in November 2025. 
Eli provided the conversion from rds files to csv format 
Git run id: 2efff74 2025-11-19
