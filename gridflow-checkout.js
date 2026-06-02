document.addEventListener("DOMContentLoaded", () => {
    const geoButton = document.getElementById("gf-geo-trigger");
    const pinInput = document.getElementById("gf-pincode-input");
    const mapContainer = document.getElementById("gf-map-wrapper");
    const digipinOutput = document.getElementById("gf-digipin-display");
    const addressLine2 = document.getElementById("shipping-address-2");
    const verticalDensitySection = document.getElementById("gf-vertical-density-layer");
    const flatInput = document.getElementById("gf-flat-number");

    let capturedDigipin = "";

    // BUG FIX 3: Educational UX gate. Never call Geolocation on mount. 
    geoButton.addEventListener("click", () => {
        geoButton.innerText = "Accessing GPS...";
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                processCoordinates(lat, lng);
            },
            (error) => {
                console.warn("GPS Access Denied/Timed out. Triggering Fallback UI.");
                geoButton.innerText = "GPS Unavailable - Pin via Map";
                mapContainer.style.display = "block";
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    });

    // Listen for traditional 6-digit PIN code to center the fallback map
    pinInput.addEventListener("input", async (e) => {
        const val = e.target.value.trim();
        if (val.length === 6 && !isNaN(val)) {
            // Fetch local, zero-cost JSON array centroid
            const response = await fetch('pincode-centroids.json');
            const data = await response.json();
            
            if (data[val]) {
                const [lat, lng] = data[val];
                mapContainer.style.display = "block";
                simulateMapCentering(lat, lng);
            }
        }
    });

    function simulateMapCentering(lat, lng) {
        // In a live environment, you instantiate your canvas view layer here.
        // For our high-performance component, we track canvas map pixel drags.
        const mockMapCanvas = document.getElementById("gf-mock-canvas");
        mockMapCanvas.onclick = () => {
            // User clicks target crosshair on their roof
            processCoordinates(lat + 0.001, lng - 0.001); 
        };
    }

    function processCoordinates(lat, lng) {
        const code = GridFlowCore.encode(lat, lng);
        if (code) {
            capturedDigipin = code;
            digipinOutput.value = code;
            
            // BUG FIX 1: Check for vertical density / high-rise footprint match
            if (GridFlowCore.isHighDensityZone(lat, lng)) {
                verticalDensitySection.style.display = "block";
                flatInput.setAttribute("required", "true");
                flatInput.focus();
            } else {
                verticalDensitySection.style.display = "none";
                flatInput.removeAttribute("required");
                updateShippingManifest();
            }
        }
    }

    // Listens for flat/floor input inside high-density blocks to finish the payload assembly
    flatInput.addEventListener("input", () => {
        updateShippingManifest();
    });

    function updateShippingManifest() {
        const flatDetails = flatInput.value.trim();
        const prefix = flatDetails ? `DIGIPIN: ${capturedDigipin} (Flr/Flat: ${flatDetails})` : `DIGIPIN: ${capturedDigipin}`;
        
        // Secure checkout metadata injection inside standard Address Line 2
        addressLine2.value = prefix;
    }
});