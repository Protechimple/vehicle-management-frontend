import { createRequest, toQueryString } from './client';
import { readPlatformToken, clearPlatformSession } from './session';

export const PLATFORM_SESSION_EXPIRED_EVENT = 'vmms:platform-session-expired';

const request = createRequest({
  getToken: readPlatformToken,
  onUnauthorized: (response, token) => {
    if (response.status === 401 && token) {
      clearPlatformSession();
      window.dispatchEvent(new CustomEvent(PLATFORM_SESSION_EXPIRED_EVENT));
    }
  },
});

const tenantPath = (tenantId) => `/platform/tenants/${encodeURIComponent(tenantId)}`;

export const platformApi = {
  logIn: (payload) => request('POST', '/platform/auth/login', payload),
  logOut: () => request('POST', '/platform/auth/logout'),
  changeOwnPassword: (payload) => request('PUT', '/platform/auth/password', payload),

  overview: () => request('GET', '/platform/overview'),
  activity: (params) => request('GET', `/platform/activity${toQueryString(params)}`),
  tenantActivity: (tenantId, params) => request('GET', `${tenantPath(tenantId)}/activity${toQueryString(params)}`),

  listTenants: (params) => request('GET', `/platform/tenants${toQueryString(params)}`),
  getTenant: (tenantId) => request('GET', tenantPath(tenantId)),
  createTenant: (payload) => request('POST', '/platform/tenants', payload),
  updateTenant: (tenantId, payload) => request('PUT', tenantPath(tenantId), payload),
  setTenantStatus: (tenantId, status) => request('PATCH', `${tenantPath(tenantId)}/status`, { status }),
  resetAdminPassword: (tenantId, password) => request('PUT', `${tenantPath(tenantId)}/admin-password`, { password }),
};
