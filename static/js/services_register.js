/* ==========================================================================
   EPICONSULT e-CLINIC — SERVICES REGISTER ENGINE
   Loads services CSVs (drugs/general/lab) + Live Search + Cart
   Scope: records.html ONLY
========================================================================== */

(() => {
  "use strict";

  /* ==========================
     1) CONFIG (CSV PATHS)
  ========================== */
  const CSV_URLS = {
    drugs: "/static/services/drugs.csv",
    general: "/static/services/general.csv",
    lab: "/static/services/lab.csv",
  };

  /* ==========================
     2) SELECTORS
  ========================== */
  const scopeSelect = document.getElementById("servicesScopeSelect");
  const searchInput = document.getElementById("servicesSearchInput");
  const clearBtn = document.getElementById("servicesClearBtn");

  const metaLeft = document.getElementById("servicesMetaLeft");
  const metaRight = document.getElementById("servicesMetaRight");

  const resultsBody = document.getElementById("servicesResultsBody");

  const cartBtn = document.getElementById("servicesCartBtn");
  const cartCount = document.getElementById("servicesCartCount");
  const cartShell = document.getElementById("servicesCart");

  const cartList = document.getElementById("servicesCartList");
  const cartTotal = document.getElementById("servicesCartTotal");
  const cartClearBtn = document.getElementById("servicesClearCartBtn");

  const priceTypeRadios = Array.from(document.querySelectorAll('input[name="priceType"]'));

  /* ==========================
     3) STATE
  ========================== */
  let DB = {
    drugs: [],
    general: [],
    lab: [],
  };

  let isLoaded = false;
  let activeScope = "all"; // all | drugs | general | lab
  let activeQuery = "";
  let lastResults = [];

  // cart items: { id, scope, name, category, type, amountNumber, amountLabel, key }
  let CART = [];

  const LIMIT_PER_SCOPE = 10;     // for "All services" show up to 10 per dataset
  const LIMIT_SINGLE_SCOPE = 15;  // if user picks a dataset, show more
  const MIN_CHARS = 2;

  /* ==========================
     4) UTIL — CSV PARSER
     Supports quoted fields and commas inside quotes
  ========================== */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        // handle CRLF
        if (ch === "\r" && next === "\n") i++;

        row.push(cur);
        cur = "";

        // skip empty line
        if (row.some(v => (v || "").trim().length > 0)) rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }

    // last field
    if (cur.length || row.length) {
      row.push(cur);
      if (row.some(v => (v || "").trim().length > 0)) rows.push(row);
    }

    if (!rows.length) return [];

    const headers = rows.shift().map(h => (h || "").trim());

    return rows.map(cols => {
      const obj = {};
      headers.forEach((h, idx) => (obj[h] = (cols[idx] ?? "").trim()));
      return obj;
    });
  }

  /* ==========================
     5) UTIL — PRICE PARSER
     Converts "₦5,000.00", "₦ 4,000", "N/A" -> number or null
  ========================== */
  function normalizePrice(raw) {
    if (!raw) return { n: null, label: "N/A" };

    const v = String(raw).trim();
    if (!v || v.toLowerCase() === "n/a" || v === "-" ) return { n: null, label: "N/A" };

    // remove currency, spaces, commas
    const cleaned = v
      .replaceAll("₦", "")
      .replaceAll(",", "")
      .replace(/\s+/g, "")
      .trim();

    const num = Number(cleaned);
    if (Number.isFinite(num)) {
      return { n: num, label: formatNaira(num) };
    }
    return { n: null, label: v }; // fallback show raw
  }

  function formatNaira(num) {
    try {
      // Use Intl formatting
      return "₦" + Number(num).toLocaleString("en-NG", { maximumFractionDigits: 0 });
    } catch {
      return "₦" + String(num);
    }
  }

  function getActivePriceType() {
    const found = priceTypeRadios.find(r => r.checked);
    return found ? found.value : "walkin";
  }

  function setActivePriceType(type) {
    const r = priceTypeRadios.find(x => x.value === type);
    if (r) r.checked = true;
  }

  function safeLower(s) {
    return (s || "").toString().toLowerCase();
  }

  /* ==========================
     6) NORMALIZE DATASETS
     Convert each CSV row into a unified shape
  ========================== */
  function normalizeRow(scope, row) {
    if (scope === "drugs" || scope === "general") {
      const name = row["Name"] || row["name"] || "";
      const category = row["Category"] || row["category"] || "";

      const out = normalizePrice(row["Outsourced (B)"] || row["Outsourced"] || row["outsourced"]);
      const walk = normalizePrice(row["Walk in Patient (C)"] || row["Walk in"] || row["walkin"]);
      const hosp = normalizePrice(row["Hospital Patient (D)"] || row["Hospital"] || row["hospital"]);

      const key = `${scope}__${safeLower(name)}__${safeLower(category)}`;

      return {
        scope,
        key,
        name,
        category,
        prices: {
          outsourced: out,
          walkin: walk,
          hospital: hosp,
        },
        searchText: `${safeLower(name)} ${safeLower(category)}`,
      };
    }

    // lab
    const name = row["test_name"] || row["Test"] || row["test"] || "";
    const category = row["test_category"] || row["Category"] || "";
    const testKey = row["test_key"] || "";

    const out = normalizePrice(row["price_outsourced"] || row["Outsourced"] || "");
    const walk = normalizePrice(row["price_walkin"] || row["Walk in"] || "");
    const hosp = normalizePrice(row["price_hospital"] || row["Hospital"] || "");

    const key = testKey || `lab__${safeLower(name)}__${safeLower(category)}`;

    // Optional: shorter category display (lab categories can be long)
    const categoryShort = String(category || "").trim();

    return {
      scope: "lab",
      key,
      name,
      category: categoryShort,
      prices: {
        outsourced: out,
        walkin: walk,
        hospital: hosp,
      },
      searchText: `${safeLower(name)} ${safeLower(category)} ${safeLower(testKey)}`,
    };
  }

  /* ==========================
     7) LOAD CSVs
  ========================== */
  async function loadAllCSVs() {
    metaLeft.textContent = "Loading services…";
    metaRight.textContent = "";

    const entries = Object.entries(CSV_URLS);

    try {
      const responses = await Promise.all(entries.map(([_, url]) => fetch(url, { cache: "no-store" })));
      const texts = await Promise.all(responses.map(r => r.text()));

      entries.forEach(([scope], idx) => {
        const rawRows = parseCSV(texts[idx]);
        DB[scope] = rawRows.map(r => normalizeRow(scope, r)).filter(x => x.name);
      });

      isLoaded = true;
      metaLeft.textContent = "List of service";
      metaRight.textContent = `Loaded: Lab ${DB.lab.length} · Drugs ${DB.drugs.length} · General ${DB.general.length}`;
    } catch (err) {
      console.error("Failed to load services CSVs:", err);
      metaLeft.textContent = "Failed to load services";
      metaRight.textContent = "Check /static/services/*.csv paths";
      isLoaded = false;
    }
  }

