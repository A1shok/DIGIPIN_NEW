/**
 * GridFlow Core DIGIPIN Mathematical Engine
 * Fully aligned with the Official India Post & IIT Hyderabad Specifications.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GridFlow = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Official 16 symbols arranged in the precise anti-clockwise spiral matrix layout
  var GRID = "FC98J327K456LMPT";
  
  // Official India Post Bounding Box Dimensions (Exactly 36 x 36 degrees)
  var BOUNDS = Object.freeze({ 
    minLat: 2.5, 
    maxLat: 38.5, 
    minLon: 63.5, 
    maxLon: 99.5 
  });

  var OFFICIAL_RE = /^[23456789CFJKLMPT]{3}-[23456789CFJKLMPT]{3}-[23456789CFJKLMPT]{4}$/;

  function inBounds(lat, lon) {
    return lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lon >= BOUNDS.minLon && lon <= BOUNDS.maxLon;
  }

  function encode(lat, lon) {
    if (!inBounds(lat, lon)) {
      console.error("Coordinates fall outside the official Indian DIGIPIN Bounding Box.");
      return null;
    }

    var minLat = BOUNDS.minLat;
    var maxLat = BOUNDS.maxLat;
    var minLon = BOUNDS.minLon;
    var maxLon = BOUNDS.maxLon;
    var code = "";

    // Process all 10 precision layers hierarchically
    for (var i = 0; i < 10; i += 1) {
      var latStep = (maxLat - minLat) / 4;
      var lonStep = (maxLon - minLon) / 4;

      // Determine 4x4 row and column indexes
      var row = Math.floor((maxLat - lat) / latStep);
      var col = Math.floor((lon - minLon) / lonStep);

      // Handle edge boundary coincidences matching official layout constraints
      if (row === 4) row = 3;
      if (col === 4) col = 3;

      // Extrapolate index from row/column positioning matrix
      var index = row * 4 + col;
      code += GRID.charAt(index);

      // Mutate box window parameters for the next nested iteration layer
      maxLat = maxLat - row * latStep;
      minLat = maxLat - latStep;
      minLon = minLon + col * lonStep;
      maxLon = minLon + lonStep;
    }

    // Format the clean 10-symbol output string using traditional hyphens
    return code.slice(0, 3) + "-" + code.slice(3, 6) + "-" + code.slice(6);
  }

  return {
    encode: encode,
    bounds: BOUNDS,
    isValidFormat: function(code) {
      return OFFICIAL_RE.test(code);
    }
  };
});