/**
 * Datenpunk — multilingual content (i18n)
 * ========================================
 *
 * All user-visible copy lives in content/de.json and content/en.json.
 * HTML only marks *where* strings go (data attributes); it should not
 * contain wording you care about in production (except technical markup).
 *
 * Default language: German ("de"). The visitor’s choice is stored in
 * localStorage (STORAGE_KEY) so it survives reloads and works on every
 * HTML page in this site.
 *
 * Language switch UI: set ENABLE_LANG_SWITCH below to true to show the
 * DE | EN control again. When false, the site always loads German ("de");
 * localStorage is not read until the switch is re-enabled.
 *
 * Local preview: fetch() usually fails on file:// URLs. Run a static
 * server from this folder (e.g. python -m http.server) so JSON loads.
 *
 * ---------------------------------------------------------------------------
 * How to add a new translation key later
 * ---------------------------------------------------------------------------
 *
 * 1. Pick a stable dot path, e.g. "aboutPage.newSection.body".
 *
 * 2. Add that path with the SAME shape to BOTH de.json and en.json.
 *    Values must be strings (or numbers) at the leaf — not objects.
 *
 * 3. In HTML, put the key on the element:
 *      <p data-i18n="aboutPage.newSection.body"></p>
 *    When the locale loads or the user switches language, the script
 *    replaces the element’s textContent with the string from JSON.
 *
 * 4. For translated HTML *attributes* (aria-label, title, alt, …):
 *      <nav
 *        data-i18n-attr="nav.ariaMain"
 *        data-i18n-attr-name="aria-label"
 *        aria-label="">
 *      </nav>
 *    The attribute named in data-i18n-attr-name receives the value at
 *    data-i18n-attr in the JSON.
 *
 * 5. For the browser tab title on one page, set on the <html> element:
 *      <html data-i18n-document-title="meta.documentTitle.about" …>
 *    Then add meta.documentTitle.about (or your chosen key) in both
 *    JSON files. If the key is missing, meta.siteTitle is used instead.
 *
   * 6. For project cards on the home / projects pages, edit the "projects"
   *    array in JSON. Each item may include: id, href, title, teaser, cta,
   *    optional github (URL), and optional thumb + thumbAlt (thumbnail image
   *    URL and short alt text for the home / projects list).
 *    The script builds the card DOM from those fields (no extra keys in
 *    HTML for card body copy).
 *
 * 7. After adding keys, reload with DE and EN both selected once to
 *    confirm both files parse and every key resolves.
 *
 * Missing keys: if a path is absent or not a string/number, the UI
 * shows [your.path] so missing translations are obvious while editing.
 */

