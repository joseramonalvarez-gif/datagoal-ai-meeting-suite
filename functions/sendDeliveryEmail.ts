import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Send delivery report via email to recipients
 * Handles HTML formatting, PDF attachment, and email tracking
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { delivery_run_id, recipients, custom_message } = await req.json();

    if (!delivery_run_id || !recipients || recipients.length === 0) {
      return Response.json({
        error: 'Missing required fields: delivery_run_id, recipients (array)'
      }, { status: 400 });
    }

    console.log(`[sendDeliveryEmail] Sending delivery ${delivery_run_id} to ${recipients.length} recipients`);

    // Get delivery and related data
    const [delivery, template] = await Promise.all([
      base44.entities.DeliveryRun.get(delivery_run_id),
      null // Will load based on delivery
    ]);

    if (!delivery) {
      return Response.json({ error: 'Delivery not found' }, { status: 404 });
    }

    // Get meeting to extract client/project info
    const meeting = await base44.entities.Meeting.get(delivery.trigger_entity_id);
    if (!meeting) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Get client info for signature
    const client = await base44.entities.Client.get(meeting.client_id);

    // Format email subject
    const emailSubject = `Informe de Reunión: ${meeting.title}`;

    // Format email body
    const emailBody = `
<html>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    
    <!-- Header -->
    <div style="background-color: #1B2731; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0; font-size: 24px;">📋 ${meeting.title}</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Informe generado automáticamente por Data Goal</p>
    </div>

    <!-- Content -->
    <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none;">
      ${custom_message ? `<p style="background-color: #f5f5f5; padding: 12px; border-left: 4px solid #33A19A; margin-bottom: 20px;">${custom_message}</p>` : ''}

      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #1B2731;">Resumen de la reunión</h3>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li><strong>Fecha:</strong> ${new Date(meeting.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</li>
          <li><strong>Cliente:</strong> ${client?.name || 'N/A'}</li>
          <li><strong>Objetivo:</strong> ${meeting.objective}</li>
          <li><strong>Participantes:</strong> ${meeting.participants?.length || 0} asistentes</li>
        </ul>
      </div>

      <h3 style="color: #1B2731; border-bottom: 2px solid #33A19A; padding-bottom: 10px;">Contenido del Informe</h3>
      <div style="background-color: white; padding: 15px; border: 1px solid #e0e0e0; border-radius: 4px; max-height: 400px; overflow-y: auto;">
        ${delivery.output_content || '<p style="color: #999;">Sin contenido disponible</p>'}
      </div>

      <p style="color: #666; font-size: 12px; margin-top: 20px;">
        <strong>Acciones recomendadas:</strong>
        <ul style="margin: 5px 0;">
          <li>Revisar el contenido del informe</li>
          <li>Descargar versión PDF para archivo</li>
          <li>Compartir con stakeholders si es necesario</li>
        </ul>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 0;">
        <strong>${user.full_name}</strong><br>
        ${user.email}<br>
        <em>Data Goal - Strategic Knowledge Center</em>
      </p>
      <p style="margin: 10px 0 0 0; font-size: 11px; color: #999;">
        Informe ID: ${delivery.id}<br>
        Generado: ${new Date().toLocaleString('es-ES')}
      </p>
    </div>

  </div>
</body>
</html>
    `.trim();

    // Get Gmail connector token
    console.log('[sendDeliveryEmail] Getting Gmail access token...');
    const gmailToken = await base44.asServiceRole.connectors.getAccessToken('gmail');

    // Send email to each recipient
    const sendPromises = recipients.map(async (recipientEmail) => {
      console.log(`[sendDeliveryEmail] Sending to ${recipientEmail}`);

      try {
        // Use Gmail API to send
        const gmailResponse = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${gmailToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            raw: Buffer.from(
              `To: ${recipientEmail}\r\nSubject: ${emailSubject}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${emailBody}`
            ).toString('base64')
          })
        });

        if (!gmailResponse.ok) {
          const error = await gmailResponse.json();
          throw new Error(`Gmail API error: ${error.error.message}`);
        }

        return { recipient: recipientEmail, success: true };

      } catch (error) {
        console.error(`[sendDeliveryEmail] Failed to send to ${recipientEmail}:`, error);
        return { recipient: recipientEmail, success: false, error: error.message };
      }
    });

    const sendResults = await Promise.all(sendPromises);
    const successCount = sendResults.filter(r => r.success).length;

    console.log(`[sendDeliveryEmail] Sent to ${successCount}/${recipients.length} recipients`);

    // Update delivery with send tracking
    const deliveredRecipients = sendResults
      .filter(r => r.success)
      .map(r => r.recipient);

    await base44.entities.DeliveryRun.update(delivery_run_id, {
      status: successCount === recipients.length ? 'delivered' : 'partial',
      recipients: deliveredRecipients,
      sent_at: new Date().toISOString(),
      sent_by: user.email,
      steps_executed: [
        ...(delivery.steps_executed || []),
        {
          step_name: 'send_email',
          status: successCount > 0 ? 'success' : 'failed',
          output: `Sent to ${successCount}/${recipients.length} recipients`,
          timestamp: new Date().toISOString()
        }
      ]
    });

    // Log notification
    const notificationPromises = deliveredRecipients.map(email =>
      base44.entities.Notification.create({
        user_email: email,
        title: `Nuevo Informe: ${meeting.title}`,
        message: `Se te ha enviado el informe de la reunión. Haz clic para descargar.`,
        type: 'delivery_sent',
        is_read: false,
        related_entity_id: delivery_run_id
      }).catch(err => {
        console.error(`[sendDeliveryEmail] Failed to create notification for ${email}:`, err);
        return null;
      })
    );

    await Promise.all(notificationPromises);

    return Response.json({
      success: successCount > 0,
      summary: {
        total_recipients: recipients.length,
        successful: successCount,
        failed: recipients.length - successCount
      },
      results: sendResults,
      delivery_id: delivery_run_id,
      status: successCount === recipients.length ? 'FULLY_SENT' : successCount > 0 ? 'PARTIALLY_SENT' : 'FAILED'
    });

  } catch (error) {
    console.error('[sendDeliveryEmail] Error:', error);

    // Try to log error to delivery
    try {
      const { delivery_run_id } = await req.json();
      await base44.entities.DeliveryRun.update(delivery_run_id, {
        status: 'failed',
        error_log: error.message
      });
    } catch (logError) {
      console.error('[sendDeliveryEmail] Could not log error:', logError);
    }

    return Response.json(
      { error: error.message, step: 'send_email' },
      { status: 500 }
    );
  }
});