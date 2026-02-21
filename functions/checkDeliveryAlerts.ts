import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Scheduled automation to check alert rules and trigger notifications
 * Run every 5 minutes via base44 scheduled automation
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('[checkDeliveryAlerts] Starting alert check...');

    // Fetch all active alert rules
    const rules = await base44.asServiceRole.entities.AlertRule.filter(
      { is_active: true },
      '-created_date',
      1000
    );

    console.log(`[checkDeliveryAlerts] Found ${rules.length} active rules`);

    for (const rule of rules) {
      try {
        const shouldTrigger = await evaluateRule(base44, rule);

        if (shouldTrigger) {
          console.log(`[checkDeliveryAlerts] Triggering rule: ${rule.name}`);

          // Create notifications for recipients
          for (const recipientEmail of rule.recipient_emails) {
            if (rule.notify_via.includes('in_app')) {
              await base44.asServiceRole.entities.Notification.create({
                user_email: recipientEmail,
                title: `Alerta: ${rule.name}`,
                message: rule.description,
                type: 'alert',
                severity: rule.severity,
                is_read: false
              }).catch(e => console.warn('Could not create notification:', e.message));
            }

            if (rule.notify_via.includes('email')) {
              await base44.integrations.Core.SendEmail({
                to: recipientEmail,
                subject: `🚨 Alerta de Sistema: ${rule.name}`,
                body: `${rule.description}\n\nSeveridad: ${rule.severity}\n\nTiempo: ${new Date().toLocaleString('es-ES')}`
              }).catch(e => console.warn('Could not send email:', e.message));
            }
          }

          // Update rule trigger count and timestamp
          await base44.asServiceRole.entities.AlertRule.update(rule.id, {
            trigger_count: (rule.trigger_count || 0) + 1,
            last_triggered: new Date().toISOString()
          }).catch(() => {});

          // Log to audit trail
          await base44.asServiceRole.entities.AuditLog.create({
            action: 'alert_triggered',
            entity_type: 'AlertRule',
            entity_id: rule.id,
            actor_email: 'system',
            actor_name: 'Alert System',
            severity: rule.severity,
            changes: { rule_name: rule.name, recipients: rule.recipient_emails }
          }).catch(() => {});
        }
      } catch (err) {
        console.error(`[checkDeliveryAlerts] Error processing rule ${rule.id}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      rules_checked: rules.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[checkDeliveryAlerts] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});

/**
 * Evaluate if an alert rule should trigger based on conditions
 */
async function evaluateRule(base44, rule) {
  const { alert_type, trigger_condition } = rule;

  try {
    switch (alert_type) {
      case 'delivery_failed':
        // Check for failed deliveries in last 30 minutes
        const failedDeliveries = await base44.asServiceRole.entities.DeliveryRun.filter(
          { status: 'failed' },
          '-created_date',
          10
        );
        return failedDeliveries.length > 0;

      case 'task_overdue':
        // Check for overdue tasks
        const now = new Date();
        const overdueTasks = await base44.asServiceRole.entities.Task.filter(
          { status: { '$nin': ['done'] } },
          '-due_date',
          100
        );
        return overdueTasks.some(t => t.due_date && new Date(t.due_date) < now);

      case 'high_priority_task_stuck':
        // Check for high-priority tasks stuck in same status for long time
        const stuckTasks = await base44.asServiceRole.entities.Task.filter(
          { priority: 'urgent', status: 'in_progress' },
          '-updated_date',
          50
        );
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return stuckTasks.some(t => new Date(t.updated_date) < oneHourAgo);

      case 'proposal_pending':
        // Check for pending proposals
        const pendingProposals = await base44.asServiceRole.entities.Document.filter(
          { type: 'proposal', status: 'pending' },
          '-created_date',
          50
        );
        return pendingProposals.length > 0;

      case 'automation_failed':
        // Check for failed automation runs
        const failedAutomations = await base44.asServiceRole.entities.AutomationRun.filter(
          { status: 'failed' },
          '-executed_at',
          20
        );
        return failedAutomations.length > 0;

      default:
        return false;
    }
  } catch (err) {
    console.error(`[evaluateRule] Error evaluating ${alert_type}:`, err.message);
    return false;
  }
}