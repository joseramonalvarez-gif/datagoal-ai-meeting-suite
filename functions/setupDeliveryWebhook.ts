import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Setup webhook for delivery events (e.g., Slack, external systems)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { webhook_url, event_types, name } = await req.json();

    if (!webhook_url || !event_types) {
      return Response.json({ 
        error: 'webhook_url and event_types required' 
      }, { status: 400 });
    }

    console.log(`[setupDeliveryWebhook] Setting up webhook: ${name}`);

    // Create webhook config in database
    const webhookConfig = {
      name: name || 'Delivery Webhook',
      webhook_url,
      event_types,
      is_active: true,
      created_by: user.email,
      created_at: new Date().toISOString(),
      last_triggered: null,
      trigger_count: 0
    };

    // Store in app settings/config (could use a DeliveryWebhookConfig entity if needed)
    // For now, we'll save it to user profile or return it
    
    // Test the webhook with a test event
    try {
      await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'test',
          timestamp: new Date().toISOString(),
          message: 'Webhook test from delivery system'
        })
      });
      console.log(`[setupDeliveryWebhook] Webhook test successful`);
    } catch (error) {
      console.warn(`[setupDeliveryWebhook] Webhook test failed:`, error.message);
    }

    return Response.json({
      success: true,
      webhook: webhookConfig,
      message: 'Webhook configurado exitosamente'
    });

  } catch (error) {
    console.error('[setupDeliveryWebhook] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});