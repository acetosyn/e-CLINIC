/* ==========================================================================
   EPICONSULT e-CLINIC — PATIENT RECORDS ENGINE (2025)
   Clean Client-Side Table + Live Search + Preview Sync
   Scope: records.html ONLY
========================================================================== */

(() => {
  "use strict";

  /* ======================================================================
     1. CORE SELECTORS
  ====================================================================== */
  const tableBody = document.getElementById("recordsTableBody");

  const searchInput = document.getElementById("globalSearchInput");
  const clearSearchBtn = document.querySelector(".search-clear-btn");

  const pageSizeSelect = document.getElementById("pageSizeSelect");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");

  const currentPageEl = document.getElementById("currentPage");
  const totalPagesEl = document.getElementById("totalPages");

  const totalRecordsCount = document.getElementById("totalRecordsCount");
  const renderedRecordsCount = document.getElementById("renderedRecordsCount");

  const startRecordEl = document.getElementById("startRecord");
  const endRecordEl = document.getElementById("endRecord");
  const totalRecordsEl = document.getElementById("totalRecords");

  const previewEmpty = document.getElementById("previewEmpty");
  const previewContent = document.getElementById("previewContent");

  /* Preview fields */
  const pv = {
    fullName: document.getElementById("preview-full-name"),
    patientId: document.getElementById("preview-patient-id"),
    fileNo: document.getElementById("preview-file-no"),
    sex: document.getElementById("preview-sex"),
    age: document.getElementById("preview-age"),
    email: document.getElementById("preview-email"),
    phone: document.getElementById("preview-phone"),
  };

  /* ======================================================================
     2. STATE
  =======================================================================*/
  let ALL_RECORDS = [];
  let FILTERED_RECORDS = [];

  let currentPage = 1;
  let pageSize = parseInt(pageSizeSelect.value, 10) || 25;

  let selectedRowId = null;

  /* ======================================================================
     3. DATA SOURCE (CSV → JSON)
     Adjust path if needed later
  ====================================================================== */
  const DATA_URL = "/static/data/patients.csv";

  /* ======================================================================
     4. CSV PARSER (FAST & SAFE)
  ====================================================================== */
  function parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines.shift().split(",").map(h => h.trim());

    return lines.map(line => {
      const values = line.split(",").map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => (obj[h] = values[i] || ""));
      return obj;
    });
  }

  /* ======================================================================
     5. LOAD DATA
  ====================================================================== */
  async function loadRecords() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      const text = await res.text();
      ALL_RECORDS = parseCSV(text);

      FILTERED_RECORDS = [...ALL_RECORDS];

      totalRecordsCount.textContent = ALL_RECORDS.length;
      renderTable();
      updateFooter();
    } catch (err) {
      console.error("Failed to load records:", err);
    }
  }

  /* ======================================================================
     6. RENDER TABLE
  ====================================================================== */
  function renderTable() {
    tableBody.innerHTML = "";

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageRecords = FILTERED_RECORDS.slice(start, end);

    pageRecords.forEach(rec => {
      const tr = document.createElement("tr");
      tr.className = "records-row";
      tr.dataset.id = rec.file_no || rec.patient_id;

      tr.innerHTML = `
        <td><input type="checkbox"></td>
        <td>${rec.file_no || "-"}</td>
        <td>${rec.patient_id || "-"}</td>
        <td>${rec.first_name || "-"}</td>
        <td>${rec.last_name || "-"}</td>
        <td>${rec.sex || "-"}</td>
        <td>${rec.age || "-"}</td>
        <td>${rec.email || "-"}</td>
        <td>${rec.phone || "-"}</td>
        <td>${rec.account_status || "-"}</td>
        <td>${rec.category || "-"}</td>
        <td>
          <button class="btn-row-open">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </td>
      `;

      tr.addEventListener("click", () => selectRecord(rec, tr));
      tableBody.appendChild(tr);
    });

    renderedRecordsCount.textContent = pageRecords.length;
    updatePagination();
    updateFooter();
  }

  /* ======================================================================
     7. PREVIEW PANEL SYNC
  ====================================================================== */
  function selectRecord(rec, rowEl) {
    document
      .querySelectorAll(".records-row")
      .forEach(r => r.classList.remove("row-selected"));

    rowEl.classList.add("row-selected");
    selectedRowId = rowEl.dataset.id;

    previewEmpty.classList.add("hidden");
    previewContent.classList.remove("hidden");

    pv.fullName.textContent =
      `${rec.first_name || ""} ${rec.last_name || ""}`.trim() || "—";
    pv.patientId.textContent = rec.patient_id || "—";
    pv.fileNo.textContent = rec.file_no || "—";
    pv.sex.textContent = rec.sex || "—";
    pv.age.textContent = rec.age || "—";
    pv.email.textContent = rec.email || "—";
    pv.phone.textContent = rec.phone || "—";
  }

  /* ======================================================================
     8. LIVE SEARCH (INSTANT)
  ====================================================================== */
  function applySearch(query) {
    const q = query.toLowerCase();

    FILTERED_RECORDS = ALL_RECORDS.filter(r => {
      return (
        (r.first_name || "").toLowerCase().includes(q) ||
        (r.last_name || "").toLowerCase().includes(q) ||
        (r.patient_id || "").toLowerCase().includes(q) ||
        (r.file_no || "").toLowerCase().includes(q)
      );
    });

    currentPage = 1;
    renderTable();
  }

  searchInput.addEventListener("input", e => {
    const value = e.target.value.trim();
    if (value.length < 1) {
      FILTERED_RECORDS = [...ALL_RECORDS];
      renderTable();
      return;
    }
    applySearch(value);
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    FILTERED_RECORDS = [...ALL_RECORDS];
    renderTable();
  });

  /* ======================================================================
     9. PAGINATION
  ====================================================================== */
  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(FILTERED_RECORDS.length / pageSize));
    currentPageEl.textContent = currentPage;
    totalPagesEl.textContent = totalPages;

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  prevPageBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  nextPageBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(FILTERED_RECORDS.length / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  pageSizeSelect.addEventListener("change", () => {
    pageSize = parseInt(pageSizeSelect.value, 10) || 25;
    currentPage = 1;
    renderTable();
  });

  /* ======================================================================
     10. FOOTER COUNTS
  ====================================================================== */
  function updateFooter() {
    const total = FILTERED_RECORDS.length;
    const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, total);

    startRecordEl.textContent = start;
    endRecordEl.textContent = end;
    totalRecordsEl.textContent = total;
  }

  /* ======================================================================
     11. INIT
  ====================================================================== */
  loadRecords();

})();