(function () {
  "use strict";

  var STORAGE_KEY = "datenpunk-lang";
  var LANGS = ["de", "en"];
  /** Set to true to show DE | EN and honour localStorage again. */
  var ENABLE_LANG_SWITCH = false;
  var cache = {};
  var progressBarEl = null;
  var revealObserver = null;

  function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function missingText(path) {
    return "[" + path + "]";
  }

  /** True if the JSON value can be shown as text in the DOM. */
  function isRenderableValue(val) {
    return typeof val === "string" || typeof val === "number";
  }

  function getStoredLang() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && LANGS.indexOf(stored) !== -1) return stored;
    } catch (e) {
      /* localStorage unavailable (private mode, policy, etc.) */
    }
    return "de";
  }

  function setStoredLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* ignore */
    }
  }

  function loadLocale(lang, callback) {
    if (cache[lang]) {
      callback(null, cache[lang]);
      return;
    }

    function setByPath(root, pathStr, value) {
      if (!root || !pathStr) return;

      // Tokens: "foo", "bar", 0, "baz" from "foo.bar[0].baz"
      var tokens = [];
      var i = 0;
      while (i < pathStr.length) {
        var ch = pathStr[i];
        if (ch === ".") {
          i++;
          continue;
        }
        if (ch === "[") {
          var end = pathStr.indexOf("]", i + 1);
          if (end === -1) break;
          var inner = pathStr.slice(i + 1, end);
          var idx = parseInt(inner, 10);
          if (!isNaN(idx)) tokens.push(idx);
          i = end + 1;
          continue;
        }
        // identifier
        var j = i;
        while (j < pathStr.length && pathStr[j] !== "." && pathStr[j] !== "[") j++;
        tokens.push(pathStr.slice(i, j));
        i = j;
      }

      var cur = root;
      for (var t = 0; t < tokens.length; t++) {
        var key = tokens[t];
        var isLast = t === tokens.length - 1;
        var nextKey = tokens[t + 1];
        var nextIsIndex = typeof nextKey === "number";

        if (isLast) {
          cur[key] = value;
          return;
        }

        if (cur[key] == null) {
          cur[key] = nextIsIndex ? [] : {};
        }

        cur = cur[key];
      }
    }

    function parseCopyMarkdown(text) {
      // Format produced by scripts/export-i18n-to-md.mjs:
      // ## `path.to.key`
      // <value lines> OR ```text ... ```
      var out = {};
      var lines = String(text || "").replace(/\r\n/g, "\n").split("\n");

      var curKey = null;
      var curValLines = [];
      var inFence = false;
      var started = false;

      function flush() {
        if (!curKey) return;
        var raw = curValLines.join("\n");
        var val = raw.trimEnd();
        setByPath(out, curKey, val);
      }

      for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        var m = line.match(/^##\s+`(.+)`\s*$/);
        if (!inFence && m) {
          started = true;
          flush();
          curKey = m[1];
          curValLines = [];
          continue;
        }

        if (!started) continue;

        if (line.trim() === "```text") {
          inFence = true;
          continue;
        }
        if (line.trim() === "```" && inFence) {
          inFence = false;
          continue;
        }

        // Collect value lines (including blank lines inside fences)
        curValLines.push(line);
      }

      flush();
      return out;
    }

    function loadFromMarkdown() {
      var mdUrl = "content/copy." + lang + ".md";
      return fetch(mdUrl, { cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error("Failed to load " + mdUrl);
        return res.text();
      });
    }

    loadFromMarkdown()
      .then(function (md) {
        var data = parseCopyMarkdown(md);
        cache[lang] = data;
        callback(null, data);
      })
      .catch(function (errMd) {
        console.error(errMd);
        callback(errMd, null);
      });
  }

  /**
   * Sets document.title from <html data-i18n-document-title="path.to.key">.
   * Falls back to meta.siteTitle so the tab is never empty when JSON loads.
   */
  function applyDocumentTitle(bundle) {
    var key = document.documentElement.getAttribute("data-i18n-document-title");
    var fallback = getByPath(bundle, "meta.siteTitle");
    if (!key) {
      if (isRenderableValue(fallback)) document.title = String(fallback);
      return;
    }
    var val = getByPath(bundle, key);
    if (isRenderableValue(val)) {
      document.title = String(val);
    } else if (isRenderableValue(fallback)) {
      document.title = String(fallback);
    } else {
      document.title = missingText(key);
    }
  }

  function applyHtmlLang(bundle) {
    var lang = getByPath(bundle, "meta.htmlLang");
    if (isRenderableValue(lang)) {
      document.documentElement.lang = String(lang);
    }
  }

  function applyDataI18nNodes(bundle) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var val = getByPath(bundle, key);
      if (isRenderableValue(val)) {
        el.textContent = String(val);
      } else {
        el.textContent = missingText(key);
      }
    });
  }

  function applyDataI18nAttrs(bundle) {
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      function applyOne(keyAttr, nameAttr, defaultName) {
        var key = el.getAttribute(keyAttr);
        if (!key) return;
        var attrName = el.getAttribute(nameAttr) || defaultName;
        var val = getByPath(bundle, key);
        if (isRenderableValue(val)) {
          el.setAttribute(attrName, String(val));
        } else {
          el.setAttribute(attrName, missingText(key));
        }
      }

      applyOne("data-i18n-attr", "data-i18n-attr-name", "aria-label");
      applyOne("data-i18n-attr-2", "data-i18n-attr-name-2", "title");
    });
  }

  function applyObfuscatedEmailLinks() {
    document.querySelectorAll("[data-email-link]").forEach(function (a) {
      var parent = a.parentElement || document;
      var userEl = parent.querySelector("[data-email-user]");
      var domainEl = parent.querySelector("[data-email-domain]");
      var user = userEl ? String(userEl.textContent || "").trim() : "";
      var domain = domainEl ? String(domainEl.textContent || "").trim() : "";
      if (!user || !domain) return;
      a.setAttribute("href", "mailto:" + user + "@" + domain);
    });
  }

  function updateLangButtons(lang) {
    document.querySelectorAll("[data-set-lang]").forEach(function (btn) {
      var code = btn.getAttribute("data-set-lang");
      btn.setAttribute("aria-pressed", code === lang ? "true" : "false");
    });
  }

  /**
   * Renders project rows into [data-project-list] from bundle.projects.
   * Markup follows a magazine “teaser” pattern (headline + dek + read line),
   * not product cards — styling is entirely in style.css (.teaser*).
   */
  function appendProjectGithubLink(target, proj, bundle, opts) {
    var options = opts || {};
    var raw = proj.github;
    var hasRaw = isRenderableValue(raw) && String(raw).trim() !== "";

    if (!hasRaw && !options.always) return;

    var label = getByPath(bundle, "common.projectGithubCta");
    var text = isRenderableValue(label) ? String(label) : "GitHub";

    var el;
    if (hasRaw) {
      el = document.createElement("a");
      el.href = String(raw).trim();
      el.setAttribute("rel", "noopener noreferrer");
      el.setAttribute("target", "_blank");
    } else {
      // Placeholder to keep card heights aligned when some projects lack GitHub.
      el = document.createElement("span");
      el.setAttribute("aria-hidden", "true");
    }

    el.className = options.className || "teaser__github";
    el.textContent = text;
    if (!hasRaw) el.classList.add("teaser__github--placeholder");

    target.appendChild(el);
  }

  function normalizeTag(tag) {
    if (!isRenderableValue(tag)) return "";
    return String(tag).trim();
  }

  function normalizeTagKey(tag) {
    // Must be safe for space-separated storage in data-tags.
    // e.g. "In Vorbereitung" -> "in-vorbereitung", "Data Viz" -> "data-viz"
    return normalizeTag(tag)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\u00C0-\u017F-]+/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function renderProjectCards(bundle) {
    var containers = document.querySelectorAll("[data-project-list]");
    if (!containers.length) return;

    var projects = getByPath(bundle, "projects");
    if (!Array.isArray(projects)) return;

    containers.forEach(function (container) {
      var max = container.getAttribute("data-project-limit");
      var list = max ? projects.slice(0, parseInt(max, 10)) : projects.slice();
      var layout = container.getAttribute("data-project-layout") || "";
      container.innerHTML = "";

      list.forEach(function (proj, index) {
        var hasLink = proj.href && String(proj.href).trim() !== "";
        var href = hasLink ? String(proj.href).trim() : "";
        var isExternalLink = /^https?:\/\//i.test(href);
        var thumbSrc = proj.thumb;
        var hasThumb =
          isRenderableValue(thumbSrc) && String(thumbSrc).trim() !== "";
        var effectiveThumbSrc =
          hasThumb || layout !== "featured"
            ? thumbSrc
            : "assets/images/meerkats.jpg";
        var effectiveHasThumb =
          isRenderableValue(effectiveThumbSrc) &&
          String(effectiveThumbSrc).trim() !== "";

        var tagsRaw = Array.isArray(proj.tags) ? proj.tags : [];
        var tags = tagsRaw
          .map(normalizeTag)
          .filter(function (t) {
            return t !== "";
          });
        tags.sort(function (a, b) {
          return String(a).localeCompare(String(b), undefined, {
            sensitivity: "base",
          });
        });
        var tagKeys = tags.map(normalizeTagKey);

        var article = document.createElement("article");
        article.className =
          "teaser reveal" + (hasLink ? " teaser--linked" : " teaser--static");
        if (effectiveHasThumb) article.classList.add("teaser--has-thumb");
        if (layout === "featured") article.classList.add("teaser--featured");
        if (tagKeys.length) article.setAttribute("data-tags", tagKeys.join(" "));

        var titleText = isRenderableValue(proj.title)
          ? String(proj.title)
          : missingText("projects[" + index + "].title");
        var deckText = isRenderableValue(proj.teaser)
          ? String(proj.teaser)
          : missingText("projects[" + index + "].teaser");
        var readText = isRenderableValue(proj.cta)
          ? String(proj.cta)
          : missingText("projects[" + index + "].cta");

        function appendTags(target) {
          if (!tags.length) return;
          var wrap = document.createElement("ul");
          wrap.className = "teaser__tags";
          tags.forEach(function (t) {
            var li = document.createElement("li");
            li.className = "teaser__tag";
            li.textContent = t;
            wrap.appendChild(li);
          });
          target.appendChild(wrap);
        }

        function appendTeaserTextNodes(target) {
          var h3 = document.createElement("h3");
          h3.className = "teaser__hed";
          h3.textContent = titleText;
          target.appendChild(h3);

          var deck = document.createElement("p");
          deck.className = "teaser__deck";
          deck.textContent = deckText;
          target.appendChild(deck);

          appendTags(target);

          // Featured cards use a cleaner editorial block: no "read" line.
          if (layout !== "featured") {
            var read = document.createElement("span");
            read.className = "teaser__read";
            read.textContent = readText;
            target.appendChild(read);
          }
        }

        function appendTeaserBodyNodes(target) {
          var deck = document.createElement("p");
          deck.className = "teaser__deck";
          deck.textContent = deckText;
          target.appendChild(deck);

          appendTags(target);
        }

        function makeTitleHed() {
          var h3 = document.createElement("h3");
          h3.className = "teaser__hed";
          h3.textContent = titleText;
          return h3;
        }

        function makeMediaWithTitle() {
          var media = document.createElement("div");
          media.className = "teaser__media";
          media.appendChild(makeThumbImg());
          media.appendChild(makeTitleHed());
          return media;
        }

        function makeThumbImg() {
          var img = document.createElement("img");
          img.className = "teaser__thumb";
          img.src = String(effectiveThumbSrc).trim();
          img.setAttribute("loading", "lazy");
          img.setAttribute("decoding", "async");
          var altVal = proj.thumbAlt;
          img.alt = isRenderableValue(altVal) ? String(altVal) : "";
          return img;
        }

        if (hasLink) {
          var link = document.createElement("a");
          link.className = "teaser__link";
          link.setAttribute("href", href);
          if (isExternalLink) {
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener noreferrer");
          }

          if (effectiveHasThumb) {
            if (layout === "featured") {
              link.appendChild(makeMediaWithTitle());
              var bodyF = document.createElement("div");
              bodyF.className = "teaser__body";
              appendTeaserBodyNodes(bodyF);
              link.appendChild(bodyF);
            } else {
              link.appendChild(makeThumbImg());
              var body = document.createElement("div");
              body.className = "teaser__body";
              appendTeaserTextNodes(body);
              link.appendChild(body);
            }
          } else {
            appendTeaserTextNodes(link);
          }

          article.appendChild(link);
        } else if (effectiveHasThumb) {
          var row = document.createElement("div");
          row.className = "teaser__row";
          if (layout === "featured") row.appendChild(makeMediaWithTitle());
          else row.appendChild(makeThumbImg());
          var bodyS = document.createElement("div");
          bodyS.className = "teaser__body";
          if (layout === "featured") appendTeaserBodyNodes(bodyS);
          else appendTeaserTextNodes(bodyS);
          row.appendChild(bodyS);
          article.appendChild(row);
        } else {
          appendTeaserTextNodes(article);
        }

        if (layout !== "featured") appendProjectGithubLink(article, proj, bundle);
        container.appendChild(article);
      });
    });
  }

  function initProjectTagFilters(bundle) {
    var filterRoot = document.querySelector("[data-project-tag-filter]");
    if (!filterRoot) return;

    var controls = filterRoot.querySelector(".tag-filter__controls");
    if (!controls) return;

    var listContainer = document.querySelector("[data-project-list]");
    if (!listContainer) return;

    var emptyEl = document.querySelector("[data-project-empty]");

    var projects = getByPath(bundle, "projects");
    if (!Array.isArray(projects)) return;

    var tagMap = {};
    projects.forEach(function (p) {
      var tags = Array.isArray(p.tags) ? p.tags : [];
      tags
        .map(normalizeTag)
        .filter(function (t) {
          return t !== "";
        })
        .forEach(function (t) {
          var key = normalizeTagKey(t);
          if (!key) return;
          if (!tagMap[key]) tagMap[key] = t;
        });
    });

    var keys = Object.keys(tagMap).sort(function (a, b) {
      return String(tagMap[a]).localeCompare(String(tagMap[b]), undefined, {
        sensitivity: "base",
      });
    });

    controls.innerHTML = "";

    var allLabel = getByPath(bundle, "projectsPage.filterAll");
    var allText = isRenderableValue(allLabel) ? String(allLabel) : "All";

    var selected = {};

    function getSelectedKeys() {
      return Object.keys(selected).filter(function (k) {
        return selected[k];
      });
    }

    function setButtonState(btn, on) {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }

    function applyFilter() {
      var selectedKeys = getSelectedKeys();
      var cards = listContainer.querySelectorAll("article.teaser");
      var shown = 0;

      cards.forEach(function (card) {
        var tagAttr = card.getAttribute("data-tags") || "";
        var tags = tagAttr ? tagAttr.split(/\s+/).filter(Boolean) : [];

        var match =
          selectedKeys.length === 0 ||
          selectedKeys.some(function (k) {
            return tags.indexOf(k) !== -1;
          });

        card.hidden = !match;
        if (match) shown++;
      });

      if (emptyEl) emptyEl.hidden = shown !== 0;
    }

    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "tag-filter__btn tag-filter__btn--all";
    allBtn.textContent = allText;
    setButtonState(allBtn, true);
    allBtn.addEventListener("click", function () {
      selected = {};
      Array.prototype.slice.call(controls.querySelectorAll("[data-tag-key]")).forEach(function (b) {
        setButtonState(b, false);
      });
      setButtonState(allBtn, true);
      applyFilter();
    });
    controls.appendChild(allBtn);

    keys.forEach(function (key) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-filter__btn";
      btn.textContent = tagMap[key];
      btn.setAttribute("data-tag-key", key);
      setButtonState(btn, false);
      btn.addEventListener("click", function () {
        var next = !selected[key];
        selected[key] = next;
        setButtonState(btn, next);

        var any = getSelectedKeys().length > 0;
        setButtonState(allBtn, !any);
        applyFilter();
      });
      controls.appendChild(btn);
    });

    applyFilter();
  }

  function initFeaturedCarousel() {
    var container = document.querySelector("[data-featured-carousel]");
    if (!container) return;

    var articles = Array.prototype.slice.call(container.querySelectorAll(":scope > article"));
    if (!articles.length) return;

    // Only “carousel mode” when scrolling is possible (3+ cards).
    if (articles.length <= 2) {
      container.removeAttribute("data-featured-ready");
      return;
    }
    container.setAttribute("data-featured-ready", "true");

    var dotsRoot = document.querySelector("[data-featured-dots]");
    if (!dotsRoot) return;

    var dots = Array.prototype.slice.call(dotsRoot.querySelectorAll("[data-featured-dot]"));
    if (dots.length < 2) return;

    function setActive(idx) {
      dots.forEach(function (d, i) {
        d.setAttribute("aria-current", i === idx ? "true" : "false");
      });
    }

    function cardStepPx() {
      if (!articles.length) return 0;
      var a0 = articles[0];
      var a1 = articles[1];
      if (!a0) return 0;
      if (!a1) return a0.getBoundingClientRect().width;
      return Math.max(0, a1.offsetLeft - a0.offsetLeft);
    }

    function scrollLeftForEnd() {
      // Desired “end” view:
      // - 3 cards: show (2,3) => left at 1 step
      // - 4 cards: show (3,4) => left at 2 steps
      var steps = Math.max(0, Math.min(2, articles.length - 2));
      var stepPx = cardStepPx();
      if (!stepPx) return container.scrollWidth - container.clientWidth;
      return steps * stepPx;
    }

    if (container.getAttribute("data-featured-bound") !== "true") {
      dots.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.getAttribute("data-featured-dot"), 10);
          if (isNaN(idx)) return;
          var left = idx === 0 ? 0 : scrollLeftForEnd();
          container.scrollTo({ left: left, behavior: "smooth" });
        });
      });

      var ticking = false;
      function onScroll() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          ticking = false;
          var endLeft = scrollLeftForEnd();
          var atEnd = endLeft > 0 && container.scrollLeft >= endLeft * 0.5;
          setActive(atEnd ? 1 : 0);
        });
      }

      container.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      container.setAttribute("data-featured-bound", "true");
    }

    // Initial state
    setActive(0);
  }

  function initEuropeMap() {
    var maps = document.querySelectorAll("[data-europe-map]");
    if (!maps.length) return;

    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || !("IntersectionObserver" in window)) {
      maps.forEach(function (svg) {
        svg.classList.add("is-visible");
      });
      return;
    }

    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-visible");
          obs.unobserve(e.target);
        });
      },
      { threshold: 0.25 }
    );

    maps.forEach(function (svg) {
      if (!svg.classList.contains("is-visible")) obs.observe(svg);
    });
  }

  /**
   * Applies one loaded locale bundle to the current DOM: lang, title,
   * all data-i18n nodes, attribute translations, and project cards.
   * Call this whenever the active language changes or after first load.
   */
  function applyLocaleToPage(bundle) {
    if (!bundle) return;
    applyHtmlLang(bundle);
    applyDocumentTitle(bundle);
    applyDataI18nNodes(bundle);
    applyDataI18nAttrs(bundle);
    renderProjectCards(bundle);
    initFeaturedCarousel();
    initEuropeMap();
    initProjectTagFilters(bundle);
    applyObfuscatedEmailLinks();
    refreshReveals();
  }

  function applyLanguage(lang) {
    updateLangButtons(lang);
    loadLocale(lang, function (err, bundle) {
      if (err || !bundle) return;
      applyLocaleToPage(bundle);
    });
  }

  function initProgressBar() {
    if (document.getElementById("progress")) {
      progressBarEl = document.getElementById("progress");
      progressBarEl.classList.add("progress-bar");
      return;
    }

    progressBarEl = document.createElement("div");
    progressBarEl.id = "progress";
    progressBarEl.className = "progress-bar";
    document.body.appendChild(progressBarEl);
  }

  function updateProgressBar() {
    if (!progressBarEl) return;
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    if (max <= 0) {
      progressBarEl.style.width = "0%";
      return;
    }
    var pct = (h.scrollTop / max) * 100;
    progressBarEl.style.width = pct.toFixed(2) + "%";
  }

  function initScrollProgress() {
    initProgressBar();

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        updateProgressBar();
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    updateProgressBar();
  }

  function initReveals() {
    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      refreshReveals();
      return;
    }

    if (!("IntersectionObserver" in window)) {
      refreshReveals();
      return;
    }

    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("reveal--visible");
            revealObserver.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    refreshReveals();
  }

  function refreshReveals() {
    var nodes = document.querySelectorAll(".reveal:not(.reveal--visible)");
    if (!nodes.length) return;

    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || !("IntersectionObserver" in window) || !revealObserver) {
      nodes.forEach(function (el) {
        el.classList.add("reveal--visible");
      });
      return;
    }

    nodes.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  function init() {
    if (!ENABLE_LANG_SWITCH) {
      document.documentElement.classList.add("lang-switch-off");
    }

    var initialLang = ENABLE_LANG_SWITCH ? getStoredLang() : "de";
    applyLanguage(initialLang);

    initScrollProgress();
    initReveals();

    if (!ENABLE_LANG_SWITCH) return;

    document.querySelectorAll("[data-set-lang]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = btn.getAttribute("data-set-lang");
        if (!next || LANGS.indexOf(next) === -1) return;
        setStoredLang(next);
        applyLanguage(next);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