/* ===========================================================================
   SEARCH + RENDER — SMART MATCH (ALIASES + SYNONYMS)
   - Expands query terms (malaria -> mp, thick film, thin film, etc.)
   - Matches against searchText + aliasText (if present)
   - Works across ALL datasets (lab/drugs/general)
=============================================================================*/
function searchServices(query, scope) {
  if (!isLoaded) return [];

  const raw = (query || "").toString();
  const q = safeLower(raw).trim();

  if (q.length < MIN_CHARS && scope === "all") return [];

  const scopes = (scope === "all") ? ["lab", "drugs", "general"] : [scope];
  const limit = (scope === "all") ? LIMIT_PER_SCOPE : LIMIT_SINGLE_SCOPE;

  const results = [];

  // Expand query (synonyms)
  const expandedTerms = (typeof expandQuery === "function")
    ? expandQuery(raw)
    : [q];

  // ✅ smarter matcher
  const matchesTerm = (item, termRaw) => {
    const term = safeLower(termRaw).trim();
    if (!term) return false;

    const hay1 = item.searchText || "";
    const hay2 = item.aliasText || "";
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];

    // ⭐ IMPORTANT: for very short terms like "mp", avoid substring matching
    if (term.length <= 2) {
      // exact alias match OR exact word match
      if (aliases.includes(term)) return true;

      const wordRe = new RegExp(`(^|\\s)${term}(\\s|$)`);
      return wordRe.test(hay1) || wordRe.test(hay2);
    }

    // normal contains for longer terms
    return hay1.includes(term) || hay2.includes(term);
  };

  for (const sc of scopes) {
    const data = DB[sc] || [];

    if (!q) {
      results.push(...data.slice(0, limit));
      continue;
    }

    const filtered = data.filter(item => {
      return expandedTerms.some(t => matchesTerm(item, t));
    });

    results.push(...filtered.slice(0, limit));
  }

  return results;
}



  /* ===========================================================================
        RENDERING LOGIC
  ==============================================================================*/

  function renderPlaceholder(messageTitle, messageText) {
    resultsBody.innerHTML = `
      <tr class="svc-placeholder">
        <td colspan="5">
          <div class="services-empty">
            <i class="fa-solid fa-circle-info"></i>
            <div>
              <strong>${escapeHtml(messageTitle)}</strong>
              <p>${escapeHtml(messageText || "")}</p>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  function renderResults(items, query, scope) {
    lastResults = items;

    if (!isLoaded) {
      renderPlaceholder("Loading services…", "Please wait.");
      return;
    }

    if (!query || query.trim().length < MIN_CHARS) {
      if (scope === "all") {
        renderPlaceholder("Start typing to search", "Results will appear here automatically (no search button).");
      } else {
        renderPlaceholder("Showing sample list", "Type to filter by name or category.");
      }
      metaLeft.textContent = "List of service";
      metaRight.textContent = scope === "all" ? "—" : `Scope: ${scope.toUpperCase()}`;
      return;
    }

    if (!items.length) {
      renderPlaceholder("No results", "Try another keyword or search by category.");
      metaLeft.textContent = "List of service";
      metaRight.textContent = `0 results`;
      return;
    }

    metaLeft.textContent = "List of service";
    metaRight.textContent = `${items.length} result(s)`;

    resultsBody.innerHTML = items.map(item => {
      const w = item.prices.walkin.label;
      const h = item.prices.hospital.label;
      const o = item.prices.outsourced.label;

      const walkDisabled = item.prices.walkin.n == null ? "is-na" : "is-price";
      const hospDisabled = item.prices.hospital.n == null ? "is-na" : "is-price";
      const outsDisabled = item.prices.outsourced.n == null ? "is-na" : "is-price";

      return `
        <tr class="svc-row" data-svc-key="${escapeAttr(item.key)}" data-svc-scope="${escapeAttr(item.scope)}">
          <td class="svc-name-cell" title="Click to add with selected price type">
            <div class="svc-name">
              <strong>${escapeHtml(item.name)}</strong>
              <span class="svc-badge">${escapeHtml(item.scope.toUpperCase())}</span>
            </div>
          </td>
          <td class="svc-cat-cell" title="${escapeAttr(item.category)}">${escapeHtml(item.category || "—")}</td>

          <td class="price-col ${walkDisabled}" data-price-type="walkin" title="Click to add (Walk-in)">
            ${escapeHtml(w)}
          </td>
          <td class="price-col ${hospDisabled}" data-price-type="hospital" title="Click to add (Hospital)">
            ${escapeHtml(h)}
          </td>
          <td class="price-col ${outsDisabled}" data-price-type="outsourced" title="Click to add (Outsourced)">
            ${escapeHtml(o)}
          </td>
        </tr>
      `;
    }).join("");
  }

  /* ==========================
     9) CART LOGIC
  ========================== */
  function addToCart(item, type) {
    const price = item.prices[type];
    if (!price || price.n == null) {
      // do not add N/A items
      toast(`No ${type} price for this service.`);
      return;
    }

    // prevent duplicates of same service + same type
    const exists = CART.some(x => x.key === item.key && x.type === type);
    if (exists) {
      toast("Already added to cart.");
      return;
    }

    CART.push({
      id: cryptoId(),
      scope: item.scope,
      key: item.key,
      name: item.name,
      category: item.category,
      type,
      amountNumber: price.n,
      amountLabel: price.label,
    });

    syncCartUI();
  }

  function removeFromCart(id) {
    CART = CART.filter(x => x.id !== id);
    syncCartUI();
  }

  function clearCart() {
    CART = [];
    syncCartUI();
  }

  function syncCartUI() {
    const count = CART.length;
    cartCount.textContent = String(count);

    // render cart table body
    if (!count) {
      cartList.innerHTML = `
        <tr class="svc-placeholder">
          <td colspan="4" class="selected-empty">No service selected yet.</td>
        </tr>
      `;
      cartTotal.textContent = "₦0";
      return;
    }

    cartList.innerHTML = CART.map(item => {
      return `
        <tr class="cart-row" data-cart-id="${escapeAttr(item.id)}">
          <td title="${escapeAttr(item.category || "")}">
            <strong>${escapeHtml(item.name)}</strong>
            <div style="font-size:.72rem; color: var(--r-text-soft); margin-top:2px;">
              ${escapeHtml(item.scope.toUpperCase())}${item.category ? " · " + escapeHtml(item.category) : ""}
            </div>
          </td>
          <td class="amount-col" style="text-align:right; font-weight:950; color: var(--r-accent);">
            ${escapeHtml(item.amountLabel)}
          </td>
          <td class="type-col">
            <span style="font-weight:900; color: var(--r-text-muted); text-transform:capitalize;">
              ${escapeHtml(item.type)}
            </span>
          </td>
          <td class="action-col">
            <button class="mini-action-btn danger cart-remove-btn" type="button" title="Remove">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // total
    const total = CART.reduce((sum, x) => sum + (x.amountNumber || 0), 0);
    cartTotal.textContent = formatNaira(total);
  }

  /* ==========================
     10) EVENTS
  ========================== */
