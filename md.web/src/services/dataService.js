const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DATA_URL = '/data/mockData.json';

let cachedData = null;
let inflight = null;

const fetchData = async () => {
  if (cachedData) {
    return cachedData;
  }

  if (inflight) {
    return inflight;
  }

  inflight = fetch(DATA_URL).then(async (response) => {
    if (!response.ok) {
      throw new Error('Örnek veri alınamadı');
    }
    const payload = await response.json();
    cachedData = payload;
    return payload;
  });

  return inflight.finally(() => {
    inflight = null;
  });
};

const fetchJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message = err.detail || response.statusText;
    throw new Error(message);
  }
  return response.json();
};

export const getDashboardData = async () => {
  const data = await fetchData();
  return {
    stats: data.stats,
    activities: data.activities,
    priorityJobs: data.priorityJobs,
    weekOverview: data.weekOverview,
    paymentStatus: data.paymentStatus,
    teamStatus: data.teamStatus,
  };
};

export const getJobs = async () => {
  return fetchJson('/jobs');
};

export const getJob = async (id) => fetchJson(`/jobs/${id}`);

export const createJob = async (payload) =>
  fetchJson('/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateJobMeasure = async (id, payload) =>
  fetchJson(`/jobs/${id}/measure`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const updateJobOffer = async (id, payload) =>
  fetchJson(`/jobs/${id}/offer`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const startJobApproval = async (id, payload) =>
  fetchJson(`/jobs/${id}/approval/start`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateStockStatus = async (id, payload) =>
  fetchJson(`/jobs/${id}/stock`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

/**
 * Lokal/mock ortamda stok rezervasyonu veya düşümünü uygular.
 * Frontend önizlemelerinde Stok ve Rezervasyon sayfalarının tutarlı kalması için kullanılır.
 * @param {Array<{id:string, qty:number}>} reservations
 * @param {{ready?: boolean, note?: string}} options
 */
export const applyLocalStockReservation = (reservations = [], options = {}) => {
  if (!cachedData || !Array.isArray(reservations)) return;
  const ready = Boolean(options.ready);
  const note = options.note || '';
  const movements = cachedData.stockMovements || [];
  const items = cachedData.stockItems || [];
  const reservationsList = cachedData.reservations || [];

  reservations.forEach((line) => {
    const target = items.find((it) => it.id === line.id);
    if (!target) return;
    const qty = Number(line.qty) || 0;
    if (qty <= 0) return;

    if (ready) {
      target.onHand = Math.max(0, (target.onHand || 0) - qty);
    } else {
      target.reserved = (target.reserved || 0) + qty;
    }

    movements.unshift({
      id: `MOV-${Date.now()}-${line.id}`,
      date: new Date().toISOString().slice(0, 10),
      item: target.name,
      change: ready ? -qty : qty,
      reason: note || (ready ? 'Rezerv alındı' : 'Rezervasyon'),
      operator: 'Sistem',
    });

    reservationsList.unshift({
      id: `RSV-${Date.now()}-${line.id}`,
      job: options.jobId || 'JOB-LOCAL',
      item: target.name,
      qty,
      dueDate: options.dueDate || new Date().toISOString().slice(0, 10),
      status: ready ? 'Ayrıldı' : 'Beklemede',
    });
  });

  cachedData.stockMovements = movements.slice(0, 200);
  cachedData.stockItems = items;
  cachedData.reservations = reservationsList;
};

export const updateProductionStatus = async (id, payload) =>
  fetchJson(`/jobs/${id}/production`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const scheduleAssembly = async (id, payload) =>
  fetchJson(`/jobs/${id}/assembly/schedule`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const completeAssembly = async (id, payload) =>
  fetchJson(`/jobs/${id}/assembly/complete`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const closeFinance = async (id, payload) =>
  fetchJson(`/jobs/${id}/finance/close`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const getTasks = async () => {
  const data = await fetchData();
  return data.tasks || [];
};

export const getCustomers = async () => {
  return fetchJson('/customers');
};

export const createCustomer = async (payload) => {
  return fetchJson('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateCustomer = async (id, payload) => {
  return fetchJson(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const softDeleteCustomer = async (id) => {
  return fetchJson(`/customers/${id}`, {
    method: 'DELETE',
  });
};

export const getPlanningEvents = async () => {
  const data = await fetchData();
  return data.planningEvents || [];
};

export const getStockItems = async () => {
  try {
    return await fetchJson('/stock/items');
  } catch (e) {
    console.warn('API stock items failed, falling back to mock', e);
    const data = await fetchData();
    return data.stockItems || [];
  }
};

export const createStockItem = async (payload) =>
  fetchJson('/stock/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateStockItem = async (id, payload) =>
  fetchJson(`/stock/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteStockItem = async (id) =>
  fetchJson(`/stock/items/${id}`, {
    method: 'DELETE',
  });

export const createStockMovement = async (payload) =>
  fetchJson('/stock/movements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getStockMovements = async () => {
  try {
    return await fetchJson('/stock/movements');
  } catch (e) {
    const data = await fetchData();
    return data.stockMovements || [];
  }
};

export const getReservations = async () => {
  const data = await fetchData();
  return data.reservations || [];
};

export const getJobLogs = async (jobId) => {
  const data = await fetchData();
  return (data.jobLogs || []).filter((log) => log.jobId === jobId);
};

export const addJobLog = async (payload) => {
  const data = await fetchData();
  const entry = {
    id: payload.id || `LOG-${Date.now()}`,
    jobId: payload.jobId,
    action: payload.action || 'log',
    detail: payload.detail || '',
    createdAt: payload.createdAt || new Date().toISOString(),
    meta: payload.meta || {},
  };
  data.jobLogs = [entry, ...(data.jobLogs || [])];
  cachedData = data;
  return entry;
};

export const updateJobStatus = async (id, payload) =>
  fetchJson(`/jobs/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

/**
 * Mock ortamında işin ödeme / teklif / dosya / statü bilgilerinin lokal tutulması için yardımcı.
 * Backend yoksa frontende anlık tutarlılık sağlar.
 */
export const applyLocalJobPatch = (jobId, patch) => {
  if (!cachedData) return;
  const jobs = cachedData.jobs || [];
  cachedData.jobs = jobs.map((job) => (job.id === jobId ? { ...job, ...patch } : job));
};

/**
 * Mock ortamında eksik stoklar için yerel PO kaydı oluşturur.
 * items: [{name, qty, sku, color}]
 */
export const createLocalPurchaseOrders = (jobId, items = []) => {
  if (!cachedData) return;
  const po = {
    id: `PO-${Date.now()}`,
    supplier: 'Sipariş Bekleniyor',
    total: '₺0',
    status: 'Beklemede',
    expectedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    jobId,
    lines: items.map((i) => ({
      name: i.name,
      qty: i.qty,
      sku: i.sku,
      color: i.color,
    })),
  };
  cachedData.purchaseOrders = [po, ...(cachedData.purchaseOrders || [])];
  return po;
};

export const getJobRoles = async () => {
  const data = await fetchData();
  return data.jobRoles || [];
};

export const createJobRole = async (payload) => {
  const data = await fetchData();
  const role = {
    id: payload.id || `ROLE-${Date.now()}`,
    name: payload.name?.trim() || 'Yeni İş Kolu',
    description: payload.description || '',
  };
  data.jobRoles = [role, ...(data.jobRoles || [])];
  cachedData = data;
  return role;
};

export const updateJobRole = async (id, payload) => {
  const data = await fetchData();
  const next = (data.jobRoles || []).map((role) =>
    role.id === id ? { ...role, name: payload.name ?? role.name, description: payload.description ?? role.description } : role
  );
  data.jobRoles = next;
  cachedData = data;
  return next.find((r) => r.id === id);
};

export const deleteJobRole = async (id) => {
  const data = await fetchData();
  data.jobRoles = (data.jobRoles || []).filter((role) => role.id !== id);
  cachedData = data;
  return true;
};

export const getColors = async () => fetchJson('/colors/');

export const createColor = async (payload) =>
  fetchJson('/colors/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deleteColor = async (id) =>
  fetchJson(`/colors/${id}`, {
    method: 'DELETE',
  });

export const getPurchaseOrders = async () => {
  const data = await fetchData();
  return data.purchaseOrders || [];
};

export const getSuppliers = async () => {
  const data = await fetchData();
  return data.suppliers || [];
};

export const getRequests = async () => {
  const data = await fetchData();
  return data.requests || [];
};

export const getInvoices = async () => {
  const data = await fetchData();
  return data.invoices || [];
};

export const getPayments = async () => {
  const data = await fetchData();
  return data.payments || [];
};

export const getArchiveFiles = async () => {
  const data = await fetchData();
  return data.archiveFiles || [];
};

export const getReports = async () => {
  const data = await fetchData();
  return data.reports || [];
};

export const getSettings = async () => {
  const data = await fetchData();
  return data.settings || [];
};

// Document Management
export const getDocuments = async (jobId = null, docType = null) => {
  let url = '/documents';
  const params = new URLSearchParams();
  if (jobId) params.append('job_id', jobId);
  if (docType) params.append('doc_type', docType);
  if (params.toString()) url += `?${params.toString()}`;
  return fetchJson(url);
};

export const getJobDocuments = async (jobId) => fetchJson(`/documents/job/${jobId}`);

export const uploadDocument = async (file, jobId, docType, description = '') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('jobId', jobId);
  formData.append('docType', docType);
  if (description) formData.append('description', description);

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Dosya yüklenemedi');
  }

  return response.json();
};

export const deleteDocument = async (docId) =>
  fetchJson(`/documents/${docId}`, { method: 'DELETE' });

export const getDocumentDownloadUrl = (docId) => `${API_BASE}/documents/${docId}/download`;

