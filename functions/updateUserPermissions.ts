import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Update user permissions in PermissionMatrix
 * Handles granular permissions by module/action and scope
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can update permissions
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const {
      user_email,
      role,
      client_id = null,
      project_id = null,
      permissions = {},
      is_active = true
    } = await req.json();

    console.log(`[updateUserPermissions] Updating permissions for ${user_email}`);

    // Check if permission matrix exists for this user+scope
    const existing = await base44.asServiceRole.entities.PermissionMatrix.filter(
      { user_email, client_id, project_id },
      '-created_date',
      1
    );

    let result;
    if (existing.length > 0) {
      result = await base44.asServiceRole.entities.PermissionMatrix.update(existing[0].id, {
        role,
        permissions,
        is_active
      });
    } else {
      result = await base44.asServiceRole.entities.PermissionMatrix.create({
        user_email,
        role,
        client_id,
        project_id,
        permissions,
        is_active,
        created_by: user.email
      });
    }

    // Log to audit trail
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'permission_changed',
      entity_type: 'PermissionMatrix',
      entity_id: result.id,
      actor_email: user.email,
      actor_name: user.full_name,
      severity: 'warning',
      changes: {
        user_email,
        role,
        scope: { client_id, project_id },
        permissions: Object.keys(permissions).length
      }
    }).catch(() => {});

    console.log(`[updateUserPermissions] Permissions updated for ${user_email}`);

    return Response.json({
      success: true,
      permission_id: result.id,
      user_email,
      role
    });

  } catch (error) {
    console.error('[updateUserPermissions] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});