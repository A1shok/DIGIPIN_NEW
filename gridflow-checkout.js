(function () {
  "use strict";

  var leafletPromise = null;
  
  // High-performance operational state machine isolation vault
  var systemState = {
    db: null,
    isLoaded: false,
    executionQueue: null
  };

  var CSS = [
    ":host{all:initial;display:block;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;color:#15202b}",
    "*,*::before,*::after{box-sizing:border-box}",
    ".card{border:1px solid #d6dee7;border-radius:8px;background:#fff;padding:16px;box-shadow:0 10px 26px rgba(15,23,42,.08);max-width:520px;width:100%}",
    ".top{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}",
    ".badge{width:38px;height:38px;border-radius:8px;background:#116149;color:white;display:grid;place-items:center;font-weight:800;font-size:16px;flex-shrink:0}",
    "h2{margin:0 0 4px;font-size:17px;line-height:1.2;color:#101828;font-weight:700}",
    "p{margin:0;color:#526071;font-size:13px;line-height:1.45}",
    ".row{display:flex;gap:8px;margin-top:12px;width:100%}",
    "button{border:0;border-radius:8px;padding:12px 14px;min-height:44px;background:#116149;color:#fff;font:700 14px/1.1 inherit;cursor:pointer;width:100%;transition:background 0.2s}",
    "button:hover{background:#0b4634}",
    ".status{margin-top:12px;color:#526071;font-size:13px;line-height:1.45;font-weight:500}",
    ".ok{color:#0f766e;font-weight:750}",
    ".warn{color:#a15c00}",
    ".err{color:#b42318}",
    ".modal{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.54);display:grid;place-items:center;padding:18px}",
    ".panel{width:min(94vw,480px);background:#fff;border-radius:8px;padding:20px;box-shadow:0 22px 60px rgba(0,0,0,.24);box-sizing:border-box}",
    ".map{position:relative;width:100%;height:320px;min-height:320px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#f8fafc;touch-action:none;display:block}",
    ".leafletMap{cursor:grab}",
    ".leafletMap:active{cursor:grabbing}",
    ".coord{font-size:12px;color:#526071;margin-top:8px;font-family:monospace;font-weight:bold}",
    ".cross{position:absolute;left:50%;top:50%;z-index:1000;width:58px;height:58px;margin:-29px 0 0 -29px;border:2px solid rgba(225,29,72,.32);border-radius:999px;pointer-events:none}",
    ".cross:before,.cross:after{content:'';position:absolute;background:#e11d48;box-shadow:0 0 0 2px #fff}",
    ".cross:before{left:27px;top:3px;width:4px;height:52px}",
    ".cross:after{left:3px;top:27px;width:52px;height:4px}",
    ".cross i{position:absolute;left:23px;top:23px;width:12px;height:12px;border-radius:999px;background:#e11d48;border:2px solid #fff}",
    ".mapHint{position:absolute;left:10px;right:10px;top:10px;z-index:1001;border-radius:6px;background:rgba(255,255,255,0.92);padding:8px 10px;font-size:12px;color:#334155;box-shadow:0 2px 10px rgba(15,23,42,.1);pointer-events:none;line-height:1.4}",
    "@media(max-width:760px){.card{max-width:none}.row{flex-direction:column}}"
  ].join("");

  function qs(root, selector) { return root.querySelector(selector); }
  
  function setStatus(root, text, tone) {
    var node = qs(root, ".status");
    if(node) {
      node.textContent = text;
      node.className = "status" + (tone ? " " + tone : "");
    }
  }

  function calculateDistanceKM(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function streamDatabaseAsset() {
    var targetUrl = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + "/pincode-centroids.json";
    fetch(targetUrl, { cache: "force-cache" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (json) {
        systemState.db = json;
        systemState.isLoaded = true;
        if (typeof systemState.executionQueue === "function") {
          var callback = systemState.executionQueue;
          systemState.executionQueue = null;
          callback();
        }
      })
      .catch(function () {
        systemState.db = null;
        systemState.isLoaded = true;
        if (typeof systemState.executionQueue === "function") {
          var callback = systemState.executionQueue;
          systemState.executionQueue = null;
          callback();
        }
      });
  }

  function dispatchStateToDOM(rawCodePayload) {
    var field = document.getElementById("shipping_address_address2");
    if (field) {
      // Cleanly extracts string attributes from gridflow-core.js Object wrapper instances safely
      var resolvedStringCode = rawCodePayload;
      if (rawCodePayload && typeof rawCodePayload === "object") {
        resolvedStringCode = rawCodePayload.code || JSON.stringify(rawCodePayload);
      }

      var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeSetter.call(field, resolvedStringCode);
      
      // Multi-framework trusted event cascade binding updates (Shopify, React, Vue support)
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function getActiveEncoder() {
    // Structural namespace detection checking both modular and global window scope chains
    if (window.GridFlow && typeof window.GridFlow.encode === "function") {
      return window.GridFlow.encode;
    }
    if (window.GridFlow && window.GridFlow.default && typeof window.GridFlow.default.encode === "function") {
      return window.GridFlow.default.encode;
    }
    return function(lat, lon) { return lat.toFixed(6) + "," + lon.toFixed(6); };
  }

  function loadLeaflet(shadowRoot) {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;

    return leafletPromise = new Promise(function (resolve) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      shadowRoot.appendChild(link);

      var script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = function () { resolve(window.L); };
      document.head.appendChild(script);
    });
  }

  function showMap(title, descriptionText, startLat, startLon, done, shadowRoot) {
    var modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = [
      "<div class='panel'>",
      "<h2 style='margin:0 0 6px; font-size:18px; color:#101828; font-weight:700;'>" + title + "</h2>",
      "<p style='font-size:13px;color:#475569;margin:0 0 12px;line-height:1.4;'>" + descriptionText + "</p>",
      "<div class='map'><div class='mapHint'>📍 Drag map to align your roof with the red crosshair center target point.</div><span class='cross'><i></i></span></div>",
      "<div class='coord' style='margin-top:8px;'></div>",
      "<div class='row' style='margin-top:14px;display:flex;gap:8px;'><button class='use' style='flex:1;'>Confirm Rooftop Location</button></div>",
      "</div>"
    ].join("");
    
    var point = { lat: startLat, lon: startLon };
    shadowRoot.appendChild(modal);

    loadLeaflet(shadowRoot).then(function (L) {
      var mapNode = qs(modal, ".map");
      mapNode.classList.add("leafletMap");

      var map = L.map(mapNode, { center: [point.lat, point.lon], zoom: 18, zoomControl: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      
      setTimeout(function () {
        map.invalidateSize();
        map.setView([point.lat, point.lon], 18);
      }, 250);

      map.on("move", function () {
        var center = map.getCenter();
        point.lat = center.lat;
        point.lon = center.lng;
        var coordNode = qs(modal, ".coord");
        if(coordNode) coordNode.textContent = "Coordinates: " + point.lat.toFixed(6) + ", " + point.lon.toFixed(6);
      });

      map.fire("move");

      qs(modal, ".use").addEventListener("click", function () {
        modal.remove(); done(point);
      });
    });
  }

  class GridFlowCheckout extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }
    connectedCallback() {
      this.shadowRoot.innerHTML = [
        "<style>", CSS, "</style>",
        "<section class='card'>",
        "<div class='top'><div class='badge'>📍</div>",
        "<div><h2>1-Click Pinpoint Delivery</h2>",
        "<p>Secure 4-meter rooftop accuracy for your package delivery destination.</p></div></div>",
        "<div class='row'><button class='gps'>Verify Address & Secure 4-Meter Accuracy</button></div>",
        "<div class='status'>Ready to sync delivery target coordinates.</div></section>"
      ].join("");
      
      qs(this.shadowRoot, ".gps").addEventListener("click", this.interceptWidgetClick.bind(this));
    }
    
    interceptWidgetClick() {
      var root = this.shadowRoot;
      if (!systemState.isLoaded) {
        setStatus(root, "Initializing coordinate mapping core, please wait...", "warn");
        systemState.executionQueue = this.executeCoreEngine.bind(this);
        return;
      }
      this.executeCoreEngine();
    }

    executeCoreEngine() {
      var root = this.shadowRoot;
      var userAddress = document.getElementById("address1") ? document.getElementById("address1").value.toLowerCase() : "";
      var parentFormPincode = document.getElementById("pincode") ? document.getElementById("pincode").value.trim() : "";
      
      if (!parentFormPincode || parentFormPincode.length !== 6) {
        setStatus(root, "Please enter a valid 6-digit PIN code in the shipping form first.", "err");
        return;
      }

      var pinData = systemState.db && systemState.db.pins && systemState.db.pins[parentFormPincode];
      
      if (!pinData || !Array.isArray(pinData)) {
        this.executeHardwareOnlyPipeline();
        return;
      }

      // Safe extraction layers mapped precisely to your live flat array database format
      var pincodeCenterLat = pinData[1];
      var pincodeCenterLon = pinData[2];
      var targetLat = pincodeCenterLat;
      var targetLon = pincodeCenterLon;

      var subLocalities = {
        "srm": [16.465100, 80.506500],
        "gundimeda": [16.456250, 80.570120],
        "nutakki": [16.442800, 80.598500],
        "tadepalli": [16.471600, 80.602200],
        "mangalagiri": [16.431200, 80.556400]
      };

      var activeKeywordMatch = false;
      for (var token in subLocalities) {
        if (userAddress.indexOf(token.toLowerCase()) !== -1) {
          targetLat = subLocalities[token][0];
          targetLon = subLocalities[token][1];
          activeKeywordMatch = true;
          break; 
        }
      }

      setStatus(root, "Verifying location coordinates alignment...");
      
      navigator.geolocation.getCurrentPosition(function (pos) {
        var deviceLat = pos.coords.latitude;
        var deviceLon = pos.coords.longitude;
        var accuracy = Math.round(pos.coords.accuracy || 0);
        var distanceDeviceToPincodeCenter = calculateDistanceKM(deviceLat, deviceLon, pincodeCenterLat, pincodeCenterLon);

        if (activeKeywordMatch) {
          showMap(
            "Confirm Your Rooftop Target",
            "We localized the map directly over your designated address landmark. Please center the crosshair target over your building roof layout.",
            targetLat,
            targetLon,
            function (refinedPoint) {
              var encodeFn = getActiveEncoder();
              var code = encodeFn(refinedPoint.lat, refinedPoint.lon);
              this.save(code, "Rooftop locked over verified landmark.");
            }.bind(this),
            root
          );
          return;
        }

        if (distanceDeviceToPincodeCenter > 6.0) {
          showMap(
            "You are ordering away from home",
            "We loaded the map over your typed delivery area. Please select your exact house rooftop to complete pinpoint verification.",
            targetLat,
            targetLon,
            function (refinedPoint) {
              var encodeFn = getActiveEncoder();
              var code = encodeFn(refinedPoint.lat, refinedPoint.lon);
              this.save(code, "Rooftop locked over delivery address.");
            }.bind(this),
            root
          );
          return;
        }

        if (accuracy > 10 || distanceDeviceToPincodeCenter <= 6.0) {
          showMap(
            "Refine Your Rooftop Point",
            "We loaded the map directly over your local neighborhood block. Please center the red crosshair target over your house rooftop layout.",
            deviceLat,
            deviceLon,
            function (refinedPoint) {
              var encodeFn = getActiveEncoder();
              var code = encodeFn(refinedPoint.lat, refinedPoint.lon);
              this.save(code, "Rooftop locked inside localized accuracy footprint.");
            }.bind(this),
            root
          );
        } else {
          var encodeFn = getActiveEncoder();
          var code = encodeFn(deviceLat, deviceLon);
          this.save(code, "Rooftop matched flawlessly.");
        }

      }.bind(this), function () {
        showMap(
          "Locate Your House on Map",
          "We loaded the map over your typed delivery area. Please select your exact house rooftop to complete pinpoint verification.",
          targetLat,
          targetLon,
          function (refinedPoint) {
            var encodeFn = getActiveEncoder();
            var code = encodeFn(refinedPoint.lat, refinedPoint.lon);
            this.save(code, "Manual rooftop crosshair saved.");
          }.bind(this),
          root
        );
      }.bind(this), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    }

    executeHardwareOnlyPipeline() {
      var root = this.shadowRoot;
      navigator.geolocation.getCurrentPosition(function (pos) {
        showMap(
          "Refine Your Rooftop Point",
          "Please verify and center the crosshair marker directly over your destination building roof blueprint.",
          pos.coords.latitude,
          pos.coords.longitude,
          function (refinedPoint) {
            var encodeFn = getActiveEncoder();
            var code = encodeFn(refinedPoint.lat, refinedPoint.lon);
            this.save(code, "Rooftop anchored via live sensor processing.");
          }.bind(this),
          root
        );
      }.bind(this), function () {
        showMap(
          "Locate Your Address",
          "Please scroll and zoom the map interface to pinpoint your delivery target rooftop location.",
          20.5937,
          78.9629,
          function (refinedPoint) {
            var encodeFn = getActiveEncoder();
            var code = encodeFn(refinedPoint.lat, refinedPoint.lon);
            this.save(code, "Rooftop calculated from global baseline reference grid.");
          }.bind(this),
          root
        );
      }.bind(this), { enableHighAccuracy: true, timeout: 8000 });
    }

    save(code, msg) {
      dispatchStateToDOM(code);
      var textPinDisplay = (code && typeof code === "object") ? code.code : code;
      setStatus(this.shadowRoot, msg + " [" + textPinDisplay + "]", "ok");
    }
  }

  if (!customElements.get("gridflow-checkout")) {
    customElements.define("gridflow-checkout", GridFlowCheckout);
  }

  streamDatabaseAsset();
})();
