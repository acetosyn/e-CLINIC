/* ===========================================================
   EPICONSULT e-CLINIC — Supabase Auth Module
   Handles user authentication (login/logout)
   
   NOTE: This uses custom auth against the 'users' table,
   not Supabase Auth (since there's no signup flow).
   
   Usage:
     import { login, logout, getCurrentUser } from './supabase/auth.js';
     const result = await login(username, password, role);
=========================================================== */

import { getSupabaseClient } from './client.js';

/**
 * Verify user credentials against the users table
 * @param {string} username - User's username
 * @param {string} password - User's password (will be verified with hash)
 * @param {string} role - Selected role
 * @returns {Promise<{success: boolean, user?: object, message?: string}>}
 */
export async function login(username, password, role) {
  try {
    if (!username || !password || !role) {
      return { success: false, message: 'All fields are required.' };
    }

    const client = await getSupabaseClient();
    if (!client) {
      // Fallback to backend API
      return await loginViaBackend(username, password, role);
    }

    // Query the users table
    const { data: user, error } = await client
      .from('users')
      .select('id, username, role, is_active, password_hash')
      .ilike('username', username)
      .single();

    if (error || !user) {
      console.warn('[Auth] User not found:', username);
      return { success: false, message: 'Invalid username or password.' };
    }

    if (!user.is_active) {
      return { success: false, message: 'Account is inactive. Contact administrator.' };
    }

    // Password verification must be done on backend (bcrypt/werkzeug)
    // So we call the backend for the actual login
    return await loginViaBackend(username, password, role);

  } catch (error) {
    console.error('[Auth] Login error:', error);
    return { success: false, message: 'An error occurred during login.' };
  }
}

/**
 * Login via backend API (handles password hashing)
 * @param {string} username
 * @param {string} password
 * @param {string} role
 * @returns {Promise<{success: boolean, user?: object, message?: string}>}
 */
async function loginViaBackend(username, password, role) {
  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
      credentials: 'include'
    });

    const result = await response.json();
    
    if (result.success) {
      // Store user info in session storage
      sessionStorage.setItem('currentUser', JSON.stringify(result.user));
      console.log('[Auth] Login successful:', result.user.username);
    }

    return result;

  } catch (error) {
    console.error('[Auth] Backend login error:', error);
    return { success: false, message: 'Server error. Please try again.' };
  }
}

/**
 * Logout the current user
 * @returns {Promise<{success: boolean}>}
 */
export async function logout() {
  try {
    // Clear session storage
    sessionStorage.removeItem('currentUser');
    
    // Call backend logout
    window.location.href = '/logout';
    return { success: true };

  } catch (error) {
    console.error('[Auth] Logout error:', error);
    return { success: false };
  }
}

/**
 * Get the current logged-in user
 * @returns {object | null}
 */
export function getCurrentUser() {
  try {
    const stored = sessionStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return getCurrentUser() !== null;
}

/**
 * Get user role
 * @returns {string | null}
 */
export function getUserRole() {
  const user = getCurrentUser();
  return user?.role || null;
}

// Export for global access
window.SupabaseAuth = {
  login,
  logout,
  getCurrentUser,
  isAuthenticated,
  getUserRole
};


