/* ===========================================================
   EPICONSULT e-CLINIC — Supabase Bundle (Non-Module Version)
   All Supabase functionality in a single file for legacy scripts
   
   Usage:
     <script src="/static/js/supabase-bundle.js"></script>
     <script>
       Supabase.Patients.registerPatient(data);
       Supabase.Auth.login(user, pass, role);
     </script>
=========================================================== */

(function() {
  'use strict';

  // =========================================================
  // CONFIGURATION
  // =========================================================
  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  // =========================================================
  // CLIENT MODULE
  // =========================================================
  let _client = null;
  let _initialized = false;
  let _initPromise = null;

  function loadLibrary() {
    return new Promise((resolve, reject) => {
      if (typeof supabase !== 'undefined') {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = SUPABASE_CDN;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Supabase library'));
      document.head.appendChild(script);
    });
  }

  function getCredentials() {
    const urlEl = document.getElementById('supabase-url');
    const keyEl = document.getElementById('supabase-anon-key');
    const url = urlEl?.getAttribute('data-url')?.trim();
    const anonKey = keyEl?.getAttribute('data-key')?.trim();
    
    // Debug logging
    if (!urlEl) console.warn('[Supabase] Missing element: #supabase-url');
    if (!keyEl) console.warn('[Supabase] Missing element: #supabase-anon-key');
    if (!url) console.warn('[Supabase] URL is empty or not set');
    if (!anonKey) console.warn('[Supabase] Anon key is empty or not set');
    
    if (!url || !anonKey) return null;
    
    console.log('[Supabase] Credentials found:', url.substring(0, 30) + '...');
    return { url, anonKey };
  }

  async function initClient() {
    if (_initialized && _client) return _client;
    try {
      console.log('[Supabase] Loading library from CDN...');
      await loadLibrary();
      console.log('[Supabase] Library loaded, getting credentials...');
      
      const creds = getCredentials();
      if (!creds) {
        console.error('[Supabase] Credentials not found - check that SUPABASE_URL and SUPABASE_ANON_KEY are in .env');
        return null;
      }
      
      _client = supabase.createClient(creds.url, creds.anonKey);
      _initialized = true;
      console.log('[Supabase] Client initialized successfully');
      return _client;
    } catch (err) {
      console.error('[Supabase] Init failed:', err);
      return null;
    }
  }

  async function getClient() {
    if (_client) return _client;
    if (!_initPromise) _initPromise = initClient();
    return _initPromise;
  }

  // =========================================================
  // ID GENERATORS
  // =========================================================
  function generateFileNo() {
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return `F-${result}`;
  }

  function generatePatientId() {
    const year = new Date().getFullYear();
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return `EPN-${year}-${result}`;
  }

  // =========================================================
  // AUTH MODULE
  // =========================================================
  const Auth = {
    async login(username, password, role) {
      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role }),
          credentials: 'include'
        });
        const result = await response.json();
        if (result.success) {
          sessionStorage.setItem('currentUser', JSON.stringify(result.user));
        }
        return result;
      } catch (err) {
        console.error('[Auth] Login error:', err);
        return { success: false, message: 'Server error' };
      }
    },

    logout() {
      sessionStorage.removeItem('currentUser');
      window.location.href = '/logout';
    },

    getCurrentUser() {
      try {
        const stored = sessionStorage.getItem('currentUser');
        return stored ? JSON.parse(stored) : null;
      } catch { return null; }
    },

    isAuthenticated() {
      return this.getCurrentUser() !== null;
    },

    getUserRole() {
      return this.getCurrentUser()?.role || null;
    }
  };

  // =========================================================
  // PATIENTS MODULE
  // =========================================================
  const Patients = {
    async register(data, registeredBy) {
      try {
        const client = await getClient();
        if (!client) {
          return await this._registerViaBackend(data);
        }

        const required = ['first_name', 'last_name', 'date_of_birth', 'sex', 'phone'];
        for (const field of required) {
          if (!data[field]) {
            return { success: false, message: `${field.replace('_', ' ')} is required.` };
          }
        }

        const file_no = generateFileNo();
        const patient_id = generatePatientId();
        const now = new Date().toISOString();

        const record = {
          file_no, patient_id,
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

        const { data: patient, error } = await client
          .from('patients')
          .insert([record])
          .select()
          .single();

        if (error) {
          console.error('[Patients] Insert error:', error);
          return { success: false, message: error.message };
        }

        // Log activity
        await Activities.log({
          department: 'Customer Care',
          activity_type: 'patient_registration',
          description: `New patient registered: ${patient.first_name} ${patient.last_name}`,
          patient_name: `${patient.first_name} ${patient.last_name}`,
          patient_id: patient.patient_id,
          performed_by: registeredBy
        });

        return { success: true, patient, message: 'Patient registered successfully' };

      } catch (err) {
        console.error('[Patients] Register error:', err);
        return { success: false, message: 'Registration failed' };
      }
    },

    async _registerViaBackend(data) {
      try {
        const response = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include'
        });
        return await response.json();
      } catch (err) {
        return { success: false, message: 'Server error' };
      }
    },

    async search(query, limit = 50) {
      try {
        if (!query || query.trim().length < 2) return { success: true, results: [] };

        const client = await getClient();
        if (!client) {
          console.error('[Patients] Supabase client not available for search');
          return { success: false, results: [], error: 'Supabase client not initialized' };
        }

        console.log(`[Patients] Searching Supabase for: "${query}"`);
        const q = query.trim();
        const { data, error } = await client
          .from('patients')
          .select('id, file_no, patient_id, title, first_name, last_name, date_of_birth, age, sex, phone, email, address')
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,file_no.ilike.%${q}%,patient_id.ilike.%${q}%,email.ilike.%${q}%`)
          .order('id')
          .limit(limit);

        if (error) {
          console.error('[Patients] Search error:', error);
          return { success: false, results: [], error: error.message };
        }
        
        console.log(`[Patients] Search found ${data?.length || 0} results`);
        return { success: true, results: data || [] };
      } catch (err) {
        console.error('[Patients] search exception:', err);
        return { success: false, results: [], error: err.message };
      }
    },

    /**
     * Fetch a single page of patients (server-side pagination)
     * This is FAST - only fetches what's needed for current view
     */
    async fetchPage(page = 1, pageSize = 25, searchQuery = '') {
      try {
        const client = await getClient();
        if (!client) {
          console.error('[Patients] Supabase client not available');
          return { success: false, records: [], total: 0, error: 'Supabase client not initialized' };
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        // Build query
        let query = client
          .from('patients')
          .select('id, file_no, patient_id, title, first_name, last_name, date_of_birth, age, sex, phone, email, address', { count: 'exact' });

        // Apply search filter if provided
        if (searchQuery && searchQuery.trim().length >= 2) {
          const q = searchQuery.trim();
          query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,file_no.ilike.%${q}%,patient_id.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
        }

        // Apply ordering and pagination
        query = query.order('id').range(from, to);

        const { data, count, error } = await query;

        if (error) {
          console.error('[Patients] Fetch page error:', error);
          return { success: false, records: [], total: 0, error: error.message };
        }

        console.log(`[Patients] Page ${page}: ${data?.length || 0} records (total: ${count})`);
        return { success: true, records: data || [], total: count || 0 };
      } catch (err) {
        console.error('[Patients] fetchPage exception:', err);
        return { success: false, records: [], total: 0, error: err.message };
      }
    },

    /**
     * Fetch ALL patients (batch mode) - USE SPARINGLY
     * Only for exports or full data operations
     */
    async fetchAll(page = 1, pageSize = 1000) {
      try {
        const client = await getClient();
        if (!client) {
          console.error('[Patients] Supabase client not available - cannot fetch patients');
          return { success: false, records: [], total: 0, error: 'Supabase client not initialized' };
        }

        // Get total count first
        const { count, error: countError } = await client.from('patients').select('id', { count: 'exact', head: true });
        if (countError) {
          console.error('[Patients] Count query error:', countError);
        }
        
        const totalRecords = count || 0;
        console.log(`[Patients] Total patients in database: ${totalRecords}`);

        // If fetching all (large pageSize), batch fetch to overcome 1000 row limit
        if (pageSize >= 1000 && totalRecords > 1000) {
          console.log(`[Patients] Batch fetching ${totalRecords} patients...`);
          const allRecords = [];
          const batchSize = 1000;
          const batches = Math.ceil(totalRecords / batchSize);
          
          for (let i = 0; i < batches; i++) {
            const from = i * batchSize;
            const to = from + batchSize - 1;
            
            const { data, error } = await client
              .from('patients')
              .select('id, file_no, patient_id, title, first_name, last_name, date_of_birth, age, sex, phone, email, address')
              .order('id')
              .range(from, to);
            
            if (error) {
              console.error(`[Patients] Batch ${i + 1} error:`, error);
              continue;
            }
            
            if (data && data.length > 0) {
              allRecords.push(...data);
              console.log(`[Patients] Batch ${i + 1}/${batches}: fetched ${data.length} (total: ${allRecords.length})`);
            }
          }
          
          console.log(`[Patients] Completed: ${allRecords.length} patients fetched`);
          return { success: true, records: allRecords, total: totalRecords };
        }
        
        // Regular paginated fetch
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        console.log(`[Patients] Fetching patients (page ${page}, range ${from}-${to})...`);
        
        const { data, error } = await client
          .from('patients')
          .select('id, file_no, patient_id, title, first_name, last_name, date_of_birth, age, sex, phone, email, address')
          .order('id')
          .range(from, to);

        if (error) {
          console.error('[Patients] Fetch error:', error);
          return { success: false, records: [], total: 0, error: error.message };
        }
        
        console.log(`[Patients] Fetched ${data?.length || 0} patients`);
        return { success: true, records: data || [], total: totalRecords };
      } catch (err) {
        console.error('[Patients] fetchAll exception:', err);
        return { success: false, records: [], total: 0, error: err.message };
      }
    },

    async get(identifier) {
      try {
        const client = await getClient();
        if (!client) return await this._getViaBackend(identifier);

        const { data, error } = await client
          .from('patients')
          .select('*')
          .or(`patient_id.eq.${identifier},file_no.eq.${identifier}`)
          .single();

        if (error) return { success: false };
        return { success: true, patient: data };
      } catch { return { success: false }; }
    },

    async _getViaBackend(identifier) {
      try {
        const response = await fetch(`/records/get/${encodeURIComponent(identifier)}`, { credentials: 'include' });
        return await response.json();
      } catch { return { success: false }; }
    },

    async update(id, updates) {
      try {
        const client = await getClient();
        if (!client) return { success: false, message: 'Client not available' };

        const { data, error } = await client
          .from('patients')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) return { success: false, message: error.message };
        return { success: true, patient: data };
      } catch { return { success: false, message: 'Update failed' }; }
    },

    async delete(id) {
      try {
        const client = await getClient();
        if (!client) return { success: false };

        const { error } = await client.from('patients').delete().eq('id', id);
        if (error) return { success: false };
        return { success: true };
      } catch { return { success: false }; }
    }
  };

  // =========================================================
  // RECORDS MODULE
  // =========================================================
  const Records = {
    async fetchPatientRecords(patientId) {
      try {
        const client = await getClient();
        if (!client) return { success: false, records: [] };

        const { data, error } = await client
          .from('patient_records')
          .select('*')
          .or(`patient_id.eq.${patientId},file_no.eq.${patientId}`)
          .order('created_at', { ascending: false });

        if (error) return { success: false, records: [] };
        return { success: true, records: data || [] };
      } catch { return { success: false, records: [] }; }
    },

    async save(recordData, dataEntry) {
      try {
        const client = await getClient();
        if (!client) return { success: false, message: 'Client not available' };

        const now = new Date().toISOString();
        const record = {
          patient_id: recordData.patient_id,
          file_no: recordData.file_no,
          record_type: recordData.record_type || 'visit',
          description: recordData.description || '',
          notes: recordData.notes || '',
          services: recordData.services || [],
          data_entry: dataEntry || 'system',
          created_at: now,
          updated_at: now
        };

        const { data, error } = await client.from('patient_records').insert([record]).select().single();
        if (error) return { success: false, message: error.message };
        return { success: true, record: data };
      } catch { return { success: false, message: 'Save failed' }; }
    },

    async fetchServices(category = null) {
      try {
        const client = await getClient();
        if (!client) return { success: false, services: [] };

        let query = client.from('services').select('*').order('category');
        if (category) query = query.eq('category', category);

        const { data, error } = await query;
        if (error) return { success: false, services: [] };
        return { success: true, services: data || [] };
      } catch { return { success: false, services: [] }; }
    },

    async searchServices(query) {
      try {
        if (!query || query.trim().length < 2) return { success: true, services: [] };

        const client = await getClient();
        if (!client) return { success: false, services: [] };

        const { data, error } = await client
          .from('services')
          .select('*')
          .ilike('name', `%${query.trim()}%`)
          .limit(20);

        if (error) return { success: false, services: [] };
        return { success: true, services: data || [] };
      } catch { return { success: false, services: [] }; }
    }
  };

  // =========================================================
  // ACTIVITIES MODULE
  // =========================================================
  let _activitiesChannel = null;

  const Activities = {
    async log(activity) {
      try {
        const client = await getClient();
        if (!client) return await this._logViaBackend(activity);

        const now = new Date().toISOString();
        const record = {
          department: activity.department || 'General',
          activity_type: activity.activity_type || 'action',
          description: activity.description || '',
          patient_name: activity.patient_name || null,
          patient_id: activity.patient_id || null,
          performed_by: activity.performed_by || 'system',
          metadata: activity.metadata || {},
          created_at: now
        };

        const { data, error } = await client.from('activities').insert([record]).select().single();
        if (error) return { success: false };
        return { success: true, activity: data };
      } catch { return { success: false }; }
    },

    async _logViaBackend(activity) {
      try {
        const response = await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activity),
          credentials: 'include'
        });
        return await response.json();
      } catch { return { success: false }; }
    },

    async fetch(limit = 50, department = null) {
      try {
        const client = await getClient();
        if (!client) return await this._fetchViaBackend();

        let query = client.from('activities').select('*').order('created_at', { ascending: false }).limit(limit);
        if (department) query = query.eq('department', department);

        const { data, error } = await query;
        if (error) return { success: false, activities: [] };
        return { success: true, activities: data || [] };
      } catch { return { success: false, activities: [] }; }
    },

    async _fetchViaBackend() {
      try {
        const response = await fetch('/api/activities', { credentials: 'include' });
        const result = await response.json();
        return { success: result.success, activities: result.activities || [] };
      } catch { return { success: false, activities: [] }; }
    },

    async fetchToday(department = null) {
      try {
        const client = await getClient();
        if (!client) return await this._fetchViaBackend();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let query = client
          .from('activities')
          .select('*')
          .gte('created_at', today.toISOString())
          .order('created_at', { ascending: false });

        if (department) query = query.eq('department', department);

        const { data, error } = await query;
        if (error) return { success: false, activities: [] };
        return { success: true, activities: data || [] };
      } catch { return { success: false, activities: [] }; }
    },

    async subscribe(callback) {
      try {
        const client = await getClient();
        if (!client) return { success: false, unsubscribe: () => {} };

        if (_activitiesChannel) {
          client.removeChannel(_activitiesChannel);
          _activitiesChannel = null;
        }

        _activitiesChannel = client
          .channel(`activities-realtime-${Date.now()}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' },
            (payload) => {
              if (payload.new && callback) callback(payload.new);
            }
          )
          .subscribe((status) => {
            console.log('[Activities] Subscription status:', status);
          });

        return {
          success: true,
          unsubscribe: () => {
            if (_activitiesChannel && client) {
              client.removeChannel(_activitiesChannel);
              _activitiesChannel = null;
            }
          }
        };
      } catch { return { success: false, unsubscribe: () => {} }; }
    },

    unsubscribe() {
      getClient().then(client => {
        if (_activitiesChannel && client) {
          client.removeChannel(_activitiesChannel);
          _activitiesChannel = null;
        }
      });
    }
  };

  // =========================================================
  // EXPOSE GLOBAL API
  // =========================================================
  window.Supabase = {
    getClient,
    isReady: () => _initialized,
    Auth,
    Patients,
    Records,
    Activities
  };

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => getClient());
  } else {
    getClient();
  }

  console.log('[Supabase] Bundle loaded. Access via window.Supabase');

})();


