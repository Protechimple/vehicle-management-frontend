export const ROLES = Object.freeze({
  ADMIN: 'admin',
  SITE_MANAGER: 'site_manager',
  SUPERVISOR: 'supervisor',
  INVENTORY_SUPERVISOR: 'inventory_supervisor',
});

export const ROLE_LABELS = Object.freeze({
  admin: 'Admin',
  site_manager: 'Site Manager',
  supervisor: 'Supervisor',
  inventory_supervisor: 'Inventory Supervisor',
});

// The roles an Admin creates logins for. Each may be given one site or several.
export const MEMBER_ROLES = Object.freeze([ROLES.SITE_MANAGER, ROLES.SUPERVISOR, ROLES.INVENTORY_SUPERVISOR]);
export const MULTI_SITE_ROLES = MEMBER_ROLES;

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? role;
}

// The built-in rules, used only until the server has sent this user's own permissions.
const BOTH = [ROLES.ADMIN, ROLES.SUPERVISOR];
const ADMIN_ONLY = [ROLES.ADMIN];

const standardModule = { CREATE: BOTH, READ: BOTH, UPDATE: BOTH, DELETE: ADMIN_ONLY, RESTORE: ADMIN_ONLY };

export const PERMISSIONS = Object.freeze({
  VEHICLE: standardModule,
  MACHINERY: standardModule,
  MAINTENANCE: { ...standardModule, UPDATE_COST: ADMIN_ONLY },
  SERVICE: standardModule,
  TYRE: standardModule,
  BATTERY: { ...standardModule, SCRAP: BOTH, EDIT_DETAILS: ADMIN_ONLY },
  FUEL: standardModule,
  ADBLUE: standardModule,
  COMPLIANCE: standardModule,
  SITE: { ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY, ASSIGN: ADMIN_ONLY },
  DOCUMENT: { CREATE: BOTH, READ: BOTH },

  ITEM_CATEGORY: { ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY },
  UOM: { ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY },
  ITEM: { ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY },
  SUPPLIER: { ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY },

  PURCHASE: { CREATE: BOTH, READ: BOTH, UPDATE: BOTH, RECEIVE: BOTH },
  STOCK: { READ: BOTH },

  ASSET_ISSUE: { CREATE: BOTH, READ: BOTH, REVERSE: BOTH },

  STOCK_ADJUSTMENT: { CREATE: BOTH, READ: BOTH },
  STOCK_TRANSFER: { CREATE: ADMIN_ONLY, READ: ADMIN_ONLY, RECEIVE: ADMIN_ONLY },

  FUEL_STATION: { ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY },
  FUEL_COLLECTION: { CREATE: BOTH, READ: BOTH, UPDATE: BOTH, RECEIVE: BOTH, CANCEL: ADMIN_ONLY },
  FUEL_STOCK: { READ: BOTH },

  REPORTS: { VIEW: BOTH, PRINT: BOTH, EXPORT: ADMIN_ONLY },
  USERS: {
    LIST: ADMIN_ONLY,
    CREATE_SUPERVISOR: ADMIN_ONLY,
    UPDATE_SUPERVISOR: ADMIN_ONLY,
    SET_SUPERVISOR_STATUS: ADMIN_ONLY,
    CHANGE_SUPERVISOR_PASSWORD: ADMIN_ONLY,
    VIEW_OWN_PROFILE: BOTH,
    UPDATE_OWN_PROFILE: ADMIN_ONLY,
    CHANGE_OWN_PASSWORD: ADMIN_ONLY,
  },
  DASHBOARD: { VIEW: BOTH, VIEW_SUMMARY_METRICS: BOTH },
  BRANDING: { READ: BOTH, UPDATE: ADMIN_ONLY },
});

export function hasPermission(role, resource, action) {
  const allowed = PERMISSIONS[resource]?.[action];
  return Array.isArray(allowed) && allowed.includes(role);
}

// What this user may do. The server sends the full list at sign-in and on every refresh, including the Admin's
// per-role and per-user choices, so this is what decides which screens and buttons appear.
export function userCan(user, resource, action) {
  if (!user) return false;
  if (Array.isArray(user.permissions)) return user.permissions.includes(`${resource}:${action}`);
  return hasPermission(user.role, resource, action);
}
