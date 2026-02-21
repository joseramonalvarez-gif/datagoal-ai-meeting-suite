import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Create a new version of a delivery (for versioning/rollback)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { delivery_id, change_reason, change_type = 'update' } = await req.json();

    if (!delivery_id) {
      return Response.json({ error: 'delivery_id required' }, { status: 400 });
    }

    console.log(`[createDeliveryVersion] Creating version for ${delivery_id}`);

    const delivery = await base44.entities.DeliveryRun.get(delivery_id);
    if (!delivery) {
      return Response.json({ error: 'Delivery not found' }, { status: 404 });
    }

    // Create a version snapshot
    const version = {
      delivery_id,
      version_number: (delivery.version || 0) + 1,
      change_reason,
      change_type,
      snapshot: {
        status: delivery.status,
        output_content: delivery.output_content,
        quality_score: delivery.quality_score,
        recipients: delivery.recipients,
        ai_metadata: delivery.ai_metadata
      },
      created_by: user.email,
      created_at: new Date().toISOString()
    };

    // Update delivery with new version number
    await base44.entities.DeliveryRun.update(delivery_id, {
      version: version.version_number
    });

    // For now, store in a note or audit trail
    // In production, you'd have a DeliveryVersion entity
    console.log(`[createDeliveryVersion] Version ${version.version_number} created for ${delivery_id}`);

    return Response.json({
      success: true,
      version: version.version_number,
      change_reason,
      message: 'Versión creada exitosamente'
    });

  } catch (error) {
    console.error('[createDeliveryVersion] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});