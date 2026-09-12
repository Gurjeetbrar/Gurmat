(function () {
  "use strict";

  var DATA_URL = "data/dictionary.json";
  var entries = [];
  var byId = {};

  var searchInput = document.getElementById("search-input");
  var clearBtn = document.getElementById("clear-btn");
  var resultsEl = document.getElementById("results");
  var allWordsEl = document.getElementById("all-words");
  var template = document.getElementById("entry-template");

  function normalize(str) {
    return (str || "")
      .toString()
      .toLowerCase()
      .normalize("NFC")
      .trim();
  }

  function loadFailedMessage() {
    resultsEl.innerHTML =
      '<div class="no-results">Could not load the dictionary data.<br>' +
      "If you opened this file directly from disk, browsers block local file requests — " +
      "serve the folder instead, e.g. run <code>python3 -m http.server</code> in this directory " +
      "and open <code>http://localhost:8000</code>, or host it on GitHub Pages.</div>";
  }

  function init(data) {
    entries = data;
    entries.forEach(function (e) {
      byId[e.id] = e;
    });
    renderChips();
    renderEmptyState();
  }

  function renderChips() {
    var sorted = entries.slice().sort(function (a, b) {
      return a.transliteration.localeCompare(b.transliteration);
    });
    var frag = document.createDocumentFragment();
    sorted.forEach(function (e) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = e.transliteration;
      chip.addEventListener("click", function () {
        searchInput.value = e.transliteration;
        runSearch(e.transliteration);
        searchInput.focus();
      });
      frag.appendChild(chip);
    });
    allWordsEl.appendChild(frag);
  }

  function renderEmptyState() {
    resultsEl.innerHTML =
      '<div class="empty-state">Type a word above, or pick one below, to see its meaning, ' +
      "root breakdown, and the tradition it comes from.</div>";
  }

  function matchScore(entry, q) {
    if (!q) return 0;
    var fields = [entry.transliteration, entry.gurmukhi, entry.id]
      .concat(entry.alt || []);
    for (var i = 0; i < fields.length; i++) {
      var f = normalize(fields[i]);
      if (f === q) return 100;
    }
    for (var i = 0; i < fields.length; i++) {
      var f = normalize(fields[i]);
      if (f.indexOf(q) === 0) return 80;
    }
    for (var i = 0; i < fields.length; i++) {
      var f = normalize(fields[i]);
      if (f.indexOf(q) !== -1) return 60;
    }
    var haystack = normalize(
      [
        entry.meaning,
        entry.etymology && entry.etymology.rootLanguage,
        entry.etymology && entry.etymology.note,
        entry.context && entry.context.note,
        (entry.context && entry.context.associatedWith || []).join(" ")
      ].join(" ")
    );
    if (haystack.indexOf(q) !== -1) return 30;
    return 0;
  }

  function search(query) {
    var q = normalize(query);
    if (!q) return [];
    return entries
      .map(function (e) {
        return { entry: e, score: matchScore(e, q) };
      })
      .filter(function (r) {
        return r.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .map(function (r) {
        return r.entry;
      });
  }

  function chipFor(id, label) {
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = label;
    chip.addEventListener("click", function () {
      searchInput.value = label;
      runSearch(label);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    return chip;
  }

  function renderEntry(entry) {
    var node = template.content.cloneNode(true);

    node.querySelector(".gurmukhi").textContent = entry.gurmukhi;
    node.querySelector(".translit").textContent = entry.transliteration;
    node.querySelector(".pos").textContent = entry.partOfSpeech || "";

    node.querySelector(".meaning").textContent = entry.meaning;

    var breakdownBlock = node.querySelector(".breakdown-block");
    var breakdownList = node.querySelector(".breakdown-list");
    if (entry.breakable && entry.breakdown && entry.breakdown.length) {
      entry.breakdown.forEach(function (part) {
        var li = document.createElement("li");
        var b = document.createElement("b");
        b.textContent = part.part + ": ";
        li.appendChild(b);
        li.appendChild(document.createTextNode(part.meaning));
        breakdownList.appendChild(li);
      });
    } else {
      breakdownBlock.querySelector("h3").textContent = "Breakdown";
      var li = document.createElement("li");
      li.textContent = "Not a compound in the usual sense — treated as a single root word.";
      breakdownList.appendChild(li);
    }

    if (entry.etymology) {
      node.querySelector(".etym-root").textContent =
        (entry.etymology.rootLanguage ? entry.etymology.rootLanguage + " — " : "") +
        (entry.etymology.rootForm || "");
      node.querySelector(".etym-note").textContent = entry.etymology.note || "";
    }

    if (entry.context) {
      var used = (entry.context.associatedWith || []).join(", ");
      node.querySelector(".context-used").textContent = used
        ? "Associated with: " + used
        : "";
      node.querySelector(".context-note").textContent = entry.context.note || "";
    }

    var relatedWrap = node.querySelector(".related-chips");
    var relatedBlock = node.querySelector(".related-block");
    var relatedIds = entry.relatedIds || [];
    if (relatedIds.length) {
      relatedIds.forEach(function (rid) {
        var related = byId[rid];
        if (related) {
          relatedWrap.appendChild(chipFor(rid, related.transliteration));
        }
      });
    } else {
      relatedBlock.hidden = true;
    }

    return node;
  }

  function runSearch(query) {
    clearBtn.hidden = !query;
    if (!query) {
      renderEmptyState();
      return;
    }
    var matches = search(query);
    if (!matches.length) {
      resultsEl.innerHTML =
        '<div class="no-results">No entries match "' +
        query.replace(/[<>&]/g, "") +
        '" yet. Try a transliteration, the Gurmukhi spelling, or a plain-English meaning keyword.</div>';
      return;
    }
    resultsEl.innerHTML = "";
    var frag = document.createDocumentFragment();
    matches.forEach(function (entry) {
      frag.appendChild(renderEntry(entry));
    });
    resultsEl.appendChild(frag);
  }

  searchInput.addEventListener("input", function (e) {
    runSearch(e.target.value);
  });

  clearBtn.addEventListener("click", function () {
    searchInput.value = "";
    runSearch("");
    searchInput.focus();
  });

  fetch(DATA_URL)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(init)
    .catch(function (err) {
      console.error("Failed to load dictionary data:", err);
      loadFailedMessage();
    });
})();
