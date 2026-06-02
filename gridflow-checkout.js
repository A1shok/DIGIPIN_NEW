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
    ".card{border:1px solid #d6dee7;border-radius:8px;background:#fff;padding:16px;box-shadow:0 10px 26px rgba(15,23,42,.08);max-width:520px}",
    "h2{margin:0 0 4px;font-size:17px;line-height:1.2;color:#101828}",
    "p{margin:0;color:#526071;font-size:13px;line-height:1.45}",
    ".row{display:flex;gap:8px;margin-top:12px}",
    "button{border:0;border-radius:8px;padding:12px 14px;min-height:44px;background:#116149;color:#fff;font:700 14px/1.1 inherit;cursor:pointer;width:100%}",
    "button.alt{background:#eef5f2;color:#116149;border:1px solid #c9ddd5}",
    ".status{margin-top:12px;color:#526071;font-size:13px;line-height:1.45}.ok{color:#0f766e;font-weight:750}.warn{color:#a15c00}.err{color:#b42318}",
    ".modal{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.54);display:grid;place-items:center;padding:18px}",
    ".panel{width:min(94vw,480px);background:#fff;border-radius:8px;padding:16px;box-shadow:0 22px 60px rgba(0,0,0,.24)}",
    ".map{position:relative;width:100%;height:300px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#f8fafc;touch-action:none;cursor:crosshair}",
    ".coord{font-size:12px;color:#526071;margin-top:8px}",
    "@media(max-width:760px){button{width:100%}}"
  ].join("");

  function qs(root, selector) { return root.querySelector(selector); }
  function setStatus(root, text, tone) {
    var node = qs(root, ".status");
    node.textContent = text;
    node.className = "status" + (tone ? " " + tone : "");
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

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    return new Promise(function (resolve) {
      var script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = function () { resolve(window.L); };
      document.head.appendChild(script);
    });
  }

  function showMap(title, descriptionText, startLat, startLon, done, mountRoot) {
    var modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = [
      "<div class='panel'>",
      "<h2>" + title + "</h2>",
      "<p style='font-size:13px;color:#475569;margin-bottom:12px;'>" + descriptionText + "</p>",
      "<div class='map'></div><div class='coord'></div>",
      "<div class='row' style='margin-top:12px;display:flex;gap:8px;'><button class='use' style='flex:1;'>Confirm Rooftop Location</button><button class='cancel alt'>Cancel</button></div>",
      "</div>"
    ].join("");
    
    var point = { lat: startLat, lon: startLon };
    mountRoot.appendChild(modal);

    loadLeaflet().then(function (L) {
      var map = L.map(qs(modal, ".map"), { center: [point.lat, point.lon], zoom: 17 });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
      
      var marker = L.marker([point.lat, point.lon], { draggable: true }).addTo(map);
      
      map.on("click", function(e) {
        marker.setLatLng(e.latlng);
        point.lat = e.latlng.lat; point.lon = e.latlng.lng;
      });

      marker.on("dragend", function () {
        var pos = marker.getLatLng();
        point.lat = pos.lat; point.lon = pos.lng;
      });
      
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
        "<section class='card'><h2>1-Click Pinpoint Delivery</h2>",
        "<p>Secure 4-meter rooftop accuracy for your package delivery destination.</p>",
        "<div class='row'><button class='gps'>Verify Address & Secure 4-Meter Accuracy</button></div>",
        "<div class='status'>Ready to sync delivery target coordinates.</div></section>"
      ].join("");
      
      qs(this.shadowRoot, ".gps").addEventListener("click", this.gps.bind(this));
      loadWithTimeout().then(function (db) { this.db = db; }.bind(this));
    }
    gps() {
      var root = this.shadowRoot;
      
      // Get the pincode dynamically from the parent HTML document form
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

      var targetHomeLat = pinData[1];
      var targetHomeLon = pinData[2];

      setStatus(root, "Verifying location coordinates alignment...");
      
      navigator.geolocation.getCurrentPosition(function (pos) {
        var deviceLat = pos.coords.latitude;
        var deviceLon = pos.coords.longitude;
        var accuracy = Math.round(pos.coords.accuracy || 0);
        
        var distanceKM = calculateDistanceKM(deviceLat, deviceLon, targetHomeLat, targetHomeLon);
        
        // Dynamic Case 1: User is far away from the delivery address
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
            this.shadowRoot
          );
          return;
        }

        // Dynamic Case 2: User is at home, but device returns rough accuracy (like 114m)
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
            this.shadowRoot
          );
        } else {
          // Dynamic Case 3: High-accuracy single-click match
          var code = Core.encode(deviceLat, deviceLon);
          this.save(code, "Rooftop matched flawlessly.");
        }
      }.bind(this), function () {
        // Dynamic Case 4: Device GPS sensor blocked completely - fall back straight to typed area map
        showMap(
          "Locate Your House on Map",
          "We loaded the map over your typed delivery area. Please select your exact house rooftop to complete pinpoint verification.",
          targetHomeLat,
          targetHomeLon,
          function (refinedPoint) {
            var code = Core.encode(refinedPoint.lat, refinedPoint.lon);
            this.save(code, "Manual rooftop crosshair saved.");
          }.bind(this),
          this.shadowRoot
        );
      }.bind(this), { enableHighAccuracy: true, timeout: 8000 });
    }
    save(code, msg) {
      inject(this, code);
      setStatus(this.shadowRoot, msg + " [" + code + "]", "ok");
    }
  }

  customElements.define("gridflow-checkout", GridFlowCheckout);
})();