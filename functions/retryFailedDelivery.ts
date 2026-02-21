import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Retry a failed delivery
 * Re-runs the full orchestration pipeline
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { delivery_run_id } = await req.json();

    if (!delivery_run_id) {
      return Response.json({ error: 'delivery_run_id required' }, { status: 400 });
    }

    console.log(`[retryFailedDelivery] Retrying delivery ${delivery_run_id}`);

    const failedDelivery = await base44.entities.DeliveryRun.get(delivery_run_id);

    if (!failedDelivery) {
      return Response.json({ error: 'Delivery not found' }, { status: 404 });
    }

    if (failedDelivery.status !== 'failed') {
      return Response.json({
        error: `Cannot retry delivery with status: ${failedDelivery.status}`,
        current_status: failedDelivery.status
      }, { status: 400 });
    }

    // Create new delivery run with same parameters
    const newDelivery = await base44.entities.DeliveryRun.create({
      delivery_template_id: failedDelivery.delivery_template_id,
      trigger_entity_type: failedDelivery.trigger_entity_type,
      trigger_entity_id: failedDelivery.trigger_entity_id,
      status: 'running',
      steps_executed: [
        {
          step_name: 'retry_initiation',
          status: 'success',
          output: `Retrying from failed delivery ${delivery_run_id}`,
          timestamp: new Date().toISOString()
        }
      ]
    });

    console.log(`[retryFailedDelivery] New delivery created: ${newDelivery.id}`);

    // Invoke orchestration on new delivery
    const orchRes = await base44.asServiceRole.functions.invoke('orchestrateMeetingDelivery', {
      meeting_id: failedDelivery.trigger_entity_id,
      template_id: failedDelivery.delivery_template_id
    });

    if (!orchRes.success) {
      throw new Error(`Orchestration failed: ${orchRes.error}`);
    }

    // Create notification
    await base44.entities.Notification.create({
      user_email: user.email,
      title: '🔄 Reintento iniciado',
      message: `Reintentando entrega ${delivery_run_id}. Nueva ID: ${newDelivery.id}`,
      type: 'delivery_retry',
      is_read: false,
      related_entity_id: newDelivery.id
    });

    return Response.json({
      success: true,
      original_delivery_id: delivery_run_id,
      new_delivery_id: newDelivery.id,
      status: 'retry_in_progress'
    });

  } catch (error) {
    console.error('[retryFailedDelivery] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});