const ROLES = {
  ADMIN: 'admin',
  CONSULTOR: 'consultor',
  LIDER_PROYECTO: 'lider_proyecto',
  COLABORADOR: 'colaborador',
  CLIENTE: 'cliente',
  GERENCIA: 'gerencia',
  DIRECTOR_AREA: 'director_area',
  STAFF: 'staff',
};

const ROLE_PERMISSIONS = {
  admin: ['manage_gpt_config', 'trigger_analysis', 'view_insights', 'view_all_projects', 'manage_users', 'manage_permissions', 'view_audit'],
  consultor: ['trigger_analysis', 'view_insights', 'create_meetings', 'create_tasks', 'manage_automations'],
  lider_proyecto: ['view_insights', 'create_meetings', 'create_tasks', 'assign_tasks', 'manage_project_users'],
  colaborador: ['view_insights', 'create_tasks'],
  cliente: ['view_insights', 'view_reports'],
  gerencia: ['view_insights', 'view_reports', 'approve_reports'],
  director_area: ['view_insights', 'view_reports', 'approve_reports', 'manage_area_users'],
  staff: ['view_basic_data'],
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

export function canManageUsers(userRole) {
  return hasPermission(userRole, 'manage_users');
}

export function canCreateMeetings(userRole) {
  return hasPermission(userRole, 'create_meetings');
}

export function canCreateTasks(userRole) {
  return hasPermission(userRole, 'create_tasks');
}

export function canApproveReports(userRole) {
  return hasPermission(userRole, 'approve_reports');
}

export function getRoleLabel(role) {
  const labels = {
    admin: 'Administrador',
    consultor: 'Consultor',
    lider_proyecto: 'Líder de Proyecto',
    colaborador: 'Colaborador',
    cliente: 'Cliente',
    gerencia: 'Gerencia',
    director_area: 'Director de Área',
    staff: 'Staff',
  };
  return labels[role] || 'Usuario';
}

export { ROLES };