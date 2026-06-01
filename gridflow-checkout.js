(function () {
  "use strict";

  var Core = window.GridFlow;
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
    ".top{display:flex;gap:12px;align-items:flex-start}",
    ".badge{width:38px;height:38px;border-radius:8px;background:#116149;color:white;display:grid;place-items:center;font-weight:800}",
    "h2{margin:0 0 4px;font-size:18px;line-height:1.2;letter-spacing:0;color:#101828}",
    "p{margin:0;color:#526071;font-size:13px;line-height:1.45}",
    ".row{display:flex;gap:8px;margin-top:12px}.stack{display:flex;flex-direction:column;gap:8px;margin-top:12px}",
    "button{border:0;border-radius:8px;padding:12px 14px;min-height:44px;background:#116149;color:#fff;font:700 14px/1.1 inherit;cursor:pointer}",
    "button.alt{background:#eef5f2;color:#116149;border:1px solid #c9ddd5}",
    "input{width:100%;min-height:42px;border:1px solid #cbd5e1;border-radius:8px;padding:10px 11px;font:500 14px/1.2 inherit;background:#fff;color:#101828}",
    "input:focus{outline:2px solid #98d9c4;outline-offset:1px;border-color:#116149}",
    ".hidden{display:none!important}.status{margin-top:12px;color:#526071;font-size:13px;line-height:1.45}.ok{color:#0f766e;font-weight:750}.warn{color:#a15c00}.err{color:#b42318}",
    ".modal{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.54);display:grid;place-items:center;padding:18px}",
    ".panel{width:min(94vw,480px);background:#fff;border-radius:8px;padding:16px;box-shadow:0 22px 60px rgba(0,0,0,.24)}",
    ".map{position:relative;width:100%;aspect-ratio:1;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#f8fafc;background-image:linear-gradient(90deg,rgba(17,97,73,.15) 1px,transparent 1px),linear-gradient(rgba(17,97,73,.15) 1px,transparent 1px);background-size:10% 10%;touch-action:none;cursor:crosshair}",
    ".mapHint{position:absolute;left:10px;right:10px;top:10px;z-index:2;border-radius:8px;background:rgba(255,255,255,.9);padding:8px 10px;font-size:12px;color:#334155;box-shadow:0 2px 10px rgba(15,23,42,.1);pointer-events:none}",
    ".cross{position:absolute;left:50%;top:50%;z-index:3;width:58px;height:58px;margin:-29px 0 0 -29px;border:2px solid rgba(225,29,72,.32);border-radius:999px;pointer-events:none}.cross:before,.cross:after{content:'';position:absolute;background:#e11d48;box-shadow:0 0 0 2px #fff}.cross:before{left:27px;top:3px;width:4px;height:52px}.cross:after{left:3px;top:27px;width:52px;height:4px}.cross i{position:absolute;left:23px;top:23px;width:12px;height:12px;border-radius:999px;background:#e11d48;border:2px solid #fff}",
    ".coord{font-size:12px;color:#526071;margin-top:8px}",
    "@media(max-width:760px){.row{flex-direction:column}.card{max-width:none}button{width:100%}}"
  ].join("");

  function qs(root, selector) { return root.querySelector(selector); }
  function pinOnly(value) { return String(value || "").replace(/\D/g, "").slice(0, 6); }
  function setStatus(root, text, tone) {
    var node = qs(root, ".status");
    node.textContent = text;
    node.className = "status" + (tone ? " " + tone : "");
  }
  function dbEntryToObject(pin, row) {
    return {
      pin: pin,
      label: row[0],
      lat: row[1],
      lon: row[2],
      bbox: { minLat: row[3], minLon: row[4], maxLat: row[5], maxLon: row[6] },
      dense: String(row[7] || "").indexOf("dense") !== -1
    };
  }
  function loadWithTimeout(url) {
    if (!window.fetch) return Promise.resolve(DEFAULT_DB);
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) resolve(DEFAULT_DB);
      }, 1200);
      fetch(url, { cache: "force-cache" }).then(function (res) {
        return res.ok ? res.json() : DEFAULT_DB;
      }).then(function (json) {
        done = true;
        clearTimeout(timer);
        resolve(json);
      }).catch(function () {
        done = true;
        clearTimeout(timer);
        resolve(DEFAULT_DB);
      });
    });
  }
  function targetFields(host) {
    return [
      host.getAttribute("target"),
      "[name='shipping_address[address2]']",
      "[name='checkout[shipping_address][address2]']",
      "#shipping_address_address2",
      "#checkout_shipping_address_address2",
      "[name='shipping_note']",
      "[name='note']",
      "[name='attributes[DIGIPIN]']"
    ].filter(Boolean);
  }
  function writeField(field, payload) {
    if (!field) return false;
    var current = field.value || field.textContent || "";
    var cleaned = current.replace(/^\[DIGIPIN:[^\]]+\](?:\s\|\s\[[^\]]*\])*(?:\s\|\s)?/i, "").trim();
    var next = payload + (cleaned ? " | " + cleaned : "");
    if ("value" in field) {
      field.value = next;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      field.textContent = next;
    }
    return true;
  }
  function inject(host, digipin, floor) {
    var payload = "[DIGIPIN: " + digipin + "]" + (floor ? " | [" + floor + "]" : "");
    var fields = targetFields(host);
    for (var i = 0; i < fields.length; i += 1) {
      if (writeField(document.querySelector(fields[i]), payload)) return fields[i];
    }
    var hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "attributes[DIGIPIN]";
    hidden.value = payload;
    host.insertAdjacentElement("afterend", hidden);
    return hidden.name;
  }
  function showMap(entry, done, mountRoot) {
    var modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = [
      "<div class='panel' role='dialog' aria-modal='true'>",
      "<h2>You are away from your delivery location</h2>",
      "<p>Drag the map to place the crosshair directly on your roof to secure pinpoint delivery.</p>",
      "<div class='map'><div class='mapHint'>Click or drag inside this square. The red crosshair marks the selected delivery point.</div><span class='cross'><i></i></span></div><div class='coord'></div>",
      "<div class='row'><button class='use' type='button'>Use crosshair point</button><button class='cancel alt' type='button'>Cancel</button></div>",
      "</div>"
    ].join("");
    var bbox = entry.bbox;
    var point = { lat: entry.lat, lon: entry.lon };
    var map = qs(modal, ".map");
    function render() {
      qs(modal, ".coord").textContent = entry.label + " | " + point.lat.toFixed(6) + ", " + point.lon.toFixed(6);
    }
    function update(ev) {
      var rect = map.getBoundingClientRect();
      var x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      var y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      point.lon = bbox.minLon + x * (bbox.maxLon - bbox.minLon);
      point.lat = bbox.maxLat - y * (bbox.maxLat - bbox.minLat);
      render();
    }
    map.addEventListener("pointerdown", function (ev) {
      update(ev);
      map.setPointerCapture(ev.pointerId);
    });
    map.addEventListener("pointermove", function (ev) {
      if (ev.buttons) update(ev);
    });
    qs(modal, ".use").addEventListener("click", function () {
      modal.remove();
      done(point, entry);
    });
    qs(modal, ".cancel").addEventListener("click", function () { modal.remove(); });
    mountRoot.appendChild(modal);
    render();
  }

  class GridFlowCheckout extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.db = DEFAULT_DB;
      this.dbReady = Promise.resolve(DEFAULT_DB);
      this.pendingDigipin = "";
    }
    connectedCallback() {
      if (!Core) {
        this.textContent = "GridFlow core failed to load.";
        return;
      }
      this.shadowRoot.innerHTML = [
        "<style>", CSS, "</style>",
        "<section class='card'><div class='top'><div class='badge'>GF</div><div>",
        "<h2>1-Click Pinpoint Delivery</h2>",
        "<p>Powered by India Post Digital Infrastructure. DIGIPIN is calculated locally, without paid map APIs.</p></div></div>",
        "<div class='row'><button class='gps' type='button'>Secure 4-Meter Free Premium Delivery</button><button class='away alt' type='button'>I am away from my delivery address</button></div>",
        "<div class='stack remote hidden'><input class='pin' inputmode='numeric' maxlength='6' placeholder='Enter Delivery Area PIN Code'><button class='choose alt' type='button'>Open roof picker</button></div>",
        "<div class='stack'><input class='direct' autocomplete='off' placeholder='Have a DIGIPIN? Paste it here'></div>",
        "<div class='stack floor hidden'><input class='floorInput' placeholder='House / Flat / Floor / Landmark'></div>",
        "<div class='status'>Ready to secure delivery metadata.</div></section>"
      ].join("");
      this.bind();
      this.dbReady = loadWithTimeout(this.getAttribute("pincode-src") || "./pincode-centroids.json");
      this.dbReady.then(function (db) { this.db = db; }.bind(this));
    }
    bind() {
      var root = this.shadowRoot;
      qs(root, ".gps").addEventListener("click", this.gps.bind(this));
      qs(root, ".away").addEventListener("click", this.showRemote.bind(this));
      qs(root, ".choose").addEventListener("click", this.choosePin.bind(this));
      qs(root, ".pin").addEventListener("input", function (ev) { ev.target.value = pinOnly(ev.target.value); });
      qs(root, ".direct").addEventListener("input", this.direct.bind(this));
      qs(root, ".floorInput").addEventListener("input", function (ev) {
        if (this.pendingDigipin) this.save(this.pendingDigipin, "Flat/floor added.", ev.target.value);
      }.bind(this));
    }
    showRemote(message) {
      qs(this.shadowRoot, ".remote").classList.remove("hidden");
      setStatus(this.shadowRoot, message || "Enter the delivery PIN code, then place the roof crosshair.", "warn");
    }
    gps() {
      var root = this.shadowRoot;
      if (!navigator.geolocation) {
        this.showRemote("Location is unavailable. Use delivery PIN code instead.");
        return;
      }
      setStatus(root, "Requesting high-accuracy location...");
      navigator.geolocation.getCurrentPosition(function (pos) {
        var c = pos.coords;
        var accuracy = Math.round(Number(c.accuracy) || 0);
        var code;
        try {
          code = Core.encode(c.latitude, c.longitude);
        } catch (error) {
          this.showRemote("Location could not be used for India delivery. Enter the delivery PIN code.");
          return;
        }
        if (accuracy <= 10) {
          this.save(code, "Rooftop locked. No delivery phone calls required.");
        } else {
          this.save(code, "Location captured with " + accuracy + "m accuracy. Use the PIN-code picker for roof-level precision.");
          this.showRemote("Location captured with " + accuracy + "m accuracy. Enter delivery PIN code to refine the roof point.");
        }
      }.bind(this), function () {
        this.showRemote("Location permission was blocked. Enter the delivery PIN code.");
      }.bind(this), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    }
    async choosePin() {
      var pin = pinOnly(qs(this.shadowRoot, ".pin").value);
      if (pin.length !== 6) {
        setStatus(this.shadowRoot, "Enter a valid 6-digit delivery PIN code.", "err");
        return;
      }
      var db = await this.dbReady;
      var row = db.pins && db.pins[pin];
      if (!row) {
        setStatus(this.shadowRoot, "PIN " + pin + " is not in this demo cache. Replace pincode-centroids.json with the full production cache.", "err");
        return;
      }
      showMap(dbEntryToObject(pin, row), function (point, entry) {
        if (!Core.inBounds(point.lat, point.lon)) {
          setStatus(this.shadowRoot, "Selected point is outside the national DIGIPIN bounds. Choose another point.", "err");
          return;
        }
        var code = Core.encode(point.lat, point.lon);
        if (entry.dense) {
          this.pendingDigipin = code;
          qs(this.shadowRoot, ".floor").classList.remove("hidden");
          this.save(code, "This delivery area may need one extra address detail. Add house, flat, floor, or landmark if useful.");
          return;
        }
        this.save(code, "Roof crosshair locked from delivery PIN " + pin + ".");
      }.bind(this), this.shadowRoot);
    }
    direct(ev) {
      var formatted;
      try {
        formatted = Core.format(ev.target.value);
      } catch (error) {
        setStatus(this.shadowRoot, "Paste DIGIPIN as XXX-XXX-XXXX.");
        return;
      }
      if (!Core.isDirectEntry(formatted)) {
        setStatus(this.shadowRoot, "That DIGIPIN format is not valid.", "err");
        return;
      }
      this.save(formatted, "DIGIPIN accepted directly.");
    }
    save(code, message, floor) {
      var target = inject(this, code, floor || qs(this.shadowRoot, ".floorInput").value.trim());
      this.dispatchEvent(new CustomEvent("gridflow:resolved", { bubbles: true, detail: { digipin: code, target: target } }));
      setStatus(this.shadowRoot, message + " Saved " + code + " into checkout metadata.", message.indexOf("accuracy") >= 0 || message.indexOf("multi-story") >= 0 ? "warn" : "ok");
    }
  }

  if (!customElements.get("gridflow-checkout")) {
    customElements.define("gridflow-checkout", GridFlowCheckout);
  }
})();
