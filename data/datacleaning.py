# flake8: noqa

import pandas as pd
import geopandas as gpd

def geojson_to_file(df, output):
    df.to_file(output, driver = 'GeoJSON')
    print(f"Cleaned Data saved to: {output}")

def merge_clean(gdf, df, left, right, drops):
    merged_gdf = gdf.merge(df, left_on = left, right_on = right, how = "inner")
    merged_gdf = merged_gdf.drop(columns = drops)
    return merged_gdf

def filter_by_year(gdf, year_column, min_year = 1950):
    return gdf[gdf[year_column] >= min_year]

CountriesShape = gpd.read_file("data/countries.geo.json")
CountriesShape = CountriesShape.to_crs(epsg = 4326)
emissions = pd.read_csv("data/co2-emissions.csv")
density = pd.read_csv("data/population-densityy.csv")

CountryEmissions = merge_clean(CountriesShape, emissions, "id", "Code", ["Entity", "Code"])
CountryEmissions = CountryEmissions.rename(columns = {'Annual CO₂ emissions (per capita)':'Emissions'})
CountryEmissions['Emissions'] = CountryEmissions['Emissions'].round(3)

CountryDensity = merge_clean(CountriesShape, density, "id", "Code", ["Entity", "Code"])
CountryDensity = CountryDensity.rename(columns = {'Population density':'PopDensity'})
CountryDensity['PopDensity'] = CountryDensity['PopDensity'].round(3)

CountryEmissions = filter_by_year(CountryEmissions, "Year", 1950)
CountryDensity = filter_by_year(CountryDensity, "Year", 1950)

geojson_to_file(CountryEmissions, "data/GeoJson/Emissions.geojson")
geojson_to_file(CountryDensity, "data/GeoJson/Density.geojson")