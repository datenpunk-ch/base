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
    var url = "content/" + lang + ".json";
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load " + url);
        return res.json();
      })
      .then(function (data) {
        cache[lang] = data;
        callback(null, data);
      })
      .catch(function (err) {
        console.error(err);
        callback(err, null);
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
      var key = el.getAttribute("data-i18n-attr");
      var attrName = el.getAttribute("data-i18n-attr-name") || "aria-label";
      var val = getByPath(bundle, key);
      if (isRenderableValue(val)) {
        el.setAttribute(attrName, String(val));
      } else {
        el.setAttribute(attrName, missingText(key));
      }
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
  function appendProjectGithubLink(article, proj, bundle) {
    var raw = proj.github;
    if (!isRenderableValue(raw) || String(raw).trim() === "") return;

    var gh = document.createElement("a");
    gh.className = "teaser__github";
    gh.href = String(raw).trim();
    gh.setAttribute("rel", "noopener noreferrer");
    gh.setAttribute("target", "_blank");

    var label = getByPath(bundle, "common.projectGithubCta");
    gh.textContent = isRenderableValue(label) ? String(label) : "GitHub";

    article.appendChild(gh);
  }

  function renderProjectCards(bundle) {
    var containers = document.querySelectorAll("[data-project-list]");
    if (!containers.length) return;

    var projects = getByPath(bundle, "projects");
    if (!Array.isArray(projects)) return;

    containers.forEach(function (container) {
      var max = container.getAttribute("data-project-limit");
      var list = max ? projects.slice(0, parseInt(max, 10)) : projects.slice();
      container.innerHTML = "";

      list.forEach(function (proj, index) {
        var hasLink = proj.href && String(proj.href).trim() !== "";
        var href = hasLink ? String(proj.href).trim() : "";
        var isExternalLink = /^https?:\/\//i.test(href);
        var thumbSrc = proj.thumb;
        var hasThumb =
          isRenderableValue(thumbSrc) && String(thumbSrc).trim() !== "";

        var article = document.createElement("article");
        article.className =
          "teaser reveal" + (hasLink ? " teaser--linked" : " teaser--static");
        if (hasThumb) article.classList.add("teaser--has-thumb");

        var titleText = isRenderableValue(proj.title)
          ? String(proj.title)
          : missingText("projects[" + index + "].title");
        var deckText = isRenderableValue(proj.teaser)
          ? String(proj.teaser)
          : missingText("projects[" + index + "].teaser");
        var readText = isRenderableValue(proj.cta)
          ? String(proj.cta)
          : missingText("projects[" + index + "].cta");

        function appendTeaserTextNodes(target) {
          var h3 = document.createElement("h3");
          h3.className = "teaser__hed";
          h3.textContent = titleText;
          target.appendChild(h3);

          var deck = document.createElement("p");
          deck.className = "teaser__deck";
          deck.textContent = deckText;
          target.appendChild(deck);

          var read = document.createElement("span");
          read.className = "teaser__read";
          read.textContent = readText;
          target.appendChild(read);
        }

        function makeThumbImg() {
          var img = document.createElement("img");
          img.className = "teaser__thumb";
          img.src = String(thumbSrc).trim();
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

          if (hasThumb) {
            link.appendChild(makeThumbImg());
            var body = document.createElement("div");
            body.className = "teaser__body";
            appendTeaserTextNodes(body);
            link.appendChild(body);
          } else {
            appendTeaserTextNodes(link);
          }

          article.appendChild(link);
        } else if (hasThumb) {
          var row = document.createElement("div");
          row.className = "teaser__row";
          row.appendChild(makeThumbImg());
          var bodyS = document.createElement("div");
          bodyS.className = "teaser__body";
          appendTeaserTextNodes(bodyS);
          row.appendChild(bodyS);
          article.appendChild(row);
        } else {
          appendTeaserTextNodes(article);
        }

        appendProjectGithubLink(article, proj, bundle);
        container.appendChild(article);
      });
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
