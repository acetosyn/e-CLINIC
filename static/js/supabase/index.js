/* ===========================================================
   EPICONSULT e-CLINIC — Supabase Module Index
   Central export point for all Supabase functionality
   
   Usage (ES Modules):
     import { SupabasePatients, SupabaseAuth } from './supabase/index.js';
   
   Usage (Global):
     window.Supabase.Patients.registerPatient(data);
     window.Supabase.Auth.login(user, pass, role);
=========================================================== */

// Re-export all modules
export * from './client.js';
export * from './auth.js';
export * from './patients.js';
export * from './records.js';
export * from './activities.js';

// Create unified global namespace
window.Supabase = {
  Client: window.SupabaseClient,
  Auth: window.SupabaseAuth,
  Patients: window.SupabasePatients,
  Records: window.SupabaseRecords,
  Activities: window.SupabaseActivities
};

console.log('[Supabase] All modules loaded and available at window.Supabase');


