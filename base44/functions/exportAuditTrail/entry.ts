import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Export audit trail for compliance (PDF/CSV)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const {
      date_from,
      date_to,
      action_filter,
      entity_filter,
      format = 'csv'
    } = await req.json();

    console.log(`[exportAuditTrail] Exporting audit trail from ${date_from} to ${date_to}`);

    // Fetch audit logs
    const allLogs = await base44.asServiceRole.entities.AuditLog.filter({}, '-timestamp', 10000);

    let filtered = allLogs;
    if (date_from) {
      filtered = filtered.filter(l => new Date(l.timestamp) >= new Date(date_from));
    }
    if (date_to) {
      filtered = filtered.filter(l => new Date(l.timestamp) <= new Date(date_to));
    }
    if (action_filter) {
      filtered = filtered.filter(l => l.action.includes(action_filter));
    }
    if (entity_filter) {
      filtered = filtered.filter(l => l.entity_type === entity_filter);
    }

    let output = '';

    if (format === 'csv') {
      output = 'Timestamp,Action,Entity Type,Entity ID,Actor,Severity,Changes,Alert\n';
      filtered.forEach(log => {
        const changes = log.changes ? JSON.stringify(log.changes).replace(/"/g, '""') : '';
        output += `"${log.timestamp}","${log.action}","${log.entity_type}","${log.entity_id}","${log.actor_email}","${log.severity}","${changes}","${log.alert_triggered ? 'Yes' : 'No'}"\n`;
      });
    } else if (format === 'json') {
      output = JSON.stringify(filtered, null, 2);
    } else if (format === 'html') {
      output = generateHTMLReport(filtered);
    }

    // Log the export itself
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'audit_exported',
      entity_type: 'AuditLog',
      entity_id: 'bulk',
      actor_email: user.email,
      actor_name: user.full_name,
      severity: 'info',
      changes: { count: filtered.length, format, date_range: { from: date_from, to: date_to } }
    }).catch(() => {});

    return Response.json({
      success: true,
      content: output,
      format: format,
      record_count: filtered.length,
      filename: `audit_trail_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : format === 'json' ? 'json' : 'html'}`
    });

  } catch (error) {
    console.error('[exportAuditTrail] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});

function generateHTMLReport(logs) {
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Audit Trail Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #1B2731; }
        h1 { color: #33A19A; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #1B2731; color: white; padding: 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #B7CAC9; }
        tr:hover { background: #FFFAF3; }
        .critical { color: #d32f2f; font-weight: bold; }
        .warning { color: #f57c00; }
        .alert { background: #fff3cd; }
      </style>
    </head>
    <body>
      <h1>Audit Trail Report</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <table>
        <tr>
          <th>Timestamp</th>
          <th>Action</th>
          <th>Entity</th>
          <th>Actor</th>
          <th>Severity</th>
          <th>Alert</th>
        </tr>
  `;

  logs.forEach(log => {
    const severityClass = log.severity === 'critical' ? 'critical' : log.severity === 'warning' ? 'warning' : '';
    const alertClass = log.alert_triggered ? 'alert' : '';
    html += `
      <tr class="${alertClass}">
        <td>${log.timestamp}</td>
        <td>${log.action}</td>
        <td>${log.entity_type}/${log.entity_id}</td>
        <td>${log.actor_email}</td>
        <td class="${severityClass}">${log.severity}</td>
        <td>${log.alert_triggered ? '⚠️ Alert' : '-'}</td>
      </tr>
    `;
  });

  html += `
      </table>
    </body>
    </html>
  `;
  return html;
}