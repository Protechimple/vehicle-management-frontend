import { readToken, clearSession } from './session';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

export const SESSION_EXPIRED_EVENT = 'vmms:session-expired';

export const PASSWORD_CHANGE_REQUIRED_EVENT = 'vmms:password-change-required';
const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (code) this.code = code;
  }
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function endSessionIfExpired(response, token) {
  if (response.status === 401 && token) {
    clearSession();
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

function announcePasswordChangeRequired(payload) {
  if (payload?.code === PASSWORD_CHANGE_REQUIRED) {
    window.dispatchEvent(new CustomEvent(PASSWORD_CHANGE_REQUIRED_EVENT));
  }
}

// Builds a JSON request function around one session: where its token lives and what to do when the server rejects it.
export function createRequest({ getToken, onUnauthorized, onError }) {
  return async function request(method, path, body, { signal } = {}) {
    const headers = { Accept: 'application/json' };
    const token = getToken();

    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
    }

    const payload = await readBody(response);

    if (response.ok) return payload;

    onUnauthorized(response, token);
    onError?.(payload);

    throw new ApiError(response.status, payload?.error ?? `Request failed (${response.status})`, payload?.code);
  };
}

const request = createRequest({
  getToken: readToken,
  onUnauthorized: endSessionIfExpired,
  onError: announcePasswordChangeRequired,
});

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path, body) => request('DELETE', path, body),
};

const LOOKUP_PAGE_SIZE = 100;
const LOOKUP_PARALLEL_PAGES = 4;

export async function listAll(fetchPage, params = {}) {
  const first = await fetchPage({ ...params, page: 1, limit: LOOKUP_PAGE_SIZE });
  const rows = [...(first?.data ?? [])];
  const pages = first?.pagination?.pages ?? 1;
  for (let start = 2; start <= pages; start += LOOKUP_PARALLEL_PAGES) {
    const batch = [];
    for (let page = start; page < start + LOOKUP_PARALLEL_PAGES && page <= pages; page += 1) {
      batch.push(fetchPage({ ...params, page, limit: LOOKUP_PAGE_SIZE }));
    }
    for (const response of await Promise.all(batch)) rows.push(...(response?.data ?? []));
  }
  const seen = new Set();
  const data = rows.filter((row) => {
    if (row?.id == null) return true;
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  return { ...first, data, pagination: { page: 1, limit: data.length, total: data.length, pages: 1 } };
}

export const authApi = {
  logIn: (payload) => api.post('/auth/login', payload),
  logOut: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  requestPasswordReset: (payload) => api.post('/auth/forgot-password', payload),
  checkResetToken: (token) => api.get(`/auth/reset-password?token=${encodeURIComponent(token)}`),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
};

export const usersApi = {
  list: () => api.get('/users'),
  team: () => api.get('/users/team'),
  createMember: (payload) => api.post('/users/members', payload),
  updateMember: (id, payload) => api.put(`/users/members/${id}`, payload),
  setMemberStatus: (id, status) => api.patch(`/users/members/${id}/status`, { status }),
  changeMemberPassword: (id, password) => api.put(`/users/members/${id}/password`, { password }),
  getAccess: (id) => api.get(`/users/members/${id}/access`),
  updateAccess: (id, permissions) => api.put(`/users/members/${id}/access`, { permissions }),
  updateOwnProfile: (payload) => api.put('/users/me', payload),
  changeOwnPassword: (payload) => api.put('/users/me/password', payload),
};

export function toQueryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function createAssetWithDocuments(path, payload, files = {}) {
  const headers = { Accept: 'application/json' };
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    form.append(key, key === 'compliance' ? JSON.stringify(value) : value);
  }
  for (const [docType, file] of Object.entries(files)) {
    if (file) form.append(docType, file);
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: form });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }

  const responseBody = await readBody(response);
  if (!response.ok) {
    endSessionIfExpired(response, token);
    throw new ApiError(response.status, responseBody?.error ?? `Request failed (${response.status})`);
  }
  return responseBody;
}

