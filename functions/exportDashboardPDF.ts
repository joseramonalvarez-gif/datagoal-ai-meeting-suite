import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Export Executive Dashboard to PDF with branding
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const { client_id, date_from, date_to } = await req.json();

    console.log(`[exportDashboardPDF] Generating PDF for client ${client_id}`);

    // Fetch analytics data
    const [snapshots, deliveries, tasks] = await Promise.all([
      base44.asServiceRole.entities.AnalyticsSnapshot.filter(
        { client_id, snapshot_date: { '$gte': date_from, '$lte': date_to } },
        '-snapshot_date',
        30
      ),
      base44.asServiceRole.entities.DeliveryRun.filter(
        { status: 'delivered' },
        '-sent_at',
        100
      ),
      base44.asServiceRole.entities.Task.filter(
        { client_id, status: 'done' },
        '-created_date',
        50
      )
    ]);

    // Calculate aggregates
    const metrics = calculateMetrics(snapshots);

    // Generate HTML content
    const html = generatePDFHTML(user, metrics, snapshots, deliveries, tasks);

    // Use jsPDF to generate PDF
    const { jsPDF } = await import('npm:jspdf@4.0.0');
    const { html2canvas } = await import('npm:html2canvas@1.4.1');

    const canvas = await html2canvas(new DOMParser().parseFromString(html, 'text/html').body, {
      scale: 2,
      useCORS: true
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const pdfBuffer = doc.output('arraybuffer');

    // Log export to audit trail
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'dashboard_exported_pdf',
      entity_type: 'Dashboard',
      entity_id: client_id,
      actor_email: user.email,
      actor_name: user.full_name,
      severity: 'info',
      changes: { date_range: { from: date_from, to: date_to } }
    }).catch(() => {});

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=dashboard_${new Date().toISOString().split('T')[0]}.pdf`
      }
    });

  } catch (error) {
    console.error('[exportDashboardPDF] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateMetrics(snapshots) {
  if (snapshots.length === 0) {
    return {
      avg_lead_time: 0,
      task_completion_rate: 0,
      billable_ratio: 0,
      quality_score: 0,
      deliveries: 0
    };
  }

  const latestSnapshot = snapshots[0];
  return {
    avg_lead_time: latestSnapshot.kpis?.lead_time_days || 0,
    task_completion_rate: latestSnapshot.kpis?.task_completion_rate || 0,
    billable_ratio: latestSnapshot.kpis?.billable_ratio || 0,
    quality_score: latestSnapshot.kpis?.quality_score || 0,
    deliveries: latestSnapshot.metrics?.deliveries_completed || 0
  };
}

function generatePDFHTML(user, metrics, snapshots, deliveries, tasks) {
  const now = new Date().toLocaleString('es-ES');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Executive Dashboard</title>
      <style>
        * { margin: 0; padding: 0; }
        body { font-family: 'Arial', sans-serif; color: #1B2731; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #1B2731 0%, #33A19A 100%); color: white; padding: 40px; text-align: center; }
        .header h1 { font-size: 32px; margin-bottom: 10px; }
        .header p { font-size: 14px; opacity: 0.9; }
        .container { max-width: 900px; margin: 0 auto; padding: 30px 20px; }
        .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
        .metric-card { background: #FFFAF3; border: 2px solid #B7CAC9; border-radius: 8px; padding: 20px; text-align: center; }
        .metric-value { font-size: 28px; font-weight: bold; color: #33A19A; margin: 10px 0; }
        .metric-label { font-size: 12px; color: #3E4C59; text-transform: uppercase; }
        .section { margin: 30px 0; page-break-inside: avoid; }
        .section-title { font-size: 18px; font-weight: bold; color: #1B2731; border-bottom: 3px solid #33A19A; padding-bottom: 10px; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #1B2731; color: white; padding: 10px; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #B7CAC9; }
        tr:nth-child(even) { background: #FFFAF3; }
        .footer { text-align: center; color: #3E4C59; font-size: 11px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #B7CAC9; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Executive Dashboard</h1>
        <p>Strategic Knowledge Center | Data Goal</p>
      </div>

      <div class="container">
        <p style="color: #3E4C59; font-size: 12px; margin-bottom: 20px;">
          <strong>Generated:</strong> ${now} | <strong>By:</strong> ${user.full_name} | <strong>Email:</strong> ${user.email}
        </p>

        <div class="section">
          <div class="section-title">📊 Key Performance Indicators</div>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">Lead Time (Days)</div>
              <div class="metric-value">${metrics.avg_lead_time.toFixed(1)}</div>
              <p style="font-size: 11px; color: #3E4C59;">From meeting to delivery</p>
            </div>
            <div class="metric-card">
              <div class="metric-label">Task Completion Rate</div>
              <div class="metric-value">${(metrics.task_completion_rate * 100).toFixed(0)}%</div>
              <p style="font-size: 11px; color: #3E4C59;">Tasks closed on time</p>
            </div>
            <div class="metric-card">
              <div class="metric-label">Billable Ratio</div>
              <div class="metric-value">${(metrics.billable_ratio * 100).toFixed(0)}%</div>
              <p style="font-size: 11px; color: #3E4C59;">Hours billable</p>
            </div>
            <div class="metric-card">
              <div class="metric-label">Quality Score</div>
              <div class="metric-value">${(metrics.quality_score * 100).toFixed(0)}%</div>
              <p style="font-size: 11px; color: #3E4C59;">QA average</p>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📦 Recent Deliveries</div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Quality Score</th>
                <th>Sent At</th>
              </tr>
            </thead>
            <tbody>
              ${deliveries.slice(0, 10).map(d => `
                <tr>
                  <td>${d.id.substring(0, 8)}</td>
                  <td><strong>${d.status}</strong></td>
                  <td>${(d.quality_score * 100).toFixed(0)}%</td>
                  <td>${d.sent_at ? new Date(d.sent_at).toLocaleString('es-ES') : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">✅ Completed Tasks</div>
          <p style="color: #3E4C59; font-size: 12px; margin-bottom: 10px;">
            Total: <strong>${tasks.length}</strong> tasks completed
          </p>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Project</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.slice(0, 8).map(t => `
                <tr>
                  <td>${t.title}</td>
                  <td>${t.project_id.substring(0, 8)}</td>
                  <td>${t.created_date ? new Date(t.created_date).toLocaleDateString('es-ES') : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>This report is confidential and intended for authorized recipients only.</p>
          <p>Data Goal © 2026 | All rights reserved</p>
        </div>
      </div>
    </body>
    </html>
  `;
}