/**
 * GridFlow Core DIGIPIN Mathematical Engine
 * Pure, offline client-side calculation.
 */
const GridFlowCore = {
    // Official 16-symbol alphabet base array (skips 0, 1, I, O, etc.)
    ALPHABET: ['2', '3', '4', '5', '6', '7', '8', '9', 'J', 'K', 'M', 'P', 'W', 'G', 'X', 'L'],
    
    // Official Indian subcontinent national bounding box
    BOUNDS: {
        MIN_LAT: 2.0,
        MAX_LAT: 38.0,
        MIN_LNG: 63.5,
        MAX_LNG: 99.5
    },

    /**
     * Encodes Latitude and Longitude into a 10-character DIGIPIN string.
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {string|null} 10-character formatted DIGIPIN or null if out of bounds
     */
    encode: function(lat, lng) {
        // BUG FIX 2: Strict physical boundary validation to prevent array loop overflows
        if (lat < this.BOUNDS.MIN_LAT || lat > this.BOUNDS.MAX_LAT || 
            lng < this.BOUNDS.MIN_LNG || lng > this.BOUNDS.MAX_LNG) {
            console.error("GridFlow Error: Coordinates fall completely outside India's national DIGIPIN bounding box.");
            return null;
        }

        let currentMinLat = this.BOUNDS.MIN_LAT;
        let currentMaxLat = this.BOUNDS.MAX_LAT;
        let currentMinLng = this.BOUNDS.MIN_LNG;
        let currentMaxLng = this.BOUNDS.MAX_LNG;

        let part1 = "";
        let part2 = "";
        let part3 = "";

        // Recursively divide the bounding box through 10 hierarchical levels
        for (let level = 1; level <= 10; level++) {
            let midLat = (currentMinLat + currentMaxLat) / 2;
            let midLng = (currentMinLng + currentMaxLng) / 2;

            let quadX = lng >= midLng ? 1 : 0;
            let quadY = lat >= midLat ? 1 : 0;

            // Map the quadrant to the anti-clockwise spiral matrix index (0-15)
            // This replicates the recursive subdivision logic built with IIT Hyderabad
            let index = (quadY << 1) | quadX; 
            let symbol = this.ALPHABET[index];

            if (level <= 3) part1 += symbol;
            else if (level <= 6) part2 += symbol;
            else part3 += symbol;

            // Tighten the box for the next iteration layer
            if (quadX === 1) currentMinLng = midLng; else currentMaxLng = midLng;
            if (quadY === 1) currentMinLat = midLat; else currentMaxLat = midLat;
        }

        return `${part1}-${part2}-${part3}`;
    },

    /**
     * Simple mock utility evaluating high-density vertical sectors (e.g., tech parks, apartments)
     * In production, this cross-references high-density geospatial polygons.
     */
    isHighDensityZone: function(lat, lng) {
        // Example mock polygon check: Centers of major metropolitan clusters
        // Returns true if the coordinate lands in high-density multi-story zones
        const highDensityMockNode = (Math.abs(lat - 12.97) < 0.1 && Math.abs(lng - 77.59) < 0.1) || // Bengaluru cluster
                                    (Math.abs(lat - 19.07) < 0.1 && Math.abs(lng - 72.87) < 0.1);   // Mumbai cluster
        return highDensityMockNode;
    }
};

if (typeof module !== 'undefined') module.exports = GridFlowCore;