import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Send weekly performance digest via email
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('[sendWeeklyPerformanceDigest] Generating and sending digest');

    // Get all users with admin role
    const users = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    
    if (users.length === 0) {
      console.log('[sendWeeklyPerformanceDigest] No admin users found');
      return Response.json({ success: true, message: 'No admin users to notify' });
    }

    // Generate report
    const response = await base44.asServiceRole.functions.invoke('generatePerformanceReport', {
      days: 7
    });

    const report = response;

    // Get access token for Gmail
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('gmail');

    // Send email to each admin
    let sent = 0;
    for (const user of users) {
      try {
        const htmlBody = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1B2731; }
                h2 { color: #33A19A; border-bottom: 2px solid #33A19A; padding-bottom: 10px; }
                .stat-box { display: inline-block; margin: 10px 20px 10px 0; }
                .stat-number { font-size: 24px; font-weight: bold; }
                .stat-label { font-size: 12px; color: #3E4C59; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #E8F5F4; color: #1B2731; padding: 10px; text-align: left; }
                td { padding: 8px; border-bottom: 1px solid #B7CAC9; }
                .success { color: #22c55e; font-weight: bold; }
                .failed { color: #ef4444; font-weight: bold; }
              </style>
            </head>
            <body>
              <h1>📊 Resumen de Desempeño Semanal</h1>
              <p>Reporte del ${report.period.from} al ${report.period.to}</p>

              <h2>Resumen Ejecutivo</h2>
              <div class="stat-box">
                <div class="stat-number">${report.summary.total}</div>
                <div class="stat-label">Total de Entregas</div>
              </div>
              <div class="stat-box">
                <div class="stat-number success">${report.summary.successRate.toFixed(1)}%</div>
                <div class="stat-label">Tasa de Éxito</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">${report.summary.avgQuality.toFixed(1)}%</div>
                <div class="stat-label">Calidad Promedio</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">${report.summary.avgTimeSeconds}s</div>
                <div class="stat-label">Tiempo Promedio</div>
              </div>

              <h2>Resultados</h2>
              <table>
                <tr>
                  <th>Métrica</th>
                  <th>Valor</th>
                </tr>
                <tr>
                  <td>Entregas Exitosas</td>
                  <td class="success">${report.summary.successful}</td>
                </tr>
                <tr>
                  <td>Entregas Fallidas</td>
                  <td class="failed">${report.summary.failed}</td>
                </tr>
                <tr>
                  <td>Entregas Pendientes</td>
                  <td>${report.summary.pending}</td>
                </tr>
              </table>

              <h2>Desempeño por Template</h2>
              <table>
                <tr>
                  <th>Template</th>
                  <th>Cantidad</th>
                  <th>Éxito</th>
                  <th>Tiempo Promedio</th>
                </tr>
                ${Object.entries(report.by_template).map(([name, stats]) => `
                  <tr>
                    <td>${name}</td>
                    <td>${stats.count}</td>
                    <td class="success">${stats.successRate.toFixed(0)}%</td>
                    <td>${stats.avgTime}s</td>
                  </tr>
                `).join('')}
              </table>

              <hr style="margin-top: 30px; color: #B7CAC9;">
              <p style="font-size: 12px; color: #3E4C59;">
                Este reporte fue generado automáticamente. Para más detalles, visita el dashboard de DeliveryAnalytics.
              </p>
            </body>
          </html>
        `;

        const base64Body = Buffer.from(
          `To: ${user.email}\r\nSubject: 📊 Resumen Semanal de Desempeño\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${htmlBody}`
        ).toString('base64');

        await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ raw: base64Body })
        });

        sent++;
        console.log(`[sendWeeklyPerformanceDigest] Email sent to ${user.email}`);
      } catch (error) {
        console.error(`[sendWeeklyPerformanceDigest] Failed to send to ${user.email}:`, error.message);
      }
    }

    console.log(`[sendWeeklyPerformanceDigest] Sent ${sent}/${users.length} digests`);

    return Response.json({
      success: true,
      sent,
      total: users.length,
      message: `Digest enviado a ${sent} administradores`
    });

  } catch (error) {
    console.error('[sendWeeklyPerformanceDigest] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});