const debouncedSearch = debounce(() => {
  activeQuery = searchInput.value || "";
  const q = activeQuery.trim();

  // ✅ AUTO CONCURRENT ALWAYS:
  // - If user is typing (>= MIN_CHARS): ALWAYS search across ALL 3 CSVs
  // - If query is empty / too short: dropdown controls the sample list (fail-safe)
  activeScope = (q.length >= MIN_CHARS) ? "all" : (scopeSelect.value || "all");

  const items = searchServices(activeQuery, activeScope);
  renderResults(items, activeQuery, activeScope);
}, 120);

scopeSelect.addEventListener("change", () => {
  // ✅ Dropdown should NOT restrict active typing search
  const q = (searchInput.value || "").trim();
  if (q.length >= MIN_CHARS) return;

  debouncedSearch();
});

searchInput.addEventListener("input", () => {
  debouncedSearch();
});

clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  debouncedSearch();
  searchInput.focus();
});

  // click handler for results table (event delegation)
  resultsBody.addEventListener("click", (e) => {
    const row = e.target.closest(".svc-row");
    if (!row) return;

    const key = row.dataset.svcKey;
    const scope = row.dataset.svcScope;

    const item = (DB[scope] || []).find(x => x.key === key);
    if (!item) return;

    // if clicking price cell, use that type
    const priceCell = e.target.closest("[data-price-type]");
    if (priceCell) {
      const type = priceCell.dataset.priceType;
      if (priceCell.classList.contains("is-na")) {
        toast("This price is N/A.");
        return;
      }
      setActivePriceType(type); // visual sync
      addToCart(item, type);
      return;
    }

    // if clicking name/category area, use active selected price type
    const type = getActivePriceType();
    addToCart(item, type);
  });

  // cart remove (event delegation)
  cartList.addEventListener("click", (e) => {
    const btn = e.target.closest(".cart-remove-btn");
    if (!btn) return;

    const row = e.target.closest(".cart-row");
    if (!row) return;

    removeFromCart(row.dataset.cartId);
  });

  cartClearBtn.addEventListener("click", () => {
    clearCart();
    toast("Cart cleared.");
  });

  // Optional: toggle cart visibility (you already display it by default, but this helps)
  cartBtn.addEventListener("click", () => {
    cartShell.classList.toggle("hidden");
  });

  // If user changes price type radio and wants quick “re-evaluate”, we just keep it as future selection.
  priceTypeRadios.forEach(r => r.addEventListener("change", () => {
    // no forced rerender needed, but you can add UI hints here later
  }));

