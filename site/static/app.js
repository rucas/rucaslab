(function() {
  var root = document.documentElement;
  var btn = document.getElementById("theme-toggle");
  var saved = localStorage.getItem("theme");
  if (saved) root.dataset.theme = saved;

  function isDark() {
    if (root.dataset.theme) return root.dataset.theme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function updateIcon() {
    btn.textContent = isDark() ? "☀" : "☾";
  }
  updateIcon();
  btn.addEventListener("click", function() {
    var next = isDark() ? "light" : "dark";
    root.dataset.theme = next;
    localStorage.setItem("theme", next);
    updateIcon();
  });

  function fuzzy(text, query) {
    var t = text.toLowerCase(),
      q = query.toLowerCase();
    var ti = 0;
    for (var qi = 0; qi < q.length; qi++) {
      ti = t.indexOf(q[qi], ti);
      if (ti === -1) return false;
      ti++;
    }
    return true;
  }

  document.getElementById("search").addEventListener("input", function() {
    var q = this.value;
    document.querySelectorAll(".card").forEach(function(card) {
      card.style.display = !q || fuzzy(card.textContent, q) ? "" : "none";
    });
  });

  var _sgId = 0;

  function renderSparkline(svgEl, values) {
    if (values.length < 2) return;
    var w = 100,
      h = 40;
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var range = max - min || 0.001;
    var coords = values.map(function(v, i) {
      return [
        (i / (values.length - 1)) * w,
        h - ((v - min) / range) * (h - 2) - 1,
      ];
    });
    var d = "M" + coords[0][0].toFixed(1) + "," + coords[0][1].toFixed(1);
    for (var i = 1; i < coords.length; i++) {
      var x0 = coords[i - 1][0],
        y0 = coords[i - 1][1];
      var x1 = coords[i][0],
        y1 = coords[i][1];
      var dx = (x1 - x0) * 0.4;
      d +=
        " C" +
        (x0 + dx).toFixed(1) +
        "," +
        y0.toFixed(1) +
        " " +
        (x1 - dx).toFixed(1) +
        "," +
        y1.toFixed(1) +
        " " +
        x1.toFixed(1) +
        "," +
        y1.toFixed(1);
    }
    var fillD = d + " L" + w + "," + h + " L0," + h + " Z";
    var gid = "sg" + ++_sgId;
    svgEl.setAttribute("viewBox", "0 0 " + w + " " + h);
    svgEl.setAttribute("preserveAspectRatio", "none");
    svgEl.innerHTML =
      '<defs><linearGradient id="' +
      gid +
      '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="currentColor" stop-opacity="0.2"/>' +
      '<stop offset="100%" stop-color="currentColor" stop-opacity="0"/>' +
      "</linearGradient></defs>" +
      '<path d="' +
      fillD +
      '" fill="url(#' +
      gid +
      ')" stroke="none"/>' +
      '<path d="' +
      d +
      '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
  }

  function cacheSet(key, val) {
    try {
      localStorage.setItem(
        "rc:" + key,
        JSON.stringify({ v: val, t: Date.now() }),
      );
    } catch (_) { }
  }
  function cacheGet(key) {
    try {
      var raw = localStorage.getItem("rc:" + key);
      return raw ? JSON.parse(raw).v : null;
    } catch (_) {
      return null;
    }
  }
  function cacheAge(key) {
    try {
      var raw = localStorage.getItem("rc:" + key);
      return raw ? Date.now() - JSON.parse(raw).t : Infinity;
    } catch (_) {
      return Infinity;
    }
  }

  var DEV =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var CACHE_TTL = 55 * 1000;

  function devMockResponse(url) {
    var now = Math.floor(Date.now() / 1000);
    if (url.indexOf("query_range") !== -1) {
      var base = 0.01 + Math.random() * 0.04;
      var values = [];
      for (var i = 0; i < 24; i++)
        values.push([
          now - 86400 + i * 3600,
          String(Math.max(0.001, base + (Math.random() - 0.5) * 0.01)),
        ]);
      return {
        status: "success",
        data: {
          resultType: "matrix",
          result: [{ metric: {}, values: values }],
        },
      };
    }
    if (url.indexOf("/loki/") !== -1) {
      return {
        status: "success",
        data: {
          resultType: "vector",
          result: [
            {
              metric: {},
              value: [now, String(10 + Math.floor(Math.random() * 490))],
            },
          ],
        },
      };
    }
    return {
      status: "success",
      data: {
        resultType: "vector",
        result: [{ metric: {}, value: [now, "1"] }],
      },
    };
  }

  function fetchCached(key, url) {
    var cached = cacheGet(key);
    if (cached !== null && cacheAge(key) < CACHE_TTL) {
      var hit = { data: cached, stale: false };
      return { cached: hit, fresh: Promise.resolve(hit) };
    }
    var cachedResult = cached ? { data: cached, stale: true } : null;
    var fresh = fetch(url)
      .then(function(r) {
        return r.json();
      })
      .then(function(data) {
        cacheSet(key, data);
        return { data: data, stale: false };
      })
      .catch(function() {
        return cachedResult;
      });
    return { cached: cachedResult, fresh: fresh };
  }

  function patchCard(card, rangeRes, statusRes, hitsRes) {
    var dot = card.querySelector(".status-dot");
    var sparkSvg = card.querySelector(".sparkline");
    var latencyEl = card.querySelector(".latency");
    var hitsEl = card.querySelector(".hits");

    if (rangeRes) {
      var rr =
        rangeRes.data.data &&
        rangeRes.data.data.result &&
        rangeRes.data.data.result[0];
      if (rr && rr.values && rr.values.length) {
        var vals = rr.values.map(function(v) {
          return parseFloat(v[1]);
        });
        renderSparkline(sparkSvg, vals);
        var avg =
          vals.reduce(function(s, v) {
            return s + v;
          }, 0) / vals.length;
        latencyEl.textContent = Math.round(avg * 1000) + "ms avg";
        latencyEl.classList.toggle("stale", rangeRes.stale);
      }
    }

    if (statusRes) {
      var sr =
        statusRes.data.data &&
        statusRes.data.data.result &&
        statusRes.data.data.result[0];
      if (sr)
        dot.className =
          "status-dot " +
          (parseFloat(sr.value[1]) === 1 ? "online" : "offline");
    }

    if (hitsRes) {
      var hr =
        hitsRes.data.data &&
        hitsRes.data.data.result &&
        hitsRes.data.data.result[0];
      if (hr) {
        var count = parseInt(hr.value[1], 10);
        if (count > 0) {
          hitsEl.textContent = count + " visit" + (count === 1 ? "" : "s");
          hitsEl.classList.toggle("stale", hitsRes.stale);
        }
      }
    }
  }

  function loadCard(card) {
    var url = card.dataset.url;
    var name = card.dataset.name;
    var now = Math.floor(Date.now() / 1000);
    var rangeReq = fetchCached(
      "range:" + url,
      "/prometheus/api/v1/query_range?query=" +
      encodeURIComponent(
        'probe_duration_seconds{job="blackbox-golinks",instance="' +
        url +
        '"}',
      ) +
      "&start=" +
      (now - 86400) +
      "&end=" +
      now +
      "&step=3600",
    );
    var statusReq = fetchCached(
      "status:" + url,
      "/prometheus/api/v1/query?query=" +
      encodeURIComponent(
        'probe_success{job="blackbox-golinks",instance="' + url + '"}',
      ),
    );
    var hostname = new URL(url).hostname;
    var hitsReq = fetchCached(
      "hits:" + name,
      "/loki/loki/api/v1/query?query=" +
      encodeURIComponent(
        'sum(count_over_time({unit="caddy.service"} |= "' +
        hostname +
        '" != "Go-http-client" [168h]))',
      ),
    );
    patchCard(card, rangeReq.cached, statusReq.cached, hitsReq.cached);
    return Promise.all([rangeReq.fresh, statusReq.fresh, hitsReq.fresh]).then(
      function(res) {
        patchCard(card, res[0], res[1], res[2]);
      },
    );
  }

  var cards = Array.from(document.querySelectorAll(".card[data-url]"));

  if (DEV) {
    window.fetch = function(url) {
      return new Promise(function(resolve) {
        setTimeout(
          function() {
            resolve({
              json: function() {
                return Promise.resolve(devMockResponse(url));
              },
            });
          },
          400 + Math.random() * 1200,
        );
      });
    };
  }

  var lastUpdatedEl = document.getElementById("last-updated");

  function pollAll() {
    Promise.all(cards.map(loadCard)).then(function() {
      if (lastUpdatedEl)
        lastUpdatedEl.textContent = new Date().toLocaleTimeString();
    });
  }

  pollAll();
  setInterval(pollAll, 60000);
})();
