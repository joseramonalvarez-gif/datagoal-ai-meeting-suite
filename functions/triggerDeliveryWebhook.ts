import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Trigger webhooks on delivery events
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { delivery_id, event_type, webhook_url, data } = await req.json();

    if (!delivery_id || !event_type || !webhook_url) {
      return Response.json({ 
        error: 'delivery_id, event_type, and webhook_url required' 
      }, { status: 400 });
    }

    console.log(`[triggerDeliveryWebhook] Triggering ${event_type} for ${delivery_id}`);

    const delivery = await base44.asServiceRole.entities.DeliveryRun.get(delivery_id);
    if (!delivery) {
      return Response.json({ error: 'Delivery not found' }, { status: 404 });
    }

    const meeting = await base44.asServiceRole.entities.Meeting.get(delivery.trigger_entity_id);

    const payload = {
      event: event_type,
      timestamp: new Date().toISOString(),
      delivery: {
        id: delivery.id,
        status: delivery.status,
        quality_score: delivery.quality_score,
        created_date: delivery.created_date,
        total_time_ms: delivery.total_time_ms,
        recipients: delivery.recipients
      },
      meeting: meeting ? {
        id: meeting.id,
        title: meeting.title,
        date: meeting.date
      } : null,
      ...data
    };

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Delivery-Signature': `delivery-${delivery.id}`
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    console.log(`[triggerDeliveryWebhook] Webhook response: ${response.status}`);

    return Response.json({
      success: response.ok,
      status: response.status,
      message: response.ok ? 'Webhook triggered successfully' : 'Webhook returned error'
    });

  } catch (error) {
    console.error('[triggerDeliveryWebhook] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});