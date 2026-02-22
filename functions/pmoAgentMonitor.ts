import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const startTime = Date.now();

    // Para automations del sistema, usar service role
    const user = await base44.auth.me().catch(() => null);

    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    // Buscar tareas vencidas (sin filtro de status=done, filtramos después)
    const [allTasks, allDeliveries] = await Promise.all([
      base44.asServiceRole.entities.Task.list('-due_date', 200),
      base44.asServiceRole.entities.DeliveryRun.filter({ status: 'review_pending' }, '-created_date', 50)
    ]);

    // Filtrar tareas vencidas (due_date < hoy y no done)
    const overdueTasks = allTasks.filter(t => {
      if (!t.due_date) return false;
      if (t.status === 'done') return false;
      return new Date(t.due_date) < today;
    });

    // Entregas en review_pending por más de 24h
    const cutoff24h = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const pendingDeliveries = allDeliveries.filter(d => {
      return new Date(d.created_date) < cutoff24h;
    });

    const hasIssues = overdueTasks.length > 0 || pendingDeliveries.length > 0;

    if (!hasIssues) {
      await base44.asServiceRole.entities.AutomationRun.create({
        automation_type: 'pmo_monitor',
        trigger_event: 'scheduled',
        status: 'success',
        triggered_by: 'system',
        duration_ms: Date.now() - startTime,
        summary: 'Sin incidencias detectadas'
      });

      return Response.json({ success: true, issues: 0, summary: 'Sin incidencias' });
    }

    // Construir resumen
    const overdueLines = overdueTasks.slice(0, 10).map(t => {
      const daysOverdue = Math.floor((today - new Date(t.due_date)) / (1000 * 60 * 60 * 24));
      return `• ${t.title} (vencida hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''})`;
    }).join('\n');

    const deliveryLines = pendingDeliveries.slice(0, 5).map(d => {
      const hoursWaiting = Math.floor((today - new Date(d.created_date)) / (1000 * 60 * 60));
      return `• Entrega #${d.id.substring(0, 8)} (esperando ${hoursWaiting}h)`;
    }).join('\n');

    const emailBody = `📊 PMO DAILY ALERT - ${today.toLocaleDateString('es-ES')}

${overdueTasks.length > 0 ? `⚠️ TAREAS VENCIDAS (${overdueTasks.length}):
${overdueLines}
${overdueTasks.length > 10 ? `...y ${overdueTasks.length - 10} más` : ''}` : ''}

${pendingDeliveries.length > 0 ? `📋 ENTREGAS EN REVISIÓN >24H (${pendingDeliveries.length}):
${deliveryLines}` : ''}

Accede al sistema para gestionar estos items.
—
Sistema DataGoal (automatizado)`;

    // Obtener emails de admins para notificar
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const recipientEmails = admins.length > 0
      ? admins.map(a => a.email)
      : (user ? [user.email] : []);

    if (recipientEmails.length > 0) {
      for (const email of recipientEmails) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `[PMO Alert] ${overdueTasks.length} tareas vencidas - ${today.toLocaleDateString('es-ES')}`,
          body: emailBody
        });
      }
    }

    await base44.asServiceRole.entities.AutomationRun.create({
      automation_type: 'pmo_monitor',
      trigger_event: 'scheduled',
      status: 'success',
      triggered_by: 'system',
      duration_ms: Date.now() - startTime,
      summary: `${overdueTasks.length} tareas vencidas, ${pendingDeliveries.length} entregas pendientes`
    });

    return Response.json({
      success: true,
      overdue_tasks: overdueTasks.length,
      pending_deliveries: pendingDeliveries.length,
      emails_sent: recipientEmails.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});