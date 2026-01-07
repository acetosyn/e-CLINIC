/* ===========================================================
   EPICONSULT e-CLINIC — Supabase Patients Module
   Patient registration and management
   
   Usage:
     import { registerPatient, searchPatients } from './supabase/patients.js';
     const result = await registerPatient(patientData);
=========================================================== */

import { getSupabaseClient } from './client.js';

// ID Generation helpers
function generateFileNo() {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `F-${result}`;
}

function generatePatientId() {
  const year = new Date().getFullYear();
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `EPN-${year}-${result}`;
}

/**
 * Register a new patient
 * @param {object} data - Patient data
 * @param {string} registeredBy - Username of person registering
 * @returns {Promise<{success: boolean, patient?: object, message?: string}>}
 */
export async function registerPatient(data, registeredBy) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      console.warn('[Patients] Supabase client not available, using backend API');
      return await registerPatientViaBackend(data);
    }

    // Validate required fields
    const required = ['first_name', 'last_name', 'date_of_birth', 'sex', 'phone'];
    for (const field of required) {
      if (!data[field]) {
        return { success: false, message: `${field.replace('_', ' ')} is required.` };
      }
    }

    // Generate IDs
    const file_no = generateFileNo();
    const patient_id = generatePatientId();
    const now = new Date().toISOString();

    // Prepare patient record
    const patientRecord = {
      file_no,
      patient_id,
      title: data.title || null,
      first_name: data.first_name,
      last_name: data.last_name,
      date_of_birth: data.date_of_birth,
      age: data.age || null,
      sex: data.sex,
      occupation: data.occupation || null,
      phone: data.phone,
      email: data.email || null,
      address: data.address || null,
      category: data.category || null,
      registered_by: registeredBy || 'system',
      is_test: false,
      created_at: now,
      updated_at: now
    };

    // Handle referral if provided
    if (data.referred_by) {
      const referralId = await getOrCreateReferral(client, data.referred_by);
      if (referralId) {
        patientRecord.referred_by_id = referralId;
      }
    }

    // Insert patient
    const { data: patient, error } = await client
      .from('patients')
      .insert([patientRecord])
      .select()
      .single();

    if (error) {
      console.error('[Patients] Insert error:', error);
      return { success: false, message: error.message || 'Failed to register patient.' };
    }

    // Log activity
    await logPatientActivity(client, patient, registeredBy);

    console.log('[Patients] Patient registered:', patient.patient_id);
    return {
      success: true,
      patient,
      message: 'Patient registered successfully'
    };

  } catch (error) {
    console.error('[Patients] Registration error:', error);
    return { success: false, message: 'An error occurred during registration.' };
  }
}

/**
 * Get or create a referral
 * @param {SupabaseClient} client
 * @param {string} referralName
 * @returns {Promise<number | null>}
 */
async function getOrCreateReferral(client, referralName) {
  try {
    // Check if referral exists
    const { data: existing } = await client
      .from('referrals')
      .select('id')
      .eq('name', referralName)
      .single();

    if (existing) {
      return existing.id;
    }

    // Create new referral
    const now = new Date().toISOString();
    const { data: newReferral, error } = await client
      .from('referrals')
      .insert([{
        name: referralName,
        type: 'Other',
        created_at: now,
        updated_at: now
      }])
      .select('id')
      .single();

    if (error) {
      console.warn('[Patients] Failed to create referral:', error);
      return null;
    }

    return newReferral.id;

  } catch (error) {
    console.warn('[Patients] Referral error:', error);
    return null;
  }
}

/**
 * Log patient registration activity
 * @param {SupabaseClient} client
 * @param {object} patient
 * @param {string} performedBy
 */
async function logPatientActivity(client, patient, performedBy) {
  try {
    const now = new Date().toISOString();
    await client.from('activities').insert([{
      department: 'Customer Care',
      activity_type: 'patient_registration',
      description: `New patient registered: ${patient.first_name} ${patient.last_name}`,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      patient_id: patient.patient_id,
      performed_by: performedBy || 'system',
      metadata: { file_no: patient.file_no },
      created_at: now
    }]);
  } catch (error) {
    console.warn('[Patients] Activity logging failed:', error);
  }
}

/**
 * Register patient via backend API (fallback)
 * @param {object} data
 * @returns {Promise<{success: boolean, patient?: object, message?: string}>}
 */
async function registerPatientViaBackend(data) {
  try {
    const response = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });

    return await response.json();

  } catch (error) {
    console.error('[Patients] Backend API error:', error);
    return { success: false, message: 'Server error. Please try again.' };
  }
}

/**
 * Search patients by name, file_no, patient_id, or email
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 50)
 * @returns {Promise<{success: boolean, results: object[]}>}
 */
