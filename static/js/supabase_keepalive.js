/* ===========================================================
   Supabase Keep-Alive Helper
   Prevents database cold starts by periodically pinging Supabase
   =========================================================== */

let keepAliveInterval = null;
let supabaseKeepAliveClient = null;
const KEEP_ALIVE_INTERVAL = 1 * 60 * 1000; // 1 minute (60000 ms) - aggressive to prevent cold starts
const PING_ENDPOINT = '/api/health'; // Lightweight health check endpoint

/**
 * Initialize Supabase keep-alive mechanism
 * Calls a lightweight endpoint periodically to keep connection warm
 */
function initSupabaseKeepAlive() {
  // Only run if Supabase client is available
  if (typeof supabase === 'undefined' && !supabaseKeepAliveClient) {
    console.log('[KeepAlive] Waiting for Supabase client to initialize...');
    // Wait for Supabase to load
    const checkInterval = setInterval(() => {
      if (typeof supabase !== 'undefined') {
        clearInterval(checkInterval);
        setupKeepAlive();
      }
    }, 1000);
    
    // Give up after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (typeof supabase === 'undefined') {
        console.warn('[KeepAlive] Supabase not loaded, using API-only keep-alive');
        setupAPIKeepAlive();
      }
    }, 30000);
    return;
  }
  
  setupKeepAlive();
}

/**
 * Setup keep-alive using Supabase client
 */
function setupKeepAlive() {
  try {
    const supabaseUrlEl = document.getElementById('supabase-url');
    const supabaseKeyEl = document.getElementById('supabase-anon-key');
    
    const supabaseUrl = supabaseUrlEl?.getAttribute('data-url');
    const supabaseAnonKey = supabaseKeyEl?.getAttribute('data-key');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[KeepAlive] Supabase credentials not found, using API-only mode');
      setupAPIKeepAlive();
      return;
    }
    
    // Initialize Supabase client for keep-alive
    if (typeof supabase !== 'undefined') {
      supabaseKeepAliveClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
    }
    
    // Start keep-alive pings
    startKeepAlive();
    console.log('[KeepAlive] Supabase keep-alive initialized (every 1 minute)');
  } catch (error) {
    console.error('[KeepAlive] Error setting up keep-alive:', error);
    // Fallback to API keep-alive
    setupAPIKeepAlive();
  }
}

/**
 * Setup keep-alive using API endpoint (fallback)
 */
function setupAPIKeepAlive() {
  startKeepAlive();
  console.log('[KeepAlive] API keep-alive initialized (every 1 minute)');
}

/**
 * Start the keep-alive interval
 */
function startKeepAlive() {
  // Clear any existing interval
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  // Ping immediately
  pingDatabase();
  
  // Then ping every 1 minute to aggressively prevent cold starts
  keepAliveInterval = setInterval(() => {
    pingDatabase();
  }, KEEP_ALIVE_INTERVAL);
  
  console.log(`[KeepAlive] Keep-alive started (interval: ${KEEP_ALIVE_INTERVAL / 1000}s)`);
}

/**
 * Ping the database to keep connection warm
 * Specifically targets users table to prevent cold starts
 */
async function pingDatabase() {
  try {
    // Try Supabase first if available
    if (supabaseKeepAliveClient) {
      // Multiple queries to keep users table active
      // Query 1: Simple count query (very lightweight)
      const countQuery = supabaseKeepAliveClient
        .from('users')
        .select('id', { count: 'exact', head: true })
        .catch(() => ({ count: null, error: null }));
      
      // Query 2: Select one user (keeps table warm)
      const selectQuery = supabaseKeepAliveClient
        .from('users')
        .select('id, username, role')
        .limit(1)
        .catch(() => ({ data: null, error: null }));
      
      // Execute both queries in parallel
      const [countResult, selectResult] = await Promise.all([
        countQuery,
        selectQuery
      ]);
      
      // Check if either query succeeded
      const countSuccess = countResult && !countResult.error;
      const selectSuccess = selectResult && !selectResult.error && selectResult.data;
      
      if (countSuccess || selectSuccess) {
        console.log('[KeepAlive] Supabase users table ping successful');
        return;
      } else {
        console.warn('[KeepAlive] Supabase queries failed, trying API fallback');
      }
    }
    
    // Fallback: Ping our own API health endpoint
    const response = await fetch(PING_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      // Don't throw on error - just log
    }).catch(() => null);
    
    if (response && response.ok) {
      console.log('[KeepAlive] API ping successful');
    } else {
      console.warn('[KeepAlive] All ping methods failed, will retry next interval');
    }
  } catch (error) {
    // Silent fail - don't spam console
    console.debug('[KeepAlive] Ping error (silent):', error.message);
  }
}

/**
 * Stop keep-alive (when user logs out)
 */
function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('[KeepAlive] Keep-alive stopped');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Only run if user is authenticated (check for authenticated indicators)
  const isAuthenticated = document.querySelector('.header-actions') || 
                         document.querySelector('[data-user]') ||
                         document.cookie.includes('session');
  
  if (isAuthenticated) {
    // Wait a bit for other scripts to initialize
    setTimeout(() => {
      initSupabaseKeepAlive();
    }, 2000);
  }
});

// Stop keep-alive when page unloads or user logs out
window.addEventListener('beforeunload', () => {
  stopKeepAlive();
});

// Expose stop function globally for logout handlers
window.stopSupabaseKeepAlive = stopKeepAlive;

