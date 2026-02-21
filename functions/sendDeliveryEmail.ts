import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { delivery_run_id, recipients, subject_template } = await req.json();

    if (!delivery_run_id || !recipients || recipients.length === 0) {
      return Response.json({ error: 'delivery_run_id and recipients required' }, { status: 400 });
    }

    const deliveryRun = await base44.entities.DeliveryRun.read(delivery_run_id);
    if (!deliveryRun) {
      return Response.json({ error: 'DeliveryRun not found' }, { status: 404 });
    }

    const report = await base44.entities.Report.read(deliveryRun.trigger_entity_id);
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    const meeting = await base44.entities.Meeting.read(report.meeting_id);
    if (!meeting) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Build email subject
    const emailSubject = subject_template || `Informe: ${meeting.title}`;

    // Convert markdown to HTML (simple approach)
    const htmlContent = `
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    h1, h2, h3 { color: #1B2731; }
    .header { background: #FFFAF3; padding: 20px; border-bottom: 3px solid #33A19A; }
    .content { padding: 20px; max-width: 800px; }
    .footer { background: #1B2731; color: white; padding: 20px; margin-top: 30px; text-align: center; font-size: 12px; }
    a { color: #33A19A; text-decoration: none; }
    .cta-button { display: inline-block; background: #33A19A; color: white; padding: 12px 24px; border-radius: 5px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${meeting.title}</h1>
    <p><strong>Fecha:</strong> ${new Date(meeting.date).toLocaleDateString('es-ES')}</p>
  </div>
  
  <div class="content">
    ${deliveryRun.output_content ? deliveryRun.output_content.replace(/^#+ /gm, '<h3>') : '<p>Sin contenido</p>'}
  </div>

  <div class="footer">
    <p>Informe generado automáticamente por Data Goal</p>
    <p>Consultor: ${user.full_name} (${user.email})</p>
    ${report.pdf_url ? `<a href="${report.pdf_url}" class="cta-button">Ver informe completo en Drive</a>` : ''}
  </div>
</body>
</html>
    `;

    // Send emails via Gmail connector
    const emailPromises = recipients.map(recipient =>
      base44.integrations.Core.SendEmail({
        to: recipient,
        subject: emailSubject,
        body: htmlContent,
        from_name: `${user.full_name} (Data Goal)`
      })
    );

    const emailResults = await Promise.all(emailPromises);

    // Create send history record
    await base44.entities.Report.update(report.id, {
      email_send_history: [
        ...(report.email_send_history || []),
        {
          sent_by: user.email,
          sent_at: new Date().toISOString(),
          recipients,
          report_version: report.version || 1
        }
      ]
    });

    // Update DeliveryRun
    await base44.entities.DeliveryRun.update(delivery_run_id, {
      status: 'delivered',
      recipients,
      sent_at: new Date().toISOString(),
      sent_by: user.email
    });

    // Create notifications for recipients
    for (const recipient of recipients) {
      await base44.entities.Notification.create({
        user_email: recipient,
        title: 'Nuevo informe recibido',
        message: `Se ha generado el informe de la reunión: ${meeting.title}`,
        type: 'info',
        related_entity_type: 'Report',
        related_entity_id: report.id,
        is_read: false
      });
    }

    return Response.json({
      success: true,
      emails_sent: emailResults.length,
      recipients
    });

  } catch (error) {
    console.error('Email send error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});