export async function searchPatients(query, limit = 50) {
  try {
    if (!query || query.trim().length < 2) {
      return { success: true, results: [] };
    }

    const client = await getSupabaseClient();
    if (!client) {
      return await searchPatientsViaBackend(query);
    }

    const q = query.trim();
    const { data, error } = await client
      .from('patients')
      .select('id, file_no, patient_id, title, first_name, last_name, date_of_birth, age, sex, phone, email, address')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,file_no.ilike.%${q}%,patient_id.ilike.%${q}%,email.ilike.%${q}%`)
      .order('id')
      .limit(limit);

    if (error) {
      console.error('[Patients] Search error:', error);
      return { success: false, results: [] };
    }

    return { success: true, results: data || [] };

  } catch (error) {
    console.error('[Patients] Search error:', error);
    return { success: false, results: [] };
  }
}

/**
 * Search patients via backend (fallback)
 */
async function searchPatientsViaBackend(query) {
  try {
    const response = await fetch(`/records/search?q=${encodeURIComponent(query)}`, {
      credentials: 'include'
    });
    return await response.json();
  } catch (error) {
    console.error('[Patients] Backend search error:', error);
    return { success: false, results: [] };
  }
}

/**
 * Fetch all patients (paginated)
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Records per page
 * @returns {Promise<{success: boolean, records: object[], total: number}>}
 */
export async function fetchAllPatients(page = 1, pageSize = 25) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return await fetchAllPatientsViaBackend();
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Get count
    const { count } = await client
      .from('patients')
      .select('id', { count: 'exact', head: true });

    // Get records
    const { data, error } = await client
      .from('patients')
      .select('id, file_no, patient_id, title, first_name, last_name, date_of_birth, age, sex, phone, email, address')
      .order('id')
      .range(from, to);

    if (error) {
      console.error('[Patients] Fetch error:', error);
      return { success: false, records: [], total: 0 };
    }

    return {
      success: true,
      records: data || [],
      total: count || 0
    };

  } catch (error) {
    console.error('[Patients] Fetch error:', error);
    return { success: false, records: [], total: 0 };
  }
}

/**
 * Fetch all patients via backend (fallback)
 */
async function fetchAllPatientsViaBackend() {
  try {
    const response = await fetch('/records/all', { credentials: 'include' });
    const result = await response.json();
    return {
      success: result.success,
      records: result.records || [],
      total: result.records?.length || 0
    };
  } catch (error) {
    console.error('[Patients] Backend fetch error:', error);
    return { success: false, records: [], total: 0 };
  }
}

/**
 * Get a single patient by identifier (file_no or patient_id)
 * @param {string} identifier
 * @returns {Promise<{success: boolean, patient?: object}>}
 */
export async function getPatient(identifier) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return await getPatientViaBackend(identifier);
    }

    const { data, error } = await client
      .from('patients')
      .select('*')
      .or(`patient_id.eq.${identifier},file_no.eq.${identifier}`)
      .single();

    if (error) {
      console.error('[Patients] Get patient error:', error);
      return { success: false };
    }

    return { success: true, patient: data };

  } catch (error) {
    console.error('[Patients] Get patient error:', error);
    return { success: false };
  }
}

/**
 * Get patient via backend (fallback)
 */
async function getPatientViaBackend(identifier) {
  try {
    const response = await fetch(`/records/get/${encodeURIComponent(identifier)}`, {
      credentials: 'include'
    });
    return await response.json();
  } catch (error) {
    console.error('[Patients] Backend get error:', error);
    return { success: false };
  }
}

/**
 * Update a patient record
 * @param {number} id - Patient ID
 * @param {object} updates - Fields to update
 * @returns {Promise<{success: boolean, patient?: object, message?: string}>}
 */
export async function updatePatient(id, updates) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return { success: false, message: 'Supabase client not available' };
    }

    const { data, error } = await client
      .from('patients')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Patients] Update error:', error);
      return { success: false, message: error.message };
    }

    return { success: true, patient: data };

  } catch (error) {
    console.error('[Patients] Update error:', error);
    return { success: false, message: 'Update failed' };
  }
}

/**
 * Delete a patient (soft delete by marking as test)
 * @param {number} id
 * @returns {Promise<{success: boolean}>}
 */
export async function deletePatient(id) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return { success: false, message: 'Supabase client not available' };
    }

    const { error } = await client
      .from('patients')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Patients] Delete error:', error);
      return { success: false };
    }

    return { success: true };

  } catch (error) {
    console.error('[Patients] Delete error:', error);
    return { success: false };
  }
}

// Export for global access
window.SupabasePatients = {
  registerPatient,
  searchPatients,
  fetchAllPatients,
  getPatient,
  updatePatient,
  deletePatient
};


