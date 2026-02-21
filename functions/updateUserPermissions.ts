import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Update permissions for a user
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();

    if (!admin || admin.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email, role, client_id, permissions } = await req.json();

    if (!user_email || !role) {
      return Response.json({ 
        error: 'user_email and role required' 
      }, { status: 400 });
    }

    console.log(`[updateUserPermissions] Updating ${user_email} to role ${role}`);

    // Check if permission matrix exists
    let matrix = await base44.asServiceRole.entities.PermissionMatrix.filter(
      { user_email, client_id: client_id || null }
    ).then(r => r[0]);

    if (matrix) {
      // Update existing
      matrix = await base44.asServiceRole.entities.PermissionMatrix.update(matrix.id, {
        role,
        permissions: permissions || matrix.permissions,
        is_active: true
      });
    } else {
      // Create new
      matrix = await base44.asServiceRole.entities.PermissionMatrix.create({
        user_email,
        role,
        client_id: client_id || null,
        permissions: permissions || getDefaultPermissions(role),
        is_active: true,
        created_by: admin.email
      });
    }

    // Log to audit
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'permission_updated',
      actor_email: admin.email,
      target_email: user_email,
      changes: { role, client_id, permissions },
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return Response.json({
      success: true,
      matrix: matrix
    });

  } catch (error) {
    console.error('[updateUserPermissions] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});

function getDefaultPermissions(role) {
  const templates = {
    admin: {
      meetings: { create: true, edit: true, delete: true, view_all: true },
      tasks: { create: true, edit: true, assign: true, delete: true, view_all: true },
      reports: { generate: true, approve: true, send: true, view_all: true },
      analytics: { view: true, export: true },
      admin: { manage_users: true, manage_permissions: true, view_audit: true, manage_settings: true }
    },
    analyst: {
      meetings: { create: true, edit: true, delete: false, view_all: true },
      tasks: { create: true, edit: true, assign: true, delete: false, view_all: true },
      reports: { generate: true, approve: false, send: true, view_all: true },
      analytics: { view: true, export: true },
      admin: { manage_users: false, manage_permissions: false, view_audit: false, manage_settings: false }
    },
    consultant: {
      meetings: { create: true, edit: true, delete: false, view_all: false },
      tasks: { create: true, edit: true, assign: false, delete: false, view_all: false },
      reports: { generate: true, approve: false, send: false, view_all: false },
      analytics: { view: true, export: false },
      admin: { manage_users: false, manage_permissions: false, view_audit: false, manage_settings: false }
    },
    viewer: {
      meetings: { create: false, edit: false, delete: false, view_all: true },
      tasks: { create: false, edit: false, assign: false, delete: false, view_all: true },
      reports: { generate: false, approve: false, send: false, view_all: true },
      analytics: { view: true, export: false },
      admin: { manage_users: false, manage_permissions: false, view_audit: false, manage_settings: false }
    }
  };
  return templates[role] || templates.viewer;
}