/* ======================================================================
   PREVIEW FLOATING STATE
====================================================================== */
const previewPanel = document.getElementById("recordsPreview");
const previewFab = document.getElementById("previewFab");
const previewMinBtn = document.getElementById("previewMinimizeBtn");

function openPreview() {
  previewPanel.classList.remove("is-collapsed");
}

function closePreview() {
  previewPanel.classList.add("is-collapsed");
}

previewFab.addEventListener("click", openPreview);
previewMinBtn.addEventListener("click", closePreview);





/* ======================================================================
   PREVIEW COPY HANDLERS — SAFE & ENTERPRISE
====================================================================== */

document.addEventListener("click", (event) => {
  const btn = event.target.closest(".copy-btn");
  if (!btn) return;

  const targetId = btn.dataset.copyTarget;
  if (!targetId) return;

  const valueEl = document.getElementById(targetId);
  if (!valueEl) return;

  const text = valueEl.textContent.trim();
  if (!text || text === "—") return;

  // Copy to clipboard
  navigator.clipboard.writeText(text).then(() => {
    // Visual feedback
    btn.classList.add("copied");
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';

    // Restore icon after delay
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = '<i class="fa-regular fa-clone"></i>';
    }, 1200);
  }).catch(err => {
    console.error("Copy failed:", err);
  });
});
