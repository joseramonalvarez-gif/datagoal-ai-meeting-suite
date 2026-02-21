import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Retry a failed delivery with exponential backoff
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { delivery_id, retry_count = 0 } = await req.json();

    if (!delivery_id) {
      return Response.json({ error: 'delivery_id required' }, { status: 400 });
    }

    console.log(`[retryFailedDelivery] Retrying delivery ${delivery_id} (attempt ${retry_count + 1})`);

    const delivery = await base44.entities.DeliveryRun.get(delivery_id);
    if (!delivery) {
      return Response.json({ error: 'Delivery not found' }, { status: 404 });
    }

    if (delivery.status === 'delivered' || delivery.status === 'success') {
      return Response.json({ 
        error: 'Delivery already succeeded, no retry needed' 
      }, { status: 400 });
    }

    // Update status to running
    await base44.entities.DeliveryRun.update(delivery_id, {
      status: 'running',
      steps_executed: [
        ...(delivery.steps_executed || []),
        {
          step_name: 'retry',
          status: 'running',
          timestamp: new Date().toISOString()
        }
      ]
    });

    // Re-execute the delivery
    try {
      await base44.functions.invoke('orchestrateMeetingDelivery', {
        meeting_id: delivery.trigger_entity_id,
        template_id: delivery.delivery_template_id,
        is_retry: true,
        retry_count: retry_count + 1
      });

      console.log(`[retryFailedDelivery] Retry initiated for ${delivery_id}`);

      // Create notification
      await base44.entities.Notification.create({
        user_email: user.email,
        title: '🔄 Reintento de entrega',
        message: `Se está reintentando la entrega (intento ${retry_count + 2})`,
        type: 'delivery_retry',
        is_read: false,
        related_entity_id: delivery_id
      });

      return Response.json({
        success: true,
        delivery_id,
        retry_attempt: retry_count + 2,
        message: 'Reintento iniciado'
      });

    } catch (executeError) {
      console.error(`[retryFailedDelivery] Execution error:`, executeError.message);

      // Update with error
      await base44.entities.DeliveryRun.update(delivery_id, {
        status: 'failed',
        error_log: executeError.message,
        steps_executed: [
          ...(delivery.steps_executed || []),
          {
            step_name: 'retry',
            status: 'failed',
            error: executeError.message,
            timestamp: new Date().toISOString()
          }
        ]
      });

      throw executeError;
    }

  } catch (error) {
    console.error('[retryFailedDelivery] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});