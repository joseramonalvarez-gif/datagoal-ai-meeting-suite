import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Generate performance report for deliveries
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { days = 30, client_id } = await req.json();

    console.log(`[generatePerformanceReport] Generating report for last ${days} days`);

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    let query = {};
    if (client_id) {
      query.client_id = client_id;
    }

    const deliveries = await base44.entities.DeliveryRun.filter(query, '-created_date', 1000);
    const filtered = deliveries.filter(d => new Date(d.created_date) > threshold);

    // Calculate metrics
    const successful = filtered.filter(d => d.status === 'delivered' || d.status === 'success');
    const failed = filtered.filter(d => d.status === 'failed');
    const pending = filtered.filter(d => d.status === 'review_pending' || d.status === 'running');

    const avgQuality = filtered.length > 0 
      ? filtered.reduce((sum, d) => sum + (d.quality_score || 0), 0) / filtered.length 
      : 0;

    const avgTime = filtered.length > 0
      ? filtered.reduce((sum, d) => sum + (d.total_time_ms || 0), 0) / filtered.length
      : 0;

    // Group by template
    const byTemplate = {};
    filtered.forEach(d => {
      if (!byTemplate[d.delivery_template_id]) {
        byTemplate[d.delivery_template_id] = { count: 0, success: 0, failed: 0, avgQuality: 0, times: [] };
      }
      byTemplate[d.delivery_template_id].count++;
      if (d.status === 'delivered' || d.status === 'success') byTemplate[d.delivery_template_id].success++;
      if (d.status === 'failed') byTemplate[d.delivery_template_id].failed++;
      byTemplate[d.delivery_template_id].times.push(d.total_time_ms || 0);
    });

    // Enrich template data
    const templates = await base44.entities.DeliveryTemplate.filter({ is_active: true });
    const templateMap = Object.fromEntries(templates.map(t => [t.id, t.name]));

    const byTemplateEnriched = {};
    for (const [templateId, stats] of Object.entries(byTemplate)) {
      const avgTime = stats.times.length > 0 ? stats.times.reduce((a, b) => a + b) / stats.times.length : 0;
      byTemplateEnriched[templateMap[templateId] || templateId] = {
        ...stats,
        successRate: stats.count > 0 ? (stats.success / stats.count) * 100 : 0,
        avgTime: Math.round(avgTime / 1000)
      };
    }

    // Daily breakdown
    const daily = {};
    filtered.forEach(d => {
      const date = new Date(d.created_date).toISOString().split('T')[0];
      if (!daily[date]) daily[date] = { total: 0, success: 0, failed: 0, times: [] };
      daily[date].total++;
      if (d.status === 'delivered' || d.status === 'success') daily[date].success++;
      if (d.status === 'failed') daily[date].failed++;
      daily[date].times.push(d.total_time_ms || 0);
    });

    const dailyEnriched = {};
    for (const [date, stats] of Object.entries(daily)) {
      const avgTime = stats.times.length > 0 ? stats.times.reduce((a, b) => a + b) / stats.times.length : 0;
      dailyEnriched[date] = {
        ...stats,
        successRate: stats.total > 0 ? (stats.success / stats.total) * 100 : 0,
        avgTime: Math.round(avgTime / 1000)
      };
    }

    const report = {
      period: {
        from: threshold.toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        days
      },
      summary: {
        total: filtered.length,
        successful: successful.length,
        failed: failed.length,
        pending: pending.length,
        successRate: filtered.length > 0 ? (successful.length / filtered.length) * 100 : 0,
        avgQuality: avgQuality * 100,
        avgTimeSeconds: Math.round(avgTime / 1000)
      },
      by_template: byTemplateEnriched,
      daily: dailyEnriched,
      generated_at: new Date().toISOString()
    };

    console.log(`[generatePerformanceReport] Report generated: ${filtered.length} deliveries analyzed`);

    return Response.json(report);

  } catch (error) {
    console.error('[generatePerformanceReport] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});