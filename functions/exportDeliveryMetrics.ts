import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Export delivery metrics as JSON/CSV
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { format = 'json', days = 30, client_id } = await req.json();

    console.log(`[exportDeliveryMetrics] Exporting metrics (format: ${format}, days: ${days})`);

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    let query = {};
    if (client_id) {
      query.client_id = client_id;
    }

    const deliveries = await base44.entities.DeliveryRun.filter(query, '-created_date', 1000);
    const filtered = deliveries.filter(d => new Date(d.created_date) > dateThreshold);

    const metrics = {
      date_range: {
        from: dateThreshold.toISOString(),
        to: new Date().toISOString(),
        days
      },
      summary: {
        total: filtered.length,
        successful: filtered.filter(d => d.status === 'delivered' || d.status === 'success').length,
        failed: filtered.filter(d => d.status === 'failed').length,
        pending: filtered.filter(d => d.status === 'running' || d.status === 'review_pending').length,
        avg_quality: filtered.length > 0 
          ? filtered.reduce((sum, d) => sum + (d.quality_score || 0), 0) / filtered.length
          : 0,
        avg_time_seconds: filtered.length > 0
          ? Math.round(filtered.reduce((sum, d) => sum + (d.total_time_ms || 0), 0) / filtered.length / 1000)
          : 0
      },
      deliveries: filtered.map(d => ({
        id: d.id,
        created_date: d.created_date,
        status: d.status,
        quality_score: d.quality_score,
        total_time_ms: d.total_time_ms,
        template_id: d.delivery_template_id,
        trigger_entity: d.trigger_entity_type,
        recipients_count: (d.recipients || []).length
      }))
    };

    if (format === 'csv') {
      // Convert to CSV
      const headers = ['ID', 'Fecha', 'Estado', 'Calidad', 'Tiempo(s)', 'Template', 'Tipo', 'Destinatarios'];
      const rows = filtered.map(d => [
        d.id.substring(0, 12),
        new Date(d.created_date).toLocaleString('es-ES'),
        d.status,
        d.quality_score ? (d.quality_score * 100).toFixed(1) : '-',
        Math.round((d.total_time_ms || 0) / 1000),
        d.delivery_template_id.substring(0, 8),
        d.trigger_entity_type,
        (d.recipients || []).length
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(r => r.map(v => `"${v}"`).join(','))
      ].join('\n');

      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=delivery_metrics_${new Date().toISOString().split('T')[0]}.csv`
        }
      });
    }

    // JSON format
    return Response.json(metrics);

  } catch (error) {
    console.error('[exportDeliveryMetrics] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});