export const vehiclesApi = {
  list: (params) => api.get(`/vehicles${toQueryString(params)}`),
  get: (id) => api.get(`/vehicles/${id}`),
  create: (payload, files) => createAssetWithDocuments('/vehicles', payload, files),
  update: (id, payload) => api.put(`/vehicles/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/vehicles/${id}`, { confirmation }),
  restore: (id) => api.post(`/vehicles/${id}/restore`),
  history: (id) => api.get(`/vehicles/${id}/history`),
  costs: (id) => api.get(`/vehicles/${id}/costs`),
};

async function uploadAssetDocument(assetType, assetId, docType, file) {
  const headers = {};
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    const form = new FormData();
    form.append('file', file);
    response = await fetch(`${BASE_URL}/documents/${assetType}/${assetId}/${docType}`, {
      method: 'POST',
      headers,
      body: form,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }

  const payload = await readBody(response);
  if (!response.ok) {
    endSessionIfExpired(response, token);
    throw new ApiError(response.status, payload?.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

async function downloadAssetDocument(assetType, assetId, docType, suggestedFilename) {
  const headers = {};
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}/documents/${assetType}/${assetId}/${docType}/download`, { headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }

  if (!response.ok) {
    const payload = await readBody(response);
    endSessionIfExpired(response, token);
    throw new ApiError(response.status, payload?.error ?? `Request failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedFilename || 'document';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const assetDocumentsApi = {
  list: (assetType, assetId) => api.get(`/documents/${assetType}/${assetId}`),
  upload: uploadAssetDocument,
  download: downloadAssetDocument,
};

export const machineryApi = {
  list: (params) => api.get(`/machinery${toQueryString(params)}`),
  get: (id) => api.get(`/machinery/${id}`),
  create: (payload, files) => createAssetWithDocuments('/machinery', payload, files),
  update: (id, payload) => api.put(`/machinery/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/machinery/${id}`, { confirmation }),
  restore: (id) => api.post(`/machinery/${id}/restore`),
  history: (id) => api.get(`/machinery/${id}/history`),
  costs: (id) => api.get(`/machinery/${id}/costs`),
  rcplAvailability: (params) => api.get(`/machinery/rcpl-availability${toQueryString(params)}`),
};

export const sitesApi = {
  list: (params) => api.get(`/sites${toQueryString(params)}`),
  get: (id) => api.get(`/sites/${id}`),
  assets: (id) => api.get(`/sites/${id}/assets`),
  create: (payload) => api.post('/sites', payload),
  update: (id, payload) => api.put(`/sites/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/sites/${id}`, { confirmation }),
  restore: (id) => api.post(`/sites/${id}/restore`),
};

export const siteAssignmentsApi = {
  history: (assetType, assetId) => api.get(`/site-assignments/${assetType}/${assetId}`),
};

export const complianceApi = {
  listAll: (params) => api.get(`/compliance${toQueryString(params)}`),
  alerts: (params) => api.get(`/compliance/alerts${toQueryString(params)}`),
  dashboard: (params) => api.get(`/compliance/dashboard${toQueryString(params)}`),
  list: (assetType, assetId) => api.get(`/compliance/${assetType}/${assetId}`),
  save: (assetType, assetId, docType, payload) =>
    api.put(`/compliance/${assetType}/${assetId}/${docType}`, payload),
};

export const itemCategoriesApi = {
  list: (params) => api.get(`/item-categories${toQueryString(params)}`),
  get: (id) => api.get(`/item-categories/${id}`),
  create: (payload) => api.post('/item-categories', payload),
  update: (id, payload) => api.put(`/item-categories/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/item-categories/${id}`, { confirmation }),
  restore: (id) => api.post(`/item-categories/${id}/restore`),
};

export const unitsOfMeasureApi = {
  list: (params) => api.get(`/units-of-measure${toQueryString(params)}`),
  get: (id) => api.get(`/units-of-measure/${id}`),
  create: (payload) => api.post('/units-of-measure', payload),
  update: (id, payload) => api.put(`/units-of-measure/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/units-of-measure/${id}`, { confirmation }),
  restore: (id) => api.post(`/units-of-measure/${id}/restore`),
};

export const itemsApi = {
  list: (params) => api.get(`/items${toQueryString(params)}`),
  get: (id) => api.get(`/items/${id}`),
  create: (payload) => api.post('/items', payload),
  update: (id, payload) => api.put(`/items/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/items/${id}`, { confirmation }),
  restore: (id) => api.post(`/items/${id}/restore`),
};

export const suppliersApi = {
  list: (params) => api.get(`/suppliers${toQueryString(params)}`),
  get: (id) => api.get(`/suppliers/${id}`),
  create: (payload) => api.post('/suppliers', payload),
  update: (id, payload) => api.put(`/suppliers/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/suppliers/${id}`, { confirmation }),
  restore: (id) => api.post(`/suppliers/${id}/restore`),
};

export const purchasesApi = {
  list: (params) => api.get(`/purchases${toQueryString(params)}`),
  get: (id) => api.get(`/purchases/${id}`),
  create: (payload) => api.post('/purchases', payload),
  update: (id, payload) => api.put(`/purchases/${id}`, payload),
  receive: (id, payload) => api.post(`/purchases/${id}/receive`, payload),
};

export const stockApi = {
  balances: (params) => api.get(`/stock/balances${toQueryString(params)}`),
  transactions: (params) => api.get(`/stock/transactions${toQueryString(params)}`),
};

export const assetIssuesApi = {
  list: (params) => api.get(`/asset-issues${toQueryString(params)}`),
  get: (id) => api.get(`/asset-issues/${id}`),
  create: (payload) => api.post('/asset-issues', payload),
};

export const issueReversalsApi = {
  get: (id) => api.get(`/issue-reversals/${id}`),
  create: (payload) => api.post('/issue-reversals', payload),
};

export const stockAdjustmentsApi = {
  list: (params) => api.get(`/stock-adjustments${toQueryString(params)}`),
  get: (id) => api.get(`/stock-adjustments/${id}`),
  create: (payload) => api.post('/stock-adjustments', payload),
};

export const stockTransfersApi = {
  list: (params) => api.get(`/stock-transfers${toQueryString(params)}`),
  get: (id) => api.get(`/stock-transfers/${id}`),
  create: (payload) => api.post('/stock-transfers', payload),
  receive: (id) => api.post(`/stock-transfers/${id}/receive`),
};

export const fuelStationsApi = {
  list: (params) => api.get(`/fuel-stations${toQueryString(params)}`),
  get: (id) => api.get(`/fuel-stations/${id}`),
  create: (payload) => api.post('/fuel-stations', payload),
  update: (id, payload) => api.put(`/fuel-stations/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/fuel-stations/${id}`, { confirmation }),
  restore: (id) => api.post(`/fuel-stations/${id}/restore`),
};

export const fuelCollectionsApi = {
  list: (params) => api.get(`/fuel-collections${toQueryString(params)}`),
  get: (id) => api.get(`/fuel-collections/${id}`),
  create: (payload) => api.post('/fuel-collections', payload),
  update: (id, payload) => api.put(`/fuel-collections/${id}`, payload),
  receive: (id, payload) => api.post(`/fuel-collections/${id}/receive`, payload),
  cancel: (id, confirmation) => api.delete(`/fuel-collections/${id}`, { confirmation }),
};

export const siteFuelStockApi = {
  list: (params) => api.get(`/site-fuel-stock${toQueryString(params)}`),
  ledger: (params) => api.get(`/site-fuel-stock/ledger${toQueryString(params)}`),
};


export const fuelTransactionsApi = {
  list: (params) => api.get(`/fuel-transactions${toQueryString(params)}`),
  get: (id) => api.get(`/fuel-transactions/${id}`),
  create: (payload) => api.post('/fuel-transactions', payload),
  update: (id, payload) => api.put(`/fuel-transactions/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/fuel-transactions/${id}`, { confirmation }),
  efficiency: (assetType, assetId) =>
    api.get(`/fuel-transactions/efficiency/${encodeURIComponent(assetType)}/${encodeURIComponent(assetId)}`),
};

export const externalFuelApi = {
  list: (params) => api.get(`/external-fuel-entries${toQueryString(params)}`),
  get: (id) => api.get(`/external-fuel-entries/${id}`),
  create: (payload) => api.post('/external-fuel-entries', payload),
  update: (id, payload) => api.put(`/external-fuel-entries/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/external-fuel-entries/${id}`, { confirmation }),
};

export const adblueApi = {
  overview: (params) => api.get(`/adblue/overview${toQueryString(params)}`),
  reports: (params) => api.get(`/adblue/reports${toQueryString(params)}`),
  listPurchases: (params) => api.get(`/adblue/purchases${toQueryString(params)}`),
  getPurchase: (id) => api.get(`/adblue/purchases/${id}`),
  createPurchase: (payload) => api.post('/adblue/purchases', payload),
  updatePurchase: (id, payload) => api.put(`/adblue/purchases/${id}`, payload),
  removePurchase: (id, confirmation) => api.delete(`/adblue/purchases/${id}`, { confirmation }),
  listFillings: (params) => api.get(`/adblue/fillings${toQueryString(params)}`),
  getFilling: (id) => api.get(`/adblue/fillings/${id}`),
  createFilling: (payload) => api.post('/adblue/fillings', payload),
  updateFilling: (id, payload) => api.put(`/adblue/fillings/${id}`, payload),
  removeFilling: (id, confirmation) => api.delete(`/adblue/fillings/${id}`, { confirmation }),
};

export const maintenanceApi = {
  list: (params) => api.get(`/maintenance${toQueryString(params)}`),
  get: (id) => api.get(`/maintenance/${id}`),
  preventiveSchedule: () => api.get('/maintenance/preventive-schedule'),
  preventiveScheduleAssets: (params) => api.get(`/maintenance/preventive-schedule/assets${toQueryString(params)}`),
  create: (payload) => api.post('/maintenance', payload),
  update: (id, payload) => api.put(`/maintenance/${id}`, payload),
  changeStage: (id, payload) => api.post(`/maintenance/${id}/stage`, payload),
  correctCost: (id, payload) => api.put(`/maintenance/${id}/cost`, payload),
  remove: (id, confirmation) => api.delete(`/maintenance/${id}`, { confirmation }),
};

export const fuelReportsApi = {
  siteRegister: (params, options) => api.get(`/fuel-reports/site-register${toQueryString(params)}`, options),
  assetConsumption: (params, options) => api.get(`/fuel-reports/asset-consumption${toQueryString(params)}`, options),
  collections: (params, options) => api.get(`/fuel-reports/collections${toQueryString(params)}`, options),
  collectionsByStation: (params, options) => api.get(`/fuel-reports/collections/by-station${toQueryString(params)}`, options),
  collectionsByCarrier: (params, options) => api.get(`/fuel-reports/collections/by-carrier${toQueryString(params)}`, options),
  externalFuel: (params, options) => api.get(`/fuel-reports/external-fuel${toQueryString(params)}`, options),
};

export const inventoryReportsApi = {
  stockRegister: (params, options) => api.get(`/inventory-reports/stock-register${toQueryString(params)}`, options),
  purchases: (params, options) => api.get(`/inventory-reports/purchases${toQueryString(params)}`, options),
  purchasesBySupplier: (params, options) => api.get(`/inventory-reports/purchases/by-supplier${toQueryString(params)}`, options),
  purchasesByItem: (params, options) => api.get(`/inventory-reports/purchases/by-item${toQueryString(params)}`, options),
  partsByAsset: (params, options) => api.get(`/inventory-reports/parts-by-asset${toQueryString(params)}`, options),
};

export const tyreApi = {
  list: (params) => api.get(`/tyres${toQueryString(params)}`),
  get: (id) => api.get(`/tyres/${id}`),
  create: (payload) => api.post('/tyres', payload),
  update: (id, payload) => api.put(`/tyres/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/tyres/${id}`, { confirmation }),
  restore: (id) => api.post(`/tyres/${id}/restore`),
  install: (id, payload) => api.post(`/tyres/${id}/install`, payload),
  fitments: (params) => api.get(`/tyres/history${toQueryString(params)}`),
  vehiclePositions: (vehicleId) => api.get(`/tyres/vehicles/${vehicleId}/positions`),
}

// What each role may do in the organization; the Admin's alone.
export const accessApi = {
  roles: () => api.get('/access/roles'),
  updateRole: (role, permissions) => api.put(`/access/roles/${role}`, { permissions }),
};

export const dashboardApi = {
  summary: (params) => api.get(`/dashboard/summary${toQueryString(params)}`),
  sites: (params) => api.get(`/dashboard/sites${toQueryString(params)}`),
  monthlyCost: (params) => api.get(`/dashboard/monthly-cost${toQueryString(params)}`),
  fleet: (params) => api.get(`/dashboard/fleet${toQueryString(params)}`),
  maintenance: (params) => api.get(`/dashboard/maintenance${toQueryString(params)}`),
};

async function uploadBrandingLogo(file) {
  const headers = { Accept: 'application/json' };
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const form = new FormData();
  form.append('logo', file);

  let response;
  try {
    response = await fetch(`${BASE_URL}/branding/logo`, { method: 'POST', headers, body: form });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }

  const payload = await readBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

async function fetchBrandingLogo(version, { signal } = {}) {
  const headers = {};
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}/branding/logo?v=${encodeURIComponent(version ?? '')}`, { headers, signal });
  if (!response.ok) {
    const payload = await readBody(response);
    throw new ApiError(response.status, payload?.error ?? `Request failed (${response.status})`);
  }
  return response.blob();
}

export const brandingApi = {
  get: () => api.get('/branding'),
  updateTitle: (dashboardTitle) => api.put('/branding/title', { dashboardTitle }),
  uploadLogo: uploadBrandingLogo,
  removeLogo: () => api.delete('/branding/logo'),
  fetchLogo: fetchBrandingLogo,
};

export const tyresApi = {
  types: (params) => api.get(`/tyres/types${toQueryString(params)}`),
  createType: (payload) => api.post('/tyres/types', payload),
  updateType: (id, payload) => api.put(`/tyres/types/${id}`, payload),
  purchases: (params) => api.get(`/tyres/purchases${toQueryString(params)}`),
  purchase: (id) => api.get(`/tyres/purchases/${id}`),
  createPurchase: (payload) => api.post('/tyres/purchases', payload),
  cancelPurchase: (id, confirmation) => api.delete(`/tyres/purchases/${id}`, { confirmation }),
  stock: (params) => api.get(`/tyres/stock${toQueryString(params)}`),
  fitments: (params) => api.get(`/tyres/fitments${toQueryString(params)}`),
  fit: (payload) => api.post('/tyres/fitments', payload),
  updateFitment: (id, payload) => api.put(`/tyres/fitments/${id}`, payload),
  assetReport: (params, options) => api.get(`/tyres/reports/assets${toQueryString(params)}`, options),
  assetTyres: (params, options) => api.get(`/tyres/reports/assets/tyres${toQueryString(params)}`, options),
  costReport: (params, options) => api.get(`/tyres/reports/costs${toQueryString(params)}`, options),
  costsByType: (params, options) => api.get(`/tyres/reports/costs/by-type${toQueryString(params)}`, options),
  costsBySupplier: (params, options) => api.get(`/tyres/reports/costs/by-supplier${toQueryString(params)}`, options),
};

export const batteriesApi = {
  list: (params) => api.get(`/batteries${toQueryString(params)}`),
  summary: (params) => api.get(`/batteries/summary${toQueryString(params)}`),
  get: (id) => api.get(`/batteries/${id}`),
  purchase: (payload) => api.post('/batteries/purchases', payload),
  fit: (payload) => api.post('/batteries/fit', payload),
  replace: (id, payload) => api.post(`/batteries/${id}/replace`, payload),
  remove: (id, payload) => api.post(`/batteries/${id}/remove`, payload),
  sendForRepair: (id, payload) => api.post(`/batteries/${id}/send-for-repair`, payload),
  repaired: (id, payload) => api.post(`/batteries/${id}/repaired`, payload),
  scrap: (id, payload) => api.post(`/batteries/${id}/scrap`, payload),
  update: (id, payload) => api.put(`/batteries/${id}`, payload),
  destroy: (id, confirmation) => api.delete(`/batteries/${id}`, { confirmation }),
  events: (params) => api.get(`/batteries/events${toQueryString(params)}`),
  costReport: (params) => api.get(`/batteries/reports/costs${toQueryString(params)}`),
};