/* ==========================
   11) INIT
========================== */
renderPlaceholder("Loading services…", "Please wait.");
loadAllCSVs().then(() => {
  /* ======================================================================
     SEARCH INDEX BUILD — SMART ALIASES (SAFE)
     - If buildSearchIndex() exists (from alias engine), build it
     - Otherwise continue normally (no crash)
  ====================================================================== */
  try {
    if (typeof buildSearchIndex === "function") buildSearchIndex(DB);
  } catch (e) {
    console.warn("Search index build skipped:", e);
  }

  // initial view: if scope != all show sample list
  activeScope = scopeSelect.value || "all";
  activeQuery = searchInput.value || "";

  const items = searchServices(activeQuery, activeScope);
  renderResults(items, activeQuery, activeScope);
  syncCartUI();
});

  /* ==========================
     12) HELPERS
  ========================== */
  function debounce(fn, delay) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replaceAll("`", "&#096;");
  }

  function cryptoId() {
    // small unique id without external libs
    return "id_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function toast(msg) {
    // minimal toast (non-intrusive). You can upgrade later.
    try {
      metaRight.textContent = msg;
      setTimeout(() => {
        // don't wipe if it changed
        if (metaRight.textContent === msg) metaRight.textContent = "";
      }, 1800);
    } catch { /* ignore */ }
  }

})();















