// =========================
// SUPABASE CLIENT
// =========================
let supabaseClient = null;

// Initialize Supabase client
function initSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  
  // Get credentials from page
  const supabaseUrlEl = document.getElementById('supabase-url');
  const supabaseKeyEl = document.getElementById('supabase-anon-key');
  
  const supabaseUrl = supabaseUrlEl?.getAttribute('data-url');
  const supabaseAnonKey = supabaseKeyEl?.getAttribute('data-key');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Records] Supabase credentials not found');
    return null;
  }
  
  // Check if Supabase library is loaded
  if (typeof supabase === 'undefined') {
    console.warn('[Records] Supabase library not loaded yet, will initialize when available');
    // Wait for it to load (notifications.js loads it)
    const checkInterval = setInterval(() => {
      if (typeof supabase !== 'undefined') {
        clearInterval(checkInterval);
        supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
        console.log('[Records] Supabase client initialized');
      }
    }, 100);
    return null;
  }
  
  supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
  console.log('[Records] Supabase client initialized');
  return supabaseClient;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initSupabaseClient();
});

// Note: Use initSupabaseClient() directly instead of the supabase alias
// This ensures proper initialization and error handling

// Global selected patient folder number
let selectedFolderNo = null;

// =========================
// OPEN RECORD MODAL + LOAD PATIENT
// =========================
window.openRecordModal = async function (folderNo) {
    selectedFolderNo = folderNo;

    document.getElementById("modalRecord").setAttribute("aria-hidden", "false");

    // Ensure Supabase client is initialized
    const client = initSupabaseClient();
    if (!client) {
        // Wait a bit and try again (in case library is still loading)
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryClient = initSupabaseClient();
        if (!retryClient) {
            alert("Unable to connect to database. Please refresh the page.");
            return;
        }
        const { data, error } = await retryClient
            .from("patients")
            .select("*")
            .eq("folder_no", folderNo)
            .single();
        if (error || !data) {
            alert("Unable to load record.");
            return;
        }
        fillPatientPreview(data);
        return;
    }

    // Fetch patient from supabase
    const { data, error } = await client
        .from("patients")
        .select("*")
        .eq("folder_no", folderNo)
        .single();

    if (error || !data) {
        alert("Unable to load record.");
        return;
    }

    fillPatientPreview(data);
};

// =========================
// FILL PREVIEW TABLE
// =========================
function fillPatientPreview(p) {
  
    document.getElementById("pvTitle").textContent = p.title || "";
    document.getElementById("pvName").textContent = p.name || "";
    document.getElementById("pvSex").textContent = p.sex || "";
    document.getElementById("pvFolder").textContent = p.folder_no || "";
    document.getElementById("pvStatus").textContent = p.account_status || "";
    document.getElementById("pvDob").textContent = p.date_of_birth || "";
    document.getElementById("pvAge").textContent = p.age || "";
    document.getElementById("pvPhone").textContent = p.mobile_no || "";
    document.getElementById("pvRegDate").textContent = p.registration_date || "";
    document.getElementById("pvEmail").textContent = p.email || "";
    document.getElementById("pvDataEntry").textContent = p.data_entry || "";

    // Reveal preview box
    document.getElementById("patientPreview").classList.remove("hidden");
}

// =========================
// SAVE RECORD
// =========================
document.querySelector("[data-action='save-record']").addEventListener("click", async () => {

    if (!selectedFolderNo) {
        alert("No patient selected.");
        return;
    }

    const recordType = document.getElementById("recordType").value;
    const description = document.getElementById("recordDescription").value;
    const dataEntry = document.getElementById("recordDataEntry").value;

    const services = collectServices();

    const payload = {
        folder_no: selectedFolderNo,
        record_type: recordType,
        description: description,
        services: services,
        data_entry: dataEntry,
        created_at: new Date().toISOString()
    };

    // Ensure Supabase client is initialized
    const client = initSupabaseClient();
    if (!client) {
        alert("Unable to connect to database. Please refresh the page.");
        return;
    }

    const { error } = await client.from("patient_records").insert([payload]);

    if (error) {
        console.error(error);
        alert("Unable to save record.");
        return;
    }

    alert("Record saved!");
});

// =========================
// COLLECT SERVICE ITEMS
// =========================
function collectServices() {
    const container = document.getElementById("serviceItemsContainer");
    const items = container.querySelectorAll(".service-item");

    let list = [];

    items.forEach(item => {
        const type = item.querySelector(".service-type").value;
        const qty = parseInt(item.querySelector(".service-qty").value);

        if (type && qty > 0) {
            list.push({ type, qty });
        }
    });

    return list;
}
