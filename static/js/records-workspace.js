/* ===========================================================
   EPICONSULT e-CLINIC — Patient Records Workspace Engine
   Uses Supabase frontend modules for direct database queries
   Scope: Patient Records Modal in department pages
=========================================================== */

(function() {
  'use strict';

  /* ======================================================================
     1. STATE
  ====================================================================== */
  let allRecords = [];
  let filteredRecords = [];
  let currentPage = 1;
  let pageSize = 25;
  let selectedPatient = null;
  let searchTimeout = null;

  /* ======================================================================
     2. INITIALIZATION
  ====================================================================== */
  function init() {
    console.log('[RecordsWorkspace] Initializing...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupWorkspace);
    } else {
      setupWorkspace();
    }
  }

  function setupWorkspace() {
    // Find the records modal body where content is injected
    const recordsModalBody = document.getElementById('recordsModalBody');
    if (!recordsModalBody) {
      console.log('[RecordsWorkspace] Modal body not found, waiting for injection...');
      return;
    }

    // Setup event listeners
    setupSearchListener();
    setupFetchButton();
    setupPagination();
    setupPageSize();
    
    console.log('[RecordsWorkspace] Setup complete');
  }

  /* ======================================================================
     3. SEARCH FUNCTIONALITY
  ====================================================================== */
  function setupSearchListener() {
    // Use event delegation since elements are dynamically added
    document.addEventListener('input', (e) => {
      if (e.target.id === 'recordsSearchInput') {
        handleSearch(e.target.value);
      }
    });
  }

  function handleSearch(query) {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Debounce search
    searchTimeout = setTimeout(async () => {
      if (!query || query.trim().length < 2) {
        if (allRecords.length > 0) {
          filteredRecords = [...allRecords];
          renderTable();
        }
        hideSuggestions();
        return;
      }

      await performSearch(query.trim());
    }, 300);
  }

  async function performSearch(query) {
    updateConnectionState('Searching...', 'loading');

    try {
      let result;

      // Use Supabase Patients module if available
      if (window.Supabase && window.Supabase.Patients) {
        console.log('[RecordsWorkspace] Using Supabase.Patients.search');
        result = await window.Supabase.Patients.search(query);
      } else {
        // Fallback to backend API
        const response = await fetch(`/records/search?q=${encodeURIComponent(query)}`, {
          credentials: 'include'
        });
        result = await response.json();
      }

      if (result.success && result.results) {
        filteredRecords = result.results;
        renderTable();
        showSuggestions(result.results.slice(0, 5));
        updateConnectionState('Connected', 'connected');
      } else {
        filteredRecords = [];
        renderTable();
        updateConnectionState('No results', 'idle');
      }

    } catch (error) {
      console.error('[RecordsWorkspace] Search error:', error);
      updateConnectionState('Error', 'error');
    }
  }

  /* ======================================================================
     4. FETCH ALL RECORDS
  ====================================================================== */
  function setupFetchButton() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btnFetchRecords')) {
        e.preventDefault();
        fetchAllRecords();
      }
    });
  }

  async function fetchAllRecords() {
    const btn = document.getElementById('btnFetchRecords');
    if (btn) {
      btn.setAttribute('data-state', 'loading');
      btn.disabled = true;
    }

    updateConnectionState('Fetching...', 'loading');

    try {
      let result;

      // Use Supabase Patients module if available
      if (window.Supabase && window.Supabase.Patients) {
        console.log('[RecordsWorkspace] Using Supabase.Patients.fetchAll');
        result = await window.Supabase.Patients.fetchAll(currentPage, pageSize);
      } else {
        // Fallback to backend API
        const response = await fetch('/records/all', { credentials: 'include' });
        result = await response.json();
        if (result.success) {
          result.total = result.records?.length || 0;
        }
      }

      if (result.success) {
        allRecords = result.records || [];
        filteredRecords = [...allRecords];
        renderTable();
        updateConnectionState('Connected', 'connected');
        updateLastSync();
        updateStats();
      } else {
        updateConnectionState('Failed', 'error');
      }

    } catch (error) {
      console.error('[RecordsWorkspace] Fetch error:', error);
      updateConnectionState('Error', 'error');
    } finally {
      if (btn) {
        btn.setAttribute('data-state', 'idle');
        btn.disabled = false;
      }
    }
  }

  /* ======================================================================
     5. TABLE RENDERING
  ====================================================================== */
  function renderTable() {
    const tableBody = document.getElementById('recordsTableBody');
    const table = document.getElementById('recordsTable');
    const emptyState = document.getElementById('recordsEmptyState');

    if (!tableBody) return;

    if (filteredRecords.length === 0) {
      if (table) table.setAttribute('hidden', true);
      if (emptyState) emptyState.removeAttribute('hidden');
      updateRecordCount(0, 0, 0);
      return;
    }

    // Show table, hide empty state
    if (table) table.removeAttribute('hidden');
    if (emptyState) emptyState.setAttribute('hidden', true);

    // Calculate pagination
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, filteredRecords.length);
    const pageRecords = filteredRecords.slice(start, end);

    // Clear and render
    tableBody.innerHTML = '';

    pageRecords.forEach(patient => {
      const row = createTableRow(patient);
      tableBody.appendChild(row);
    });

    updateRecordCount(start + 1, end, filteredRecords.length);
    updatePagination();
  }

  function createTableRow(patient) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-patient-id', patient.patient_id || '');
    tr.setAttribute('data-file-no', patient.file_no || '');

    const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'N/A';
    const hasPhone = patient.phone && patient.phone !== '';
    const hasEmail = patient.email && patient.email !== '';
    const contactStatus = (hasPhone && hasEmail) ? 'Complete' : 
                          (hasPhone || hasEmail) ? 'Partial' : 'Missing';
    const contactClass = contactStatus === 'Complete' ? 'status-good' : 
                         contactStatus === 'Partial' ? 'status-warn' : 'status-bad';

    tr.innerHTML = `
      <td class="col-select"><input type="checkbox" class="row-checkbox" /></td>
      <td data-col="id">${patient.id || ''}</td>
      <td data-col="file_no">${patient.file_no || ''}</td>
      <td data-col="patient_id">${patient.patient_id || ''}</td>
      <td data-col="full_name"><strong>${fullName}</strong></td>
      <td data-col="date_of_birth">${patient.date_of_birth || 'N/A'}</td>
      <td data-col="age">${patient.age || 'N/A'}</td>
      <td data-col="sex">${patient.sex || 'N/A'}</td>
      <td data-col="phone">${patient.phone || 'N/A'}</td>
      <td data-col="email">${patient.email || 'N/A'}</td>
      <td data-col="address">${patient.address || 'N/A'}</td>
      <td data-col="contact_status"><span class="status-badge ${contactClass}">${contactStatus}</span></td>
      <td class="records-row-actions">
        <button type="button" class="btn-row-open" data-role="open-patient" data-file-no="${patient.file_no || ''}">
          <i class="fa-solid fa-up-right-from-square"></i>
        </button>
      </td>
    `;

    // Row click to show in panel
    tr.addEventListener('click', (e) => {
      if (!e.target.closest('.btn-row-open') && !e.target.closest('input[type="checkbox"]')) {
        selectPatient(patient);
        highlightRow(tr);
      }
    });

    // Open button click
    const openBtn = tr.querySelector('.btn-row-open');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectPatient(patient);
        highlightRow(tr);
      });
    }

    return tr;
  }

  function highlightRow(tr) {
    // Remove previous selection
    document.querySelectorAll('#recordsTableBody tr.selected').forEach(row => {
      row.classList.remove('selected');
    });
    tr.classList.add('selected');
  }

  /* ======================================================================
     6. PATIENT PANEL (Right Side)
  ====================================================================== */
  function selectPatient(patient) {
    selectedPatient = patient;
    updatePatientPanel(patient);
  }

  function updatePatientPanel(patient) {
    if (!patient) return;

    const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    const initials = getInitials(fullName);

    // Update panel elements
    setElementText('patientAvatarInitialsFixed', initials);
    setElementText('ppFullName', fullName || 'No patient selected');
    setElementText('ppFileNo', `File: ${patient.file_no || '–'}`);
    setElementText('ppPatientId', `ID: ${patient.patient_id || '–'}`);
    setElementText('ppSex', patient.sex || '–');
    setElementText('ppAge', patient.age || '–');
    setElementText('ppDob', patient.date_of_birth || '–');
    setElementText('ppPhone', patient.phone || '–');
    setElementText('ppEmail', patient.email || '–');
    setElementText('ppAddress', patient.address || '–');

    // Update state badge
    const stateBadge = document.getElementById('patientPanelStateBadge');
    if (stateBadge) {
      stateBadge.innerHTML = '<i class="fa-solid fa-check-circle"></i> Loaded';
      stateBadge.classList.remove('details-badge-muted');
      stateBadge.classList.add('details-badge-success');
    }
  }

  function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /* ======================================================================
     7. SUGGESTIONS DROPDOWN
  ====================================================================== */
  function showSuggestions(results) {
    const container = document.getElementById('recordsSearchSuggestions');
    if (!container || results.length === 0) {
      hideSuggestions();
      return;
    }

    container.innerHTML = '';
    container.removeAttribute('hidden');

    results.forEach(patient => {
      const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suggestion-item';
      btn.innerHTML = `
        <div class="suggestion-main">
          <span class="suggestion-name">${fullName}</span>
          <span class="suggestion-meta">File: ${patient.file_no || 'N/A'} • ID: ${patient.patient_id || 'N/A'}</span>
        </div>
        <span class="suggestion-tag">Select</span>
      `;

      btn.addEventListener('click', () => {
        selectPatient(patient);
        hideSuggestions();
        const searchInput = document.getElementById('recordsSearchInput');
        if (searchInput) searchInput.value = '';
      });

      container.appendChild(btn);
    });
  }

  function hideSuggestions() {
    const container = document.getElementById('recordsSearchSuggestions');
    if (container) {
      container.setAttribute('hidden', true);
      container.innerHTML = '';
    }
  }

  /* ======================================================================
     8. PAGINATION
  ====================================================================== */
  function setupPagination() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      if (target.id === 'recordsFirstPageBtn') {
        currentPage = 1;
        renderTable();
      } else if (target.id === 'recordsPrevPageBtn') {
        if (currentPage > 1) {
          currentPage--;
          renderTable();
        }
      } else if (target.id === 'recordsNextPageBtn') {
        const totalPages = Math.ceil(filteredRecords.length / pageSize);
        if (currentPage < totalPages) {
          currentPage++;
          renderTable();
        }
      } else if (target.id === 'recordsLastPageBtn') {
        currentPage = Math.ceil(filteredRecords.length / pageSize);
        renderTable();
      } else if (target.id === 'recordsGoToPageBtn') {
        const input = document.getElementById('recordsCurrentPageInput');
        if (input) {
          const page = parseInt(input.value);
          const totalPages = Math.ceil(filteredRecords.length / pageSize);
          if (page >= 1 && page <= totalPages) {
            currentPage = page;
            renderTable();
          }
        }
      }
    });
  }

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    
    setElementText('recordsTotalPages', totalPages);
    const pageInput = document.getElementById('recordsCurrentPageInput');
    if (pageInput) pageInput.value = currentPage;

    const paginationBar = document.getElementById('recordsPaginationBar');
    if (paginationBar) {
      if (filteredRecords.length > pageSize) {
        paginationBar.removeAttribute('hidden');
      } else {
        paginationBar.setAttribute('hidden', true);
      }
    }

    // Update button states
    const prevBtn = document.getElementById('recordsPrevPageBtn');
    const firstBtn = document.getElementById('recordsFirstPageBtn');
    const nextBtn = document.getElementById('recordsNextPageBtn');
    const lastBtn = document.getElementById('recordsLastPageBtn');

    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (firstBtn) firstBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (lastBtn) lastBtn.disabled = currentPage >= totalPages;
  }

  /* ======================================================================
     9. PAGE SIZE
  ====================================================================== */
  function setupPageSize() {
    document.addEventListener('change', (e) => {
      if (e.target.id === 'recordsPageSize') {
        pageSize = parseInt(e.target.value) || 25;
        currentPage = 1;
        renderTable();
      }
    });
  }

  /* ======================================================================
     10. UI UPDATES
  ====================================================================== */
  function updateConnectionState(text, state) {
    const stateEl = document.getElementById('records-connection-state');
    const pillEl = document.getElementById('records-connection-pill');
    
    if (stateEl) stateEl.textContent = text;
    if (pillEl) {
      pillEl.className = `status-pill status-${state}`;
    }
  }

  function updateRecordCount(start, end, total) {
    setElementText('records-range-start', start);
    setElementText('records-range-end', end);
    setElementText('records-total-count', total);
    setElementText('records-summary-count', total);
  }

  function updateLastSync() {
    const el = document.getElementById('records-last-sync-value');
    if (el) {
      el.textContent = new Date().toLocaleTimeString();
    }
    const statsUpdated = document.getElementById('recordsStatUpdated');
    if (statsUpdated) {
      statsUpdated.textContent = new Date().toLocaleTimeString();
    }
  }

  function updateStats() {
    const total = filteredRecords.length;
    const male = filteredRecords.filter(p => p.sex?.toLowerCase() === 'male').length;
    const female = filteredRecords.filter(p => p.sex?.toLowerCase() === 'female').length;
    const noContact = filteredRecords.filter(p => !p.phone && !p.email).length;

    setElementText('recordsStatTotal', total);
    setElementText('recordsStatMale', male);
    setElementText('recordsStatFemale', female);
    setElementText('recordsStatNoContact', noContact);
  }

  /* ======================================================================
     11. EXPOSE API
  ====================================================================== */
  window.RecordsWorkspace = {
    init,
    fetchAllRecords,
    searchPatients: performSearch,
    selectPatient,
    getSelectedPatient: () => selectedPatient,
    getAllRecords: () => allRecords,
    getFilteredRecords: () => filteredRecords
  };

  // Auto-initialize
  init();

  console.log('[RecordsWorkspace] Module loaded');

})();


