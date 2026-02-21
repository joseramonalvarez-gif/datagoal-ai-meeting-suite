import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Generate executive PDF report from dashboard metrics
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, project_id, include_sections } = await req.json();

    console.log(`[exportDashboardPDF] Exporting PDF for client: ${client_id}`);

    // Fetch client and snapshots
    const [client, snapshots] = await Promise.all([
      base44.entities.Client.get(client_id),
      base44.entities.AnalyticsSnapshot.filter({ 
        client_id, 
        period_type: 'daily' 
      }, '-snapshot_date', 30)
    ]);

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Build markdown content
    let content = `# ${client.name} - Executive Report\n\n`;
    content += `**Generated:** ${new Date().toLocaleDateString()}\n`;
    content += `**Prepared for:** ${user.full_name}\n\n`;

    // Summary metrics
    if (snapshots.length > 0) {
      const latest = snapshots[0];
      content += `## Key Metrics (Today)\n\n`;
      content += `| Metric | Value |\n`;
      content += `|--------|-------|\n`;
      content += `| Tasks Closed | ${latest.metrics.tasks_closed} of ${latest.metrics.total_tasks} |\n`;
      content += `| Completion Rate | ${(latest.kpis.task_completion_rate * 100).toFixed(1)}% |\n`;
      content += `| Billable Hours | ${latest.metrics.billable_hours.toFixed(1)} / ${latest.metrics.total_hours.toFixed(1)} |\n`;
      content += `| Billable Ratio | ${(latest.kpis.billable_ratio * 100).toFixed(1)}% |\n`;
      content += `| Avg Quality Score | ${(latest.kpis.quality_score * 100).toFixed(1)}% |\n`;
      content += `| Deliveries Completed | ${latest.metrics.deliveries_completed} |\n\n`;
    }

    // Trends
    if (snapshots.length > 1) {
      content += `## Weekly Trends\n\n`;
      content += `| Metric | This Week | Last Week | Change |\n`;
      content += `|--------|-----------|-----------|--------|\n`;
      // Simple week avg
      const thisWeek = snapshots.slice(0, 7);
      const avgCompletion = thisWeek.reduce((sum, s) => sum + s.kpis.task_completion_rate, 0) / thisWeek.length;
      content += `| Task Completion | ${(avgCompletion * 100).toFixed(1)}% | N/A | - |\n\n`;
    }

    // Use LLM to enhance content
    const enhanced = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an executive report writer. Format this into a professional executive summary with insights and recommendations:\n\n${content}`,
      response_json_schema: {
        type: "object",
        properties: {
          executive_summary: { type: "string" },
          key_findings: { type: "array", items: { type: "string" } },
          recommendations: { type: "array", items: { type: "string" } }
        }
      }
    });

    // Build final markdown
    let finalContent = `# ${client.name} - Executive Dashboard Report\n\n`;
    finalContent += `**Report Date:** ${new Date().toLocaleDateString()}\n`;
    finalContent += `**Prepared by:** ${user.full_name}\n\n`;
    finalContent += enhanced.executive_summary + '\n\n';
    finalContent += `## Key Findings\n\n`;
    enhanced.key_findings.forEach(f => {
      finalContent += `- ${f}\n`;
    });
    finalContent += `\n## Recommendations\n\n`;
    enhanced.recommendations.forEach(r => {
      finalContent += `- ${r}\n`;
    });

    // Return as markdown (frontend will convert to PDF using libraries)
    return Response.json({
      success: true,
      content: finalContent,
      format: 'markdown',
      filename: `executive_report_${client.name}_${new Date().toISOString().split('T')[0]}.md`
    });

  } catch (error) {
    console.error('[exportDashboardPDF] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});