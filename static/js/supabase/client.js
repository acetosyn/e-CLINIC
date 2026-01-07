/* ===========================================================
   EPICONSULT e-CLINIC — Supabase Client Module
   Core initialization and shared client instance
   
   Usage:
     import { getSupabaseClient, isReady } from './supabase/client.js';
     const client = await getSupabaseClient();
=========================================================== */

// Singleton client instance
let _supabaseClient = null;
let _isInitialized = false;
let _initPromise = null;

// Configuration
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

/**
 * Load Supabase library from CDN if not already loaded
 * @returns {Promise<void>}
 */
function loadSupabaseLibrary() {
  return new Promise((resolve, reject) => {
    if (typeof supabase !== 'undefined') {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = SUPABASE_CDN;
    script.onload = () => {
      if (typeof supabase !== 'undefined') {
        console.log('[Supabase] Library loaded from CDN');
        resolve();
      } else {
        reject(new Error('Supabase library loaded but global not available'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Supabase library'));
    document.head.appendChild(script);
  });
}

/**
 * Get Supabase credentials from the page
 * Credentials are injected via Flask template
 * @returns {{ url: string, anonKey: string } | null}
 */
function getCredentials() {
  const urlEl = document.getElementById('supabase-url');
  const keyEl = document.getElementById('supabase-anon-key');

  const url = urlEl?.getAttribute('data-url')?.trim();
  const anonKey = keyEl?.getAttribute('data-key')?.trim();

  if (!url || !anonKey || url === '' || anonKey === '') {
    console.error('[Supabase] Credentials not found in page');
    return null;
  }

  return { url, anonKey };
}

/**
 * Initialize the Supabase client
 * @returns {Promise<SupabaseClient | null>}
 */
async function initializeClient() {
  if (_isInitialized && _supabaseClient) {
    return _supabaseClient;
  }

  try {
    // Load library if needed
    await loadSupabaseLibrary();

    // Get credentials
    const creds = getCredentials();
    if (!creds) {
      console.error('[Supabase] Cannot initialize without credentials');
      return null;
    }

    // Create client
    _supabaseClient = supabase.createClient(creds.url, creds.anonKey);
    _isInitialized = true;

    console.log('[Supabase] Client initialized successfully');
    return _supabaseClient;

  } catch (error) {
    console.error('[Supabase] Initialization failed:', error);
    return null;
  }
}

/**
 * Get the Supabase client instance
 * Initializes on first call, returns cached instance after
 * @returns {Promise<SupabaseClient | null>}
 */
export async function getSupabaseClient() {
  if (_supabaseClient) {
    return _supabaseClient;
  }

  // Prevent multiple simultaneous initializations
  if (!_initPromise) {
    _initPromise = initializeClient();
  }

  return _initPromise;
}

/**
 * Get the client synchronously (returns null if not initialized)
 * @returns {SupabaseClient | null}
 */
export function getClientSync() {
  return _supabaseClient;
}

/**
 * Check if the client is ready
 * @returns {boolean}
 */
export function isReady() {
  return _isInitialized && _supabaseClient !== null;
}

/**
 * Reset the client (useful for testing or re-initialization)
 */
export function resetClient() {
  _supabaseClient = null;
  _isInitialized = false;
  _initPromise = null;
}

// Auto-initialize when DOM is ready (optional, can be called manually)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    getSupabaseClient().catch(console.error);
  });
} else {
  getSupabaseClient().catch(console.error);
}

// Export for global access (non-module scripts)
window.SupabaseClient = {
  getClient: getSupabaseClient,
  getClientSync,
  isReady,
  resetClient
};


