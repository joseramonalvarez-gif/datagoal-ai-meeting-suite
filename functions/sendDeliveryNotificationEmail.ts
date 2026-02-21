import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { delivery_run_id, custom_recipients } = await req.json();

    if (!delivery_run_id) {
      return Response.json({ error: 'Missing delivery_run_id' }, { status: 400 });
    }

    const deliveries = await base44.asServiceRole.entities.DeliveryRun.filter({ id: delivery_run_id });
    if (!deliveries || deliveries.length === 0) {
      return Response.json({ error: 'Delivery not found' }, { status: 404 });
    }

    const delivery = deliveries[0];
    const template = await base44.asServiceRole.entities.DeliveryTemplate.filter({ id: delivery.delivery_template_id });
    const templateName = template?.[0]?.name || 'Entrega';

    const statusEmoji = {
      running: '⏳',
      success: '✅',
      failed: '❌',
      review_pending: '👀',
      delivered: '📨'
    };

    const emailBody = `Estimado,

${statusEmoji[delivery.status] || ''} **Estado:** ${delivery.status}

**${templateName}**

${delivery.status === 'success' || delivery.status === 'delivered' ? `
Nos complace informarte que la entrega ha sido completada exitosamente.

📊 **Calidad:** ${delivery.quality_score ? (delivery.quality_score * 100).toFixed(0) + '%' : 'No calculada'}
⏱️ **Tiempo de Ejecución:** ${delivery.total_time_ms ? (delivery.total_time_ms / 1000 / 60).toFixed(1) + ' minutos' : 'N/A'}

El documento está listo para revisión en la plataforma.
` : delivery.status === 'failed' ? `
Lamentablemente, hubo un problema durante la generación de esta entrega:

${delivery.error_log ? `**Error:** ${delivery.error_log}` : 'Por favor, contacta al equipo de soporte.'}
` : `
La entrega está en proceso. Pronto recibirás una actualización.
`}

Accede a la plataforma para ver todos los detalles.

Saludos cordiales,
Data Goal Team`;

    const recipients = custom_recipients || delivery.recipients?.join(',') || '';

    if (!recipients) {
      return Response.json({ error: 'No recipients specified' }, { status: 400 });
    }

    const emailObject = {
      to: recipients,
      subject: `${statusEmoji[delivery.status] || ''} Entrega: ${templateName}`,
      body: emailBody
    };

    await base44.integrations.Core.SendEmail(emailObject);

    return Response.json({ 
      success: true,
      message: 'Delivery notification email sent',
      recipients
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});