/* ==========================================================================
   SEARCH ALIASES ENGINE — SMART MATCH (LAB/DRUGS/GENERAL)
   - Auto builds aliases for every item (acronyms, bracket names, joined words)
   - Expands user query with synonyms (e.g. malaria -> mp, thick film, thin film)
   - Works across all datasets without needing exact wording
========================================================================== */

/* ==========================
   A) GLOBAL SYNONYM MAP
   Add more as you like (safe + optional)
========================== */
const GLOBAL_SYNONYMS = {
  malaria: ["mp", "malaria parasite", "malarial parasite", "parasite", "thick film", "thin film"],
  typhoid: ["widals", "widal", "widal test"],
  pregnancy: ["hcg", "beta hcg", "pt", "preg test"],
  diabetes: ["fbs", "rbs", "hb a1c", "hba1c", "blood sugar"],
  hiv: ["retroviral", "screening", "elisa"],
  hepatitis: ["hbsag", "hbv", "hcv"],
  urine: ["urinalysis", "mcu", "mcs", "m/c/s"],
};

/* ==========================
   B) STRING NORMALIZER
========================== */
function normText(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFKD")                 // safer for odd chars
    .replace(/[\u0300-\u036f]/g, "")   // remove diacritics
    .replace(/[_]/g, " ")
    .replace(/[(){}\[\]]/g, " ")
    .replace(/[\/\\\-]+/g, " ")
    .replace(/[^\w\s]/g, " ")         // drop punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/* ==========================
   C) ACRONYM BUILDER
   "Full Blood Count" -> "fbc"
