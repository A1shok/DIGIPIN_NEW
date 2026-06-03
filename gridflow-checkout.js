(function () {
  "use strict";

  var Core = window.GridFlow;
  var leafletPromise = null;
  var DEFAULT_DB = {
    v: 1,
    pins: {
      "110001": ["New Delhi GPO, Delhi", 28.622788, 77.213033, 28.595, 77.185, 28.65, 77.245, "dense"],
      "400001": ["Mumbai GPO, Maharashtra", 18.9388, 72.8354, 18.9, 72.795, 18.97, 72.87, "dense"],
      "560001": ["Bengaluru GPO, Karnataka", 12.9766, 77.5993, 12.94, 77.56, 13.01, 77.64, "dense"]
    }
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
    "button.alt{background:#eef5f2;color:#116149;border:1px solid #c9ddd5}",
    "button.alt:hover{background:#dfede7}",
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

  function loadWithTimeout(url) {
    if (!window.fetch) return Promise.resolve(DEFAULT_DB);
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { if (!done) resolve(DEFAULT_DB); }, 5000);
      var targetUrl = url || window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + "/pincode-centroids.json";

      fetch(targetUrl, { cache: "force-cache" }).then(function (res) {
        return res.ok ? res.json() : DEFAULT_DB;
      }).then(function (json) {
        done = true; clearTimeout(timer); resolve(json);
      }).catch(function () {
        done = true; clearTimeout(timer); resolve(DEFAULT_DB);
      });
    });
  }

  function inject(host, digipin) {
    var field = document.querySelector("#shipping_address_address2") || document.querySelector("#checkout_shipping_address_address2");
    if (field) {
      field.value = "[DIGIPIN: " + digipin + "]";
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
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
      "<h2 style='margin:0 0 6px; font-size:18px; color:#101828; font-family:inherit; font-weight:700;'>" + title + "</h2>",
      "<p style='font-size:13px;color:#475569;margin:0 0 12px;line-height:1.4;font-family:inherit;'>" + descriptionText + "</p>",
      "<div class='map'><div class='mapHint'>📍 Drag map to align your roof with the red crosshair center target point.</div><span class='cross'><i></i></span></div>",
      "<div class='coord' style='margin-top:8px;'></div>",
      "<div class='row' style='margin-top:14px;display:flex;gap:8px;'><button class='use' style='flex:1;'>Confirm Rooftop Location</button><button class='cancel alt' style='width:auto;padding-left:20px;padding-right:20px;'>Cancel</button></div>",
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
      }, 200);

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
      qs(modal, ".cancel").addEventListener("click", function () { modal.remove(); });
    });
  }

  class GridFlowCheckout extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.db = DEFAULT_DB;
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
      
      qs(this.shadowRoot, ".gps").addEventListener("click", this.gps.bind(this));
      loadWithTimeout().then(function (db) { this.db = db; }.bind(this));
    }
    gps() {
      var root = this.shadowRoot;
      var userAddress = document.querySelector("#address1") ? document.querySelector("#address1").value.toLowerCase() : "";
      var parentFormPincode = document.querySelector("#pincode") ? document.querySelector("#pincode").value.trim() : "";
      
      if (!parentFormPincode || parentFormPincode.length !== 6) {
        setStatus(root, "Please enter a valid 6-digit PIN code in the shipping form first.", "err");
        return;
      }

      var pinData = this.db.pins && this.db.pins[parentFormPincode];
      if (!pinData) {
        setStatus(root, "Target shipping area PIN code context not found in database.", "err");
        return;
      }

      // Extract coordinates cleanly whether using old array format or the upgraded object layout
      var targetHomeLat = (pinData.center) ? pinData.center[0] : pinData[1];
      var targetHomeLon = (pinData.center) ? pinData.center[1] : pinData[2];

      // ==========================================
      // FULLY AUTOMATED SUB-LOCALITY SCAN ENGINE
      // ==========================================
      // Loops through matching keywords inside your database dynamically.
      // Eliminates hardcoding while instantly snapping map centers onto landmarks/villages.
      if (pinData.sub_localities) {
        for (var keyword in pinData.sub_localities) {
          if (userAddress.indexOf(keyword.toLowerCase()) !== -1) {
            targetHomeLat = pinData.sub_localities[keyword][0];
            targetHomeLon = pinData.sub_localities[keyword][1];
            break; 
          }
        }
      }

      setStatus(root, "Verifying location coordinates alignment...");
      
      navigator.geolocation.getCurrentPosition(function (pos) {
        var deviceLat = pos.coords.latitude;
        var deviceLon = pos.coords.longitude;
        var accuracy = Math.round(pos.coords.accuracy || 0);
        
        var distanceKM = calculateDistanceKM(deviceLat, deviceLon, targetHomeLat, targetHomeLon);
        
        if (distanceKM > 5.0) {
          showMap(
            "You are ordering away from home",
            "We loaded the map over your typed delivery area. Please select your exact house rooftop to complete pinpoint verification.",
            targetHomeLat,
            targetHomeLon,
            function (refinedPoint) {
              var code = Core.encode(refinedPoint.lat, refinedPoint.lon);
              this.save(code, "Rooftop locked over delivery address.");
            }.bind(this),
            root
          );
          return;
        }

        if (accuracy > 10) {
          showMap(
            "Refine Your Rooftop Point",
            "We loaded the map over your neighborhood. Please select your exact house rooftop to complete pinpoint verification.",
            deviceLat,
            deviceLon,
            function (refinedPoint) {
              var code = Core.encode(refinedPoint.lat, refinedPoint.lon);
              this.save(code, "Rooftop locked inside localized accuracy bubble.");
            }.bind(this),
            root
          );
        } else {
          var code = Core.encode(deviceLat, deviceLon);
          this.save(code, "Rooftop matched flawlessly.");
        }
      }.bind(this), function () {
        showMap(
          "Locate Your House on Map",
          "We loaded the map over your typed delivery area. Please select your exact house rooftop to complete pinpoint verification.",
          targetHomeLat,
          targetHomeLon,
          function (refinedPoint) {
            var code = Core.encode(refinedPoint.lat, refinedPoint.lon);
            this.save(code, "Manual rooftop crosshair saved.");
          }.bind(this),
          root
        );
      }.bind(this), { enableHighAccuracy: true, timeout: 8000 });
    }
    save(code, msg) {
      inject(this, code);
      setStatus(this.shadowRoot, msg + " [" + code + "]", "ok");
    }
  }

  if (!customElements.get("gridflow-checkout")) {
    customElements.define("gridflow-checkout", GridFlowCheckout);
  }
})();