document.addEventListener("DOMContentLoaded", async function () {
    mapboxgl.accessToken = 'pk.eyJ1IjoidGhlbmV4dGdlbiIsImEiOiJjbTZ0dTM4Nm8wNnFxMmpxMzR5aTFlNWNmIn0.0ijMpCWFd8inU3E37iqQQQ';

    const introPage = document.getElementById("intro-page");
    const startButton = document.getElementById("start-exploring");

    startButton.addEventListener("click", function () {
        introPage.classList.add("fade-out");

        // Hide the intro page completely after the animation duration (1s)
        setTimeout(() => {
            introPage.style.display = "none";
        }, 1000);
    });

    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/thenextgen/cm85m31ed006g01ss9km1hf9s',
        center: [10, 52],
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

    // Initial data load
    let densityGeoJSON = await loadGeoJSON('data/GeoJson/Density.geojson');
    let emissionsGeoJSON = await loadGeoJSON('data/GeoJson/Emissions.geojson');
    if (!densityGeoJSON || !emissionsGeoJSON) return;

    // Function to filter data by year
    function filterDataByYear(year) {
        const filteredDensity = {
            type: "FeatureCollection",
            features: densityGeoJSON.features.filter(f => f.properties.Year === year)
        };

        const filteredEmissions = {
            type: "FeatureCollection",
            features: emissionsGeoJSON.features.filter(f => f.properties.Year === year)
        };

        return { filteredDensity, filteredEmissions };
    }

    // Function to update map layers dynamically
    function updateMapForYear(year) {
        const { filteredDensity, filteredEmissions } = filterDataByYear(year);

        // Create a Map to store country properties
        const countryDataMap = {};

        // Populate countryDataMap with density data
        filteredDensity.features.forEach(feature => {
            const countryName = feature.properties.name;
            if (!countryDataMap[countryName]) {
                countryDataMap[countryName] = {}; // Initialize object if not existing
    }
        countryDataMap[countryName].population_density = feature.properties.PopDensity;
});

        // Populate countryDataMap with emission data
        filteredEmissions.features.forEach(feature => {
            const countryName = feature.properties.name;
            if (!countryDataMap[countryName]) {
                countryDataMap[countryName] = {}; // Initialize if not existing
    }
        countryDataMap[countryName].emissionsCapita = feature.properties.Emissions;
});

        // Generate centroids based on polygons in emissionsGeoJSON
        const centroidFeatures = filteredEmissions.features.map(feature => {
            const countryName = feature.properties.name;
            const properties = countryDataMap[countryName];
            if (!properties) return null;

            const emissionsCapita = properties.emissionsCapita;
            const populationDensity = properties.population_density;

            const centroid = turf.centroid(feature); // Compute centroid
            return {
                type: 'Feature',
                geometry: centroid.geometry,
                properties: {
                    country_name: countryName,
                    emissions_per_capita: emissionsCapita,
                    population_density: populationDensity
                }
            };
        }).filter(f => f !== null);

        const centroidGeoJSON = { type: 'FeatureCollection', features: centroidFeatures };

        // Update the sources dynamically
        map.getSource('pop-density').setData(filteredDensity);
        map.getSource('country-centroids').setData(centroidGeoJSON);
    }

    // Add sources to the map
    map.on('load', async () => {
        const { filteredDensity, filteredEmissions } = filterDataByYear(2023); // Default year

        map.addSource('pop-density', { type: 'geojson', data: filteredDensity });
        map.addSource('country-centroids', { type: 'geojson', data: { "type": "FeatureCollection", "features": [] } });

        // Add layers
        map.addLayer({
            id: 'density-layer',
            type: 'fill',
            source: 'pop-density',
            paint: {
                'fill-color': ['interpolate', ['linear'], ['get', 'PopDensity'],
                    0, '#e0f3f8',
                    60, '#abd9e9',
                    90, '#74add1',
                    125, '#4575b4',
                    1650, '#313695'],
                'fill-opacity': 0.6
            }
        });

        map.addLayer({
            id: 'country-points',
            type: 'circle',
            source: 'country-centroids',
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'emissions_per_capita'],
                    0, 4,
                    3, 8,
                    5, 12,
                    6.5, 18,
                    8, 25,
                    10.5, 35,
                    40, 50
                ],
                'circle-color': [
                    'interpolate', ['linear'], ['get', 'emissions_per_capita'],
                    0, '#008000',
                    3, '#66A000',
                    5, '#B0C000',
                    6.5, '#FFD700',
                    8, '#FFA500',
                    10.5, '#FF4500',
                    40, '#FF0000'
                ],
                'circle-opacity': 0.8
            }
        });

        updateMapForYear(2023);

        // Handle slider changes to update the map dynamically
        const slider = document.getElementById("co2-slider");
        const sliderValue = document.getElementById("co2-value");

        slider.addEventListener("input", function () {
            const year = parseInt(slider.value);
            sliderValue.textContent = year;
            updateMapForYear(year);
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
                        Emissions Per Capita: ${properties.emissions_per_capita}
                    `)
                    .addTo(map);
            }
        });

        // Change cursor on hover
        map.on('mouseenter', 'country-points', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'country-points', () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        });
    });
});