========================== */
function buildAcronym(text) {
  const t = normText(text);
  const words = t.split(" ").filter(Boolean);
  if (words.length < 2) return "";
  const ac = words.map(w => w[0]).join("");
  return ac.length >= 2 ? ac : "";
}

/* ==========================
   D) SPLIT BRACKET NAMES
   "Widal (Typhoid)" -> ["widal typhoid", "widal", "typhoid"]
========================== */
function extractBracketParts(original) {
  const out = [];
  const s = (original || "").toString();

  // capture (...) content
  const matches = s.match(/\(([^)]+)\)/g);
  if (matches) {
    matches.forEach(m => {
      const inside = m.replace(/[()]/g, "").trim();
      if (inside) out.push(inside);
    });
  }

  // also version without brackets
  const noBrackets = s.replace(/\(([^)]+)\)/g, " ").trim();
  if (noBrackets) out.push(noBrackets);

  return out;
}

/* ==========================
   E) BUILD ITEM ALIASES
   Generates multiple searchable forms for each item
========================== */
function buildItemAliases(item) {
  const aliases = new Set();

  const name = item?.name || "";
  const cat = item?.category || "";
  const key = item?.key || "";

  // base texts
  const baseTexts = [
    name,
    cat,
    key,
    ...extractBracketParts(name),
  ].filter(Boolean);

  baseTexts.forEach(t => {
    const n = normText(t);
    if (!n) return;

    aliases.add(n);                    // normal
    aliases.add(n.replace(/\s+/g, "")); // joined: "fullbloodcount"
    const ac = buildAcronym(n);        // acronym: "fbc"
    if (ac) aliases.add(ac);
  });

  // lab keys often contain short forms -> keep raw pieces too
  const keyNorm = normText(key);
  if (keyNorm) {
    aliases.add(keyNorm);
    aliases.add(keyNorm.replace(/\s+/g, ""));
  }

  return Array.from(aliases);
}

/* ==========================
   F) EXPAND USER QUERY
   Adds synonyms + smart variants
========================== */
function expandQuery(rawQuery) {
  const q0 = normText(rawQuery);
  if (!q0) return [];

  const terms = new Set();
  terms.add(q0);
  terms.add(q0.replace(/\s+/g, "")); // joined version

  // add acronym of user query too (if they typed full name)
  const ac = buildAcronym(q0);
  if (ac) terms.add(ac);

  // expand by words (so "malaria test" triggers malaria synonyms too)
  const words = q0.split(" ").filter(Boolean);

  words.forEach(w => {
    terms.add(w);
    const syns = GLOBAL_SYNONYMS[w];
    if (syns && syns.length) {
      syns.forEach(s => {
        const ns = normText(s);
        if (ns) {
          terms.add(ns);
          terms.add(ns.replace(/\s+/g, ""));
          const asc = buildAcronym(ns);
          if (asc) terms.add(asc);
        }
      });
    }
  });

  // if entire query matches a synonym key
  if (GLOBAL_SYNONYMS[q0]) {
    GLOBAL_SYNONYMS[q0].forEach(s => {
      const ns = normText(s);
      if (ns) {
        terms.add(ns);
        terms.add(ns.replace(/\s+/g, ""));
        const asc = buildAcronym(ns);
        if (asc) terms.add(asc);
      }
    });
  }

  return Array.from(terms).filter(Boolean);
}

/* ==========================
   G) BUILD SEARCH INDEX (RUN AFTER LOAD)
========================== */
function buildSearchIndex() {
  ["lab", "drugs", "general"].forEach(scope => {
    (DB[scope] || []).forEach(item => {
      const aliases = buildItemAliases(item);

      // store alias text once (fast search)
      item.aliases = aliases;
      item.aliasText = aliases.join(" ");

      // keep original searchText too (already built in normalizeRow)
      item.searchText = normText(item.searchText || "");
    });
  });
}
