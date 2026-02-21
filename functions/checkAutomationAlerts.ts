import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all active alert rules
    const rules = await base44.asServiceRole.entities.AlertRule.filter({ is_active: true });

    const alerts = [];

    for (const rule of rules) {
      try {
        let triggered = false;
        let details = '';

        // Check different alert types
        if (rule.alert_type === 'automation_failed') {
          const failedRuns = await base44.asServiceRole.entities.AutomationRun.filter({
            status: 'failed'
          }, '-executed_at', 5);

          if (failedRuns.length > 0) {
            triggered = true;
            details = `${failedRuns.length} automatizaciones fallaron en las últimas horas`;
          }
        }

        if (rule.alert_type === 'task_overdue') {
          const today = new Date().toISOString().split('T')[0];
          const overdueTasks = await base44.asServiceRole.entities.Task.filter({
            status: { $ne: 'done' }
          });

          const overdue = overdueTasks.filter(t => t.due_date && t.due_date < today);
          if (overdue.length > 0) {
            triggered = true;
            details = `${overdue.length} tareas vencidas sin completar`;
          }
        }

        if (rule.alert_type === 'meeting_no_followup') {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const meetings = await base44.asServiceRole.entities.Meeting.filter({
            created_date: { $gte: thirtyDaysAgo },
            status: 'closed'
          });

          const noFollowUp = meetings.filter(m => !m.notes?.includes('follow'));
          if (noFollowUp.length > 0) {
            triggered = true;
            details = `${noFollowUp.length} reuniones cerradas sin follow-up programado`;
          }
        }

        if (rule.alert_type === 'high_priority_task_stuck') {
          const stuckTasks = await base44.asServiceRole.entities.Task.filter({
            priority: 'urgent',
            status: { $in: ['todo', 'backlog'] }
          });

          const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
          const reallyStuck = stuckTasks.filter(t => t.created_date < twoWeeksAgo);

          if (reallyStuck.length > 0) {
            triggered = true;
            details = `${reallyStuck.length} tareas URGENTES sin iniciar por 14+ días`;
          }
        }

        if (triggered) {
          const alert = await base44.asServiceRole.entities.Notification.create({
            user_email: rule.recipient_emails?.[0] || 'admin@datagoal.com',
            title: `⚠️ Alerta: ${rule.name}`,
            message: details,
            type: 'alert',
            severity: rule.severity,
            is_read: false
          });

          // Send email if configured
          if (rule.notify_via?.includes('email')) {
            try {
              await base44.integrations.Core.SendEmail({
                to: rule.recipient_emails?.join(',') || 'admin@datagoal.com',
                subject: `⚠️ [${rule.severity.toUpperCase()}] ${rule.name}`,
                body: `<h3>${rule.name}</h3><p>${details}</p><p><strong>Regla:</strong> ${rule.description}</p>`
              });
            } catch (emailErr) {
              console.error('Email send error:', emailErr);
            }
          }

          // Update rule last triggered
          await base44.asServiceRole.entities.AlertRule.update(rule.id, {
            last_triggered: new Date().toISOString(),
            trigger_count: (rule.trigger_count || 0) + 1
          });

          alerts.push({
            rule_id: rule.id,
            rule_name: rule.name,
            notification_id: alert.id,
            triggered: true,
            details
          });
        }
      } catch (err) {
        console.error(`Error checking rule ${rule.id}:`, err);
        alerts.push({
          rule_id: rule.id,
          rule_name: rule.name,
          triggered: false,
          error: err.message
        });
      }
    }

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      rules_checked: rules.length,
      alerts_triggered: alerts.filter(a => a.triggered).length,
      alerts
    });
  } catch (error) {
    console.error('Alert check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});