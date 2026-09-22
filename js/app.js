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

  function confidenceBadge(level) {
    var span = document.createElement("span");
    var lvl = (level || "unknown").toLowerCase();
    span.className = "confidence-badge confidence-" + lvl;
    span.textContent = lvl.charAt(0).toUpperCase() + lvl.slice(1) + " confidence";
    return span;
  }

  function statusBadge(status) {
    var span = document.createElement("span");
    var s = (status || "unknown").toLowerCase();
    span.className = "status-badge status-" + s;
    span.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    return span;
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

    var grammarBlock = node.querySelector(".grammar-block");
    var grammarList = node.querySelector(".grammar-list");
    if (entry.grammar) {
      var g = entry.grammar;
      var gFields = [
        ["Part of speech", g.partOfSpeech],
        ["Lemma vs. inflected form", g.lemmaVsInflected],
        ["Lagaan-matra (vowel-ending) note", g.lagaanMatraNote],
        ["Sentence function", g.sentenceFunction],
        ["Grammatical authority", g.authority]
      ];
      var anyGrammar = false;
      gFields.forEach(function (pair) {
        if (pair[1]) {
          anyGrammar = true;
          var dt = document.createElement("dt");
          dt.textContent = pair[0];
          var dd = document.createElement("dd");
          dd.textContent = pair[1];
          grammarList.appendChild(dt);
          grammarList.appendChild(dd);
        }
      });
      if (!anyGrammar) grammarBlock.hidden = true;
    } else {
      grammarBlock.hidden = true;
    }

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

    var originCandidatesWrap = node.querySelector(".origin-candidates");
    var originGapEl = node.querySelector(".origin-gap");
    if (entry.originAnalysis) {
      var oa = entry.originAnalysis;
      if (oa.status) {
        var statusLine = document.createElement("div");
        statusLine.className = "origin-status-line";
        statusLine.appendChild(document.createTextNode("Origin status: "));
        statusLine.appendChild(statusBadge(oa.status));
        originCandidatesWrap.appendChild(statusLine);
      }
      (oa.candidates || []).forEach(function (c) {
        var card = document.createElement("div");
        card.className = "origin-candidate";

        var head = document.createElement("div");
        head.className = "origin-candidate-head";
        head.appendChild(document.createTextNode((c.sourceLanguage || "") + " — " + (c.originalScriptForm || "")));
        if (c.confidence) head.appendChild(confidenceBadge(c.confidence));
        card.appendChild(head);

        if (c.components && c.components.length) {
          var comp = document.createElement("p");
          comp.className = "origin-components";
          comp.textContent = c.components.join(" + ");
          card.appendChild(comp);
        }
        if (c.rootMeaning) {
          var rm = document.createElement("p");
          rm.textContent = c.rootMeaning;
          card.appendChild(rm);
        }
        if (c.authority) {
          var auth = document.createElement("p");
          auth.className = "origin-authority";
          auth.textContent = "Authority: " + c.authority;
          card.appendChild(auth);
        }
        originCandidatesWrap.appendChild(card);
      });
      originGapEl.textContent = oa.rootVsUsageGap || "";
    }

    if (entry.context) {
      var used = (entry.context.associatedWith || []).join(", ");
      node.querySelector(".context-used").textContent = used
        ? "Associated with: " + used
        : "";
      node.querySelector(".context-note").textContent = entry.context.note || "";
    }

    var sensesBlock = node.querySelector(".senses-block");
    var sensesList = node.querySelector(".senses-list");
    var attestedSenses = entry.attestedSenses || [];
    if (attestedSenses.length) {
      attestedSenses.forEach(function (s) {
        var item = document.createElement("div");
        item.className = "sense-item";

        var head = document.createElement("div");
        head.className = "sense-head";
        head.appendChild(document.createTextNode(s.register ? s.register + " sense" : "Sense"));
        if (s.confidence) head.appendChild(confidenceBadge(s.confidence));
        item.appendChild(head);

        var meaning = document.createElement("p");
        meaning.className = "sense-meaning";
        meaning.textContent = s.meaning || "";
        item.appendChild(meaning);

        if (s.usageNote) {
          var note = document.createElement("p");
          note.textContent = s.usageNote;
          item.appendChild(note);
        }

        (s.textualEvidence || []).forEach(function (te) {
          var ev = document.createElement("div");
          ev.className = "textual-evidence";

          if (te.verseGurmukhi) {
            var verse = document.createElement("p");
            verse.className = "usage-pankti";
            verse.textContent = te.verseGurmukhi;
            ev.appendChild(verse);
            if (te.verseTransliteration) {
              var tl = document.createElement("p");
              tl.className = "evidence-translit";
              tl.textContent = te.verseTransliteration;
              ev.appendChild(tl);
            }
          } else {
            var noVerse = document.createElement("p");
            noVerse.className = "evidence-no-verse";
            noVerse.textContent = "No specific verse cited for this sense — see source note below.";
            ev.appendChild(noVerse);
          }

          var metaBits = [];
          if (te.author) metaBits.push(te.author);
          if (te.raag) metaBits.push(te.raag);
          if (te.ang) metaBits.push("Ang " + te.ang);
          if (metaBits.length) {
            var meta = document.createElement("div");
            meta.className = "evidence-meta";
            meta.textContent = metaBits.join(" · ");
            ev.appendChild(meta);
          }

          var verifiedBadge = document.createElement("span");
          verifiedBadge.className = "verified-badge " + (te.verified ? "verified-true" : "verified-false");
          verifiedBadge.textContent = te.verified ? "Corpus-verified" : "Not independently verified";
          ev.appendChild(verifiedBadge);

          if (te.source) {
            var src = document.createElement("p");
            src.className = "evidence-source";
            src.textContent = te.source;
            ev.appendChild(src);
          }

          item.appendChild(ev);
        });

        sensesList.appendChild(item);
      });
    } else {
      sensesBlock.hidden = true;
    }

    var crossLingBlock = node.querySelector(".cross-ling-block");
    if (entry.crossLinguisticProfile) {
      var clp = entry.crossLinguisticProfile;
      var authors = (clp.authorsWhoUseIt || []).join(", ");
      node.querySelector(".cross-ling-authors").textContent = authors
        ? "Authors: " + authors
        : "";
      var an = clp.adaptationNote || {};
      var noteEl = node.querySelector(".cross-ling-note");
      noteEl.textContent = an.text || "";
      if (an.confidence || an.layer) {
        var tag = document.createElement("span");
        tag.className = "layer-tag layer-" + (an.layer || "interpretive");
        tag.textContent = (an.layer || "interpretive");
        noteEl.appendChild(document.createTextNode(" "));
        noteEl.appendChild(tag);
        if (an.confidence) noteEl.appendChild(confidenceBadge(an.confidence));
      }
      if (!an.text && !authors) crossLingBlock.hidden = true;
    } else {
      crossLingBlock.hidden = true;
    }

    var operationalBlock = node.querySelector(".operational-block");
    if (entry.operationalReading && entry.operationalReading.reading) {
      var opr = entry.operationalReading;
      node.querySelector(".operational-reading").textContent = opr.reading;
      var groundedEl = node.querySelector(".operational-grounded");
      groundedEl.textContent = opr.groundedIn ? "Grounded in: " + opr.groundedIn : "";
      if (opr.confidence) groundedEl.appendChild(confidenceBadge(opr.confidence));
    } else {
      operationalBlock.hidden = true;
    }

    var usageBlock = node.querySelector(".usage-block");
    var usageList = node.querySelector(".usage-list");
    var usageItems = entry.usageInContext || [];
    if (usageItems.length) {
      usageItems.forEach(function (u) {
        var item = document.createElement("div");
        item.className = "usage-item";

        if (u.pankti) {
          var pankti = document.createElement("p");
          pankti.className = "usage-pankti";
          pankti.textContent = u.pankti;
          item.appendChild(pankti);
        }

        if (u.source) {
          var source = document.createElement("div");
          source.className = "usage-source";
          source.textContent = u.source;
          item.appendChild(source);
        }

        if (u.shabdarthHere) {
          var shabdarth = document.createElement("p");
          shabdarth.innerHTML = "<b>Shabdarth (literal, here): </b>";
          shabdarth.appendChild(document.createTextNode(u.shabdarthHere));
          item.appendChild(shabdarth);
        }

        if (u.bhavarth) {
          var bhavarth = document.createElement("p");
          bhavarth.innerHTML = "<b>Bhavarth (deeper sense): </b>";
          bhavarth.appendChild(document.createTextNode(u.bhavarth));
          item.appendChild(bhavarth);
        }

        if (u.note) {
          var note = document.createElement("p");
          note.className = "usage-note";
          note.textContent = u.note;
          item.appendChild(note);
        }

        if (u.relatesTo && u.relatesTo.length) {
          var relWrap = document.createElement("div");
          relWrap.className = "usage-related-chips";
          u.relatesTo.forEach(function (rid) {
            var rel = byId[rid];
            if (rel) relWrap.appendChild(chipFor(rid, rel.transliteration));
          });
          item.appendChild(relWrap);
        }

        usageList.appendChild(item);
      });
    } else {
      usageBlock.hidden = true;
    }

    var interpBlock = node.querySelector(".interpretations-block");
    var interpList = node.querySelector(".interpretations-list");
    var interpItems = entry.interpretations || [];
    if (interpItems.length) {
      interpItems.forEach(function (i) {
        var item = document.createElement("div");
        item.className = "interpretation-item";

        var source = document.createElement("div");
        source.className = "interp-source";
        source.textContent = i.source || "";
        item.appendChild(source);

        var view = document.createElement("p");
        view.textContent = i.view || "";
        item.appendChild(view);

        if (i.note) {
          var note = document.createElement("p");
          note.className = "interp-caveat";
          note.textContent = i.note;
          item.appendChild(note);
        }

        interpList.appendChild(item);
      });
    } else {
      interpBlock.hidden = true;
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

    var overallConfEl = node.querySelector(".overall-confidence");
    if (entry.overallConfidence) {
      overallConfEl.appendChild(document.createTextNode("Overall confidence: "));
      overallConfEl.appendChild(confidenceBadge(entry.overallConfidence));
      if (entry.viakaranSources && entry.viakaranSources.length) {
        var srcNote = document.createElement("span");
        srcNote.className = "sources-note";
        srcNote.textContent = " · Sources: " + entry.viakaranSources.join("; ");
        overallConfEl.appendChild(srcNote);
      }
    } else {
      overallConfEl.hidden = true;
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
