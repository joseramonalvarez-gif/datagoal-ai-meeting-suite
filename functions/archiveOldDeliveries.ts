import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Daily automation: Archive old deliveries
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[archiveOldDeliveries] Starting archive process');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deliveries = await base44.entities.DeliveryRun.filter({}, '-created_date', 1000);
    
    const toArchive = deliveries.filter(d => 
      (d.status === 'delivered' || d.status === 'success') &&
      new Date(d.created_date) < thirtyDaysAgo
    );

    console.log(`[archiveOldDeliveries] Found ${toArchive.length} deliveries to archive`);

    let archived = 0;
    for (const delivery of toArchive) {
      try {
        await base44.entities.DeliveryRun.update(delivery.id, {
          status: 'archived'
        });
        archived++;
      } catch (error) {
        console.error(`Failed to archive ${delivery.id}:`, error.message);
      }
    }

    console.log(`[archiveOldDeliveries] Successfully archived ${archived} deliveries`);

    return Response.json({
      success: true,
      archived: archived,
      total_found: toArchive.length
    });

  } catch (error) {
    console.error('[archiveOldDeliveries] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});