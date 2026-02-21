import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Log enriched audit event with chain of custody and before/after
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const {
      action,
      entity_type,
      entity_id,
      changes,
      severity = 'info',
      related_entities = []
    } = await req.json();

    console.log(`[enrichAuditLog] Logging: ${action} on ${entity_type}/${entity_id}`);

    const auditEntry = {
      action,
      entity_type,
      entity_id,
      actor_email: user?.email || 'system',
      actor_name: user?.full_name || 'System',
      severity, // info, warning, critical
      changes: changes || {},
      related_entities, // Chain of custody
      source: 'api', // api, ui, agent
      timestamp: new Date().toISOString(),
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown'
    };

    // Determine if alert is needed
    const alertActions = [
      'permission_changed',
      'permission_deleted',
      'user_deleted',
      'export_csv',
      'export_pdf',
      'delivery_sent',
      'report_approved',
      'report_rejected'
    ];

    if (alertActions.includes(action)) {
      auditEntry.alert_triggered = true;

      // Create security alert for admins
      try {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', 100);
        
        for (const admin of admins) {
          await base44.asServiceRole.entities.Notification.create({
            user_email: admin.email,
            title: `Security Alert: ${action}`,
            message: `${user?.full_name || 'System'} performed ${action} on ${entity_type}`,
            type: 'security',
            is_read: false,
            severity: severity === 'critical' ? 'high' : 'medium'
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('[enrichAuditLog] Could not create notifications:', e.message);
      }
    }

    // Store audit entry
    const stored = await base44.asServiceRole.entities.AuditLog.create(auditEntry);

    console.log(`[enrichAuditLog] Audit entry created: ${stored.id}`);

    return Response.json({
      success: true,
      audit_id: stored.id
    });

  } catch (error) {
    console.error('[enrichAuditLog] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});