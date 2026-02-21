const ROLES = {
  ADMIN: 'admin',
  ANALYST: 'analyst',
  VIEWER: 'viewer',
};

const ROLE_PERMISSIONS = {
  admin: ['manage_gpt_config', 'trigger_analysis', 'view_insights', 'view_all_projects'],
  analyst: ['trigger_analysis', 'view_insights'],
  viewer: ['view_insights'],
};

export function hasPermission(userRole, permission) {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
}

export function canManageGPT(userRole) {
  return hasPermission(userRole, 'manage_gpt_config');
}

export function canTriggerAnalysis(userRole) {
  return hasPermission(userRole, 'trigger_analysis');
}

export function canViewInsights(userRole) {
  return hasPermission(userRole, 'view_insights');
}

export function getRoleLabel(role) {
  const labels = {
    admin: 'Administrador',
    analyst: 'Analista',
    viewer: 'Visor',
  };
  return labels[role] || 'Usuario';
}

export { ROLES };