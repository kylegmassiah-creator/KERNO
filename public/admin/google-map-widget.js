/* ─────────────────────────────────────────────────────────────────────
   KERNO custom Decap CMS widget - Google Maps pin-picker
   ─────────────────────────────────────────────────────────────────────
   Strategy: register `google-map` as an alias for Decap's built-in
   `string` widget - Decap renders a plain text input, no custom React.
   Then watch the DOM for that input being rendered (the editor mounts
   it lazily when you open an event), and inject a Google Map above it
   with a draggable marker. Marker movements write the "lat,lng" string
   into the input using the native value setter + a dispatched 'input'
   event, which is the canonical way to trigger React's onChange from
   outside React (Decap's React picks it up and updates its state).

   Why this design and not a real custom React widget:
   Decap CMS v3 bundles its own React internally and does not expose it.
   A class component extending a CDN window.React.Component fails
   Decap's `isReactComponent` check (cross-instance prototype). A
   functional component using window.React.createElement returns
   elements that ALSO fail Decap's reconciler validation (React error
   #525). Properly fixing this requires bundling the widget with Decap
   using a build pipeline - non-trivial. Until that exists, this DOM
   approach gives us a working Google Map in the CMS without crossing
   React boundaries at all.

   Failure mode is benign: if the API key is missing, Google Maps
   fails to load, or the DOM observer can't find the input, the editor
   still sees a plain text input where they can paste coords manually.
   The CMS itself NEVER white-screens because of this widget.
   ───────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // Cornwall fallback centre when no value is set yet.
  var DEFAULT_CENTRE = { lat: 50.266, lng: -5.053 };
  var GOOGLE_MAPS_KEY = (window.KERNO_ADMIN_GOOGLE_MAPS_KEY || '').trim();

  // ─────────────────────────────────────────────────────────────────
  // Wait for Decap to expose its CMS global, then register the widget
  // alias and start watching the DOM.
  // ─────────────────────────────────────────────────────────────────
  var pollStart = Date.now();
  function waitForCMS() {
    if (window.CMS) {
      bootstrap();
      return;
    }
    if (Date.now() - pollStart > 15000) {
      console.warn('[KERNO google-map] Decap CMS not detected; widget disabled.');
      return;
    }
    setTimeout(waitForCMS, 100);
  }
  waitForCMS();

  function bootstrap() {
    try {
      // ALWAYS register as a string-widget alias first. This guarantees
      // the CMS never crashes because of a missing widget registration,
      // regardless of whether the rest of this script runs successfully.
      window.CMS.registerWidget('google-map', 'string');
      console.info('[KERNO google-map] Widget registered (string alias).');
    } catch (e) {
      console.error('[KERNO google-map] Could not register widget:', e);
      return;
    }
    if (!GOOGLE_MAPS_KEY) {
      console.warn('[KERNO google-map] No API key in window.KERNO_ADMIN_GOOGLE_MAPS_KEY - text input only.');
      return;
    }
    attachDomObserver();
  }

  // ─────────────────────────────────────────────────────────────────
  // Google Maps JS API loader (cached per page).
  // ─────────────────────────────────────────────────────────────────
  function loadGoogleMaps() {
    if (window.__pfoGoogleMapsPromise) return window.__pfoGoogleMapsPromise;
    window.__pfoGoogleMapsPromise = new Promise(function (resolve, reject) {
      if (window.google && window.google.maps) return resolve();
      var cb = '__pfoCmsGoogleMapReady';
      window[cb] = function () { resolve(); };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' +
              encodeURIComponent(GOOGLE_MAPS_KEY) +
              '&callback=' + cb + '&loading=async&v=weekly';
      s.async = true;
      s.defer = true;
      s.onerror = function () { reject(new Error('Google Maps JS API failed to load')); };
      document.head.appendChild(s);
    });
    return window.__pfoGoogleMapsPromise;
  }

  // ─────────────────────────────────────────────────────────────────
  // Coordinate parsing / formatting.
  // ─────────────────────────────────────────────────────────────────
  function parseCoords(value) {
    if (!value || typeof value !== 'string') return null;
    var parts = value.split(',').map(function (s) { return parseFloat(s.trim()); });
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
    if (parts[0] < -90 || parts[0] > 90 || parts[1] < -180 || parts[1] > 180) return null;
    return { lat: parts[0], lng: parts[1] };
  }
  function formatCoords(latLng) {
    return latLng.lat().toFixed(7) + ',' + latLng.lng().toFixed(7);
  }

  // ─────────────────────────────────────────────────────────────────
  // DOM observer - watch for the coordsGoogle input being rendered and
  // upgrade it with a Google Map above the text field.
  // ─────────────────────────────────────────────────────────────────
  function attachDomObserver() {
    var rootEl = document.body;
    var enhance = throttle(function () { enhanceAll(); }, 200);
    var observer = new MutationObserver(enhance);
    observer.observe(rootEl, { childList: true, subtree: true });
    enhanceAll();
  }

  // Trailing-throttle so a burst of mutations only triggers one scan.
  function throttle(fn, ms) {
    var timer = null;
    return function () {
      if (timer) return;
      timer = setTimeout(function () { timer = null; fn(); }, ms);
    };
  }

  function enhanceAll() {
    // Decap renders each widget inside a wrapper whose label contains
    // the field label text. Find every wrapper labelled "Google Maps pin"
    // (or starting with it) and enhance its text input once.
    var labels = document.querySelectorAll('label');
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      if (label.dataset.pfoMapEnhanced === '1') continue;
      var text = (label.textContent || '').trim().toLowerCase();
      // Match labels like "Google Maps pin" (config.yml label for the
      // coordsGoogle field). Defensive substring match in case Decap
      // adds suffixes like " *" for required fields.
      if (text.indexOf('google maps pin') === -1) continue;
      var input = findAssociatedInput(label);
      if (!input) continue;
      label.dataset.pfoMapEnhanced = '1';
      injectMap(label, input);
    }
  }

  function findAssociatedInput(label) {
    // Try label[for] → element with that id
    var forId = label.getAttribute('for');
    if (forId) {
      var byFor = document.getElementById(forId);
      if (byFor && byFor.tagName === 'INPUT' && byFor.type === 'text') return byFor;
    }
    // Walk up to a reasonable field-wrapper ancestor, then look for a
    // text input inside it. Decap wraps each widget in a <div> with
    // various class names depending on its build; we cap the climb at 6.
    var node = label.parentElement;
    for (var i = 0; i < 6 && node; i++) {
      var input = node.querySelector('input[type="text"]');
      if (input) return input;
      node = node.parentElement;
    }
    return null;
  }

  function injectMap(label, input) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin: 8px 0;';
    var mapDiv = document.createElement('div');
    mapDiv.style.cssText =
      'height: 420px; width: 100%; ' +
      'border: 1px solid #d5dae3; border-radius: 4px; ' +
      'background: #e4e9f0;';
    var hint = document.createElement('div');
    hint.style.cssText =
      'margin-top: 6px; font-size: 12px; color: #5a6470;';
    hint.textContent = 'Click or drag the marker to set the venue location. The coordinates below update automatically.';
    wrap.appendChild(mapDiv);
    wrap.appendChild(hint);
    // Insert the wrapper just above the input element.
    if (input.parentNode) {
      input.parentNode.insertBefore(wrap, input);
    }

    loadGoogleMaps().then(function () {
      var initial = parseCoords(input.value) || DEFAULT_CENTRE;
      var map = new window.google.maps.Map(mapDiv, {
        center: initial,
        zoom: input.value ? 14 : 11,
        mapTypeId: 'roadmap',
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'cooperative',
      });
      var marker = new window.google.maps.Marker({
        position: initial,
        map: map,
        draggable: true,
        title: 'Drag to set venue',
      });

      // Find the native HTMLInputElement value setter; setting `.value`
      // directly bypasses React's value-tracker so React's onChange
      // wouldn't fire. The native setter + dispatched 'input' event
      // is the canonical workaround for updating a React-controlled
      // input from outside React.
      var nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ).set;

      function writeValue(latLng) {
        var v = formatCoords(latLng);
        nativeSetter.call(input, v);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      marker.addListener('dragend', function () {
        writeValue(marker.getPosition());
      });
      map.addListener('click', function (e) {
        marker.setPosition(e.latLng);
        map.panTo(e.latLng);
        writeValue(e.latLng);
      });

      // Keep map and marker in sync if Decap changes the input value
      // externally (rare - e.g. when navigating between entries the
      // DOM is recycled). We poll the input's value rather than wiring
      // a 'change' listener, because Decap re-renders the input and our
      // listener could detach. 500ms is fine for an admin UI.
      var lastSeen = input.value;
      setInterval(function () {
        if (!document.body.contains(input)) return;
        var v = input.value;
        if (v === lastSeen) return;
        lastSeen = v;
        var c = parseCoords(v);
        if (c) {
          marker.setPosition(c);
          map.panTo(c);
        }
      }, 500);
    }).catch(function (err) {
      console.error('[KERNO google-map]', err);
      mapDiv.innerHTML =
        '<p style="padding:16px;color:#a44;background:#fee;border:1px solid #fcc;margin:0;">' +
        'Could not load Google Maps. Paste coords into the field below instead.</p>';
    });
  }
})();
