document.addEventListener("DOMContentLoaded", async function () {
    mapboxgl.accessToken = 'pk.eyJ1IjoidGhlbmV4dGdlbiIsImEiOiJjbTZ0dTM4Nm8wNnFxMmpxMzR5aTFlNWNmIn0.0ijMpCWFd8inU3E37iqQQQ';

    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/light-v10',
        center: [10, 50],
        zoom: 3
    });

    // Function to load GeoJSON data
    async function loadGeoJSON(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Error loading ${url}:`, error);
        }
    }

    map.on('load', async () => {
        // Load datasets
        const densityGeoJSON = await loadGeoJSON('data/GeoJson/Density.geojson');
        const emissionsGeoJSON = await loadGeoJSON('data/GeoJson/Emissions.geojson');
        if (!densityGeoJSON || !emissionsGeoJSON) return;

        // Create a Map to store country properties
        const countryDataMap = {};

        // Populate countryDataMap with density data
        densityGeoJSON.features.forEach(feature => {
            const countryName = feature.properties.name;
            countryDataMap[countryName] = {
                population_density: feature.properties.PopDensity
            };
        });

        // Populate countryDataMap with emission data (merging by country name)
        emissionsGeoJSON.features.forEach(feature => {
            const countryName = feature.properties.name;
            if (countryDataMap[countryName]) {
                countryDataMap[countryName].co2_total = feature.properties.Emissions;
            }
        });

        // Generate centroids based on polygons in emissionsGeoJSON
        const centroidFeatures = emissionsGeoJSON.features.map(feature => {
            const countryName = feature.properties.name;
            const properties = countryDataMap[countryName];
            if (!properties) return null; // Skip if no matching data

            const emissionsCapita = properties.co2_total / properties.population_density;
            const centroid = turf.centroid(feature); // Compute centroid

            return {
                type: 'Feature',
                geometry: centroid.geometry,
                properties: {
                    country_name: countryName,
                    population_density: properties.population_density,
                    co2_total: properties.co2_total,
                    emissions_per_capita: emissionsCapita
                }
            };
        }).filter(f => f !== null); // Remove null values

        // Log data ranges for debugging
        const emissionsCapitaValues = centroidFeatures.map(f => f.properties.emissions_per_capita);
        const co2TotalValues = centroidFeatures.map(f => f.properties.co2_total);
        console.log("Emissions Per Capita Range:", Math.min(...emissionsCapitaValues), Math.max(...emissionsCapitaValues));
        console.log("CO₂ Total Range:", Math.min(...co2TotalValues), Math.max(...co2TotalValues));

        const centroidGeoJSON = { type: 'FeatureCollection', features: centroidFeatures };

        // Add source for centroids
        map.addSource('country-centroids', { type: 'geojson', data: centroidGeoJSON });

        // Add layer to visualize the points
        map.addLayer({
            id: 'country-points',
            type: 'circle',
            source: 'country-centroids',
            paint: {
                // Size based on total CO₂ emissions
                'circle-radius': [
                    'interpolate', ['linear'],
                    ['get', 'co2_total'],
                    0, 5,   // Minimum value, minimum radius
                    10, 30  // Maximum value, maximum radius
                ],
                // Color based on emissions per capita
                'circle-color': [
                    'interpolate', ['linear'], ['get', 'emissions_per_capita'],
                    0, '#008000', // Green for low emissions per capita
                    0.5, '#ffff00', // Yellow for medium emissions per capita
                    1, '#ff0000'  // Red for high emissions per capita
                ],
                'circle-opacity': 0.8
            }
        });

        // Show info popup on hover
        let popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false
        });
        
        map.on('mousemove', 'country-points', (e) => {
            if (e.features.length > 0) {
                const properties = e.features[0].properties;
        
                popup.setLngLat(e.lngLat)
                    .setHTML(`
                        <strong>${properties.country_name}</strong><br>
                        Population Density: ${properties.population_density} people/km²<br>
                        Total CO₂ Emissions: ${properties.co2_total} Mt<br>
                        Emissions Per Capita: ${properties.emissions_per_capita}
                    `)
                    .addTo(map);
            }
        });

        // Change cursor on hover
        map.on('mouseenter', 'country-points', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'country-points', () => {
            map.getCanvas().style.cursor = '';
            popup.remove(); // Remove the popup when leaving the feature
        });


        // Add slider event listener
        document.getElementById('co2-slider').addEventListener('input', function (event) {
            const value = parseFloat(event.target.value); // Get slider value
            document.getElementById('co2-value').textContent = `${value} Mt (Megatonnes of CO₂)`; // Update label

            // Filter or update the map based on the slider value
            map.setFilter('country-points', ['>=', ['get', 'co2_total'], value]);
        });
    });
});