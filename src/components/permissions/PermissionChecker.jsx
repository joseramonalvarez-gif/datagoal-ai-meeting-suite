import { base44 } from '@/api/base44Client';

export async function checkPermission(userEmail, action, resource) {
  try {
    const permissions = await base44.entities.PermissionMatrix.filter({
      user_email: userEmail
    });

    if (!permissions || permissions.length === 0) return false;

    const userPermission = permissions[0];
    const [module, permission] = action.split(':');

    return userPermission.permissions?.[module]?.[permission] || false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

export async function canAccessQuery(userEmail, queryId, user) {
  try {
    const query = await base44.entities.SavedQuery.list({ id: queryId });
    if (!query || query.length === 0) return false;

    const q = query[0];

    // Owner always has access
    if (q.author_email === userEmail) return true;

    // Private queries only for owner
    if (q.permissions?.is_private) return false;

    // Check specific permissions
    const canView = q.permissions?.can_view?.includes(userEmail) || false;
    return canView;
  } catch (error) {
    console.error('Error checking query access:', error);
    return false;
  }
}

export async function canAccessReport(userEmail, reportId) {
  try {
    const report = await base44.entities.CustomReport.list({ id: reportId });
    if (!report || report.length === 0) return false;

    const r = report[0];

    // Owner always has access
    if (r.author_email === userEmail) return true;

    // Private reports only for owner
    if (r.permissions?.is_private) return false;

    // Check specific permissions
    const canView = r.permissions?.can_view?.includes(userEmail) || false;
    return canView;
  } catch (error) {
    console.error('Error checking report access:', error);
    return false;
  }
}

export async function hasEditPermission(userEmail, resourceType, resourceId) {
  try {
    if (resourceType === 'query') {
      const query = await base44.entities.SavedQuery.list({ id: resourceId });
      if (!query || query.length === 0) return false;
      const q = query[0];
      if (q.author_email === userEmail) return true;
      return q.permissions?.can_edit?.includes(userEmail) || false;
    } else if (resourceType === 'report') {
      const report = await base44.entities.CustomReport.list({ id: resourceId });
      if (!report || report.length === 0) return false;
      const r = report[0];
      if (r.author_email === userEmail) return true;
      return r.permissions?.can_edit?.includes(userEmail) || false;
    }
    return false;
  } catch (error) {
    console.error('Error checking edit permission:', error);
    return false;
  }
}