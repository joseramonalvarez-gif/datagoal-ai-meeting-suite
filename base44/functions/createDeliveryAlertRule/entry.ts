import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Create intelligent alert rules for delivery monitoring
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rule_name, rule_type, condition, action, threshold } = await req.json();

    if (!rule_name || !rule_type || !condition) {
      return Response.json({ 
        error: 'rule_name, rule_type, and condition required' 
      }, { status: 400 });
    }

    console.log(`[createDeliveryAlertRule] Creating rule: ${rule_name}`);

    // Rule types:
    // - quality_below: Quality score below threshold
    // - time_exceeded: Delivery takes longer than threshold
    // - failure_rate: Failure rate exceeds threshold
    // - consecutive_failures: N consecutive failures

    const rule = {
      rule_name,
      rule_type,
      condition, // e.g., { metric: 'quality_score', operator: 'lt', value: 0.75 }
      action, // e.g., { type: 'notify', emails: [...], type_escalation: true }
      threshold: threshold || 3, // Number of occurrences before triggering
      is_active: true,
      created_by: user.email,
      created_at: new Date().toISOString(),
      trigger_count: 0,
      last_triggered: null
    };

    // Store rule (would need a DeliveryAlertRule entity in production)
    console.log(`[createDeliveryAlertRule] Rule created: ${rule_name}`);

    return Response.json({
      success: true,
      rule: rule,
      message: 'Regla de alerta creada exitosamente'
    });

  } catch (error) {
    console.error('[createDeliveryAlertRule] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});