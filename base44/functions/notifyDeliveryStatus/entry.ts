import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Send notifications for delivery status changes
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { delivery_id, status, quality_score, error_message, recipients } = await req.json();

    if (!delivery_id || !status) {
      return Response.json({ 
        error: 'delivery_id and status required' 
      }, { status: 400 });
    }

    console.log(`[notifyDeliveryStatus] Notifying for delivery ${delivery_id} status: ${status}`);

    const delivery = await base44.entities.DeliveryRun.get(delivery_id);
    if (!delivery) {
      return Response.json({ error: 'Delivery not found' }, { status: 404 });
    }

    const meeting = await base44.entities.Meeting.get(delivery.trigger_entity_id);
    let title = `📋 Entrega: ${meeting?.title || 'Sin título'}`;
    let message = '';
    let notificationType = 'delivery_update';

    switch (status) {
      case 'success':
      case 'delivered':
        title = `✅ Entrega exitosa: ${meeting?.title}`;
        message = `La entrega se completó exitosamente. Calidad: ${quality_score ? (quality_score * 100).toFixed(0) : 'N/A'}%`;
        notificationType = 'delivery_success';
        break;
      case 'failed':
        title = `❌ Entrega fallida: ${meeting?.title}`;
        message = error_message || 'Ocurrió un error durante la entrega';
        notificationType = 'delivery_failed';
        break;
      case 'running':
        title = `⏳ Procesando entrega: ${meeting?.title}`;
        message = 'La entrega está siendo procesada';
        notificationType = 'delivery_running';
        break;
      case 'review_pending':
        title = `👀 Entrega pendiente de revisión: ${meeting?.title}`;
        message = 'La entrega requiere aprobación manual';
        notificationType = 'delivery_review';
        break;
    }

    // Create notification for user
    await base44.entities.Notification.create({
      user_email: user.email,
      title,
      message,
      type: notificationType,
      is_read: false,
      related_entity_id: delivery_id
    });

    // Send email notifications if configured
    if (recipients && recipients.length > 0) {
      const accessToken = await base44.asServiceRole.connectors.getAccessToken('gmail');
      
      for (const recipient of recipients) {
        try {
          const emailBody = `
            <h2>${title}</h2>
            <p>${message}</p>
            <hr>
            <p><strong>Detalles:</strong></p>
            <ul>
              <li>Reunión: ${meeting?.title}</li>
              <li>Estado: ${status}</li>
              <li>Calidad: ${quality_score ? (quality_score * 100).toFixed(0) : 'N/A'}%</li>
              <li>Fecha: ${new Date().toLocaleString('es-ES')}</li>
            </ul>
          `;

          await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              raw: Buffer.from(
                `To: ${recipient}\r\nSubject: ${title}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${emailBody}`
              ).toString('base64')
            })
          });

          console.log(`[notifyDeliveryStatus] Email sent to ${recipient}`);
        } catch (error) {
          console.error(`Failed to send email to ${recipient}:`, error.message);
        }
      }
    }

    console.log(`[notifyDeliveryStatus] Notification created for ${delivery_id}`);

    return Response.json({
      success: true,
      notification_created: true,
      message: 'Notificaciones enviadas'
    });

  } catch (error) {
    console.error('[notifyDeliveryStatus] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});