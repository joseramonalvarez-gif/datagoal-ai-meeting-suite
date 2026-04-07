import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Scheduled automation: Monitor delivery queue
 * Checks for stuck/failed deliveries and sends notifications
 * Runs every 5 minutes
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[checkDeliveryStatus] Monitoring delivery queue...');

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Find deliveries that are still running after 5 minutes
    const stuckDeliveries = await base44.entities.DeliveryRun.filter({
      status: 'running'
    }, '-created_date', 100);

    const alerts = [];

    for (const delivery of stuckDeliveries) {
      const createdTime = new Date(delivery.created_date);
      const durationMs = now.getTime() - createdTime.getTime();

      // Alert if running for more than 10 minutes
      if (durationMs > 10 * 60 * 1000) {
        console.log(`[checkDeliveryStatus] Stuck delivery detected: ${delivery.id}`);

        alerts.push({
          delivery_id: delivery.id,
          issue: 'STUCK_DELIVERY',
          duration_minutes: Math.round(durationMs / 60000),
          created_at: createdTime.toISOString()
        });

        // Create notification
        await base44.entities.Notification.create({
          user_email: user.email,
          title: '⚠️ Entrega atascada',
          message: `La entrega ${delivery.id} lleva más de 10 minutos en progreso`,
          type: 'delivery_alert',
          is_read: false,
          related_entity_id: delivery.id
        });
      }
    }

    // Find failed deliveries from last hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const failedDeliveries = await base44.entities.DeliveryRun.filter({
      status: 'failed'
    }, '-created_date', 100);

    const recentFailures = failedDeliveries.filter(d => 
      new Date(d.created_date) > oneHourAgo &&
      new Date(d.created_date) < fiveMinutesAgo
    );

    for (const delivery of recentFailures) {
      console.log(`[checkDeliveryStatus] Failed delivery detected: ${delivery.id}`);

      alerts.push({
        delivery_id: delivery.id,
        issue: 'DELIVERY_FAILED',
        error: delivery.error_log?.substring(0, 100),
        created_at: delivery.created_date
      });

      // Create notification
      await base44.entities.Notification.create({
        user_email: user.email,
        title: '❌ Entrega fallida',
        message: `La entrega ${delivery.id} falló: ${delivery.error_log?.substring(0, 50)}...`,
        type: 'delivery_alert',
        is_read: false,
        related_entity_id: delivery.id
      });
    }

    // Get summary stats
    const allDeliveries = await base44.entities.DeliveryRun.filter({}, '-created_date', 100);
    const stats = {
      total: allDeliveries.length,
      running: allDeliveries.filter(d => d.status === 'running').length,
      success: allDeliveries.filter(d => d.status === 'success').length,
      failed: allDeliveries.filter(d => d.status === 'failed').length,
      delivered: allDeliveries.filter(d => d.status === 'delivered').length
    };

    console.log('[checkDeliveryStatus] Monitoring complete', stats);

    return Response.json({
      success: true,
      timestamp: now.toISOString(),
      alerts_triggered: alerts.length,
      alerts,
      stats
    });

  } catch (error) {
    console.error('[checkDeliveryStatus] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});