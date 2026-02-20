import { base44 } from "@/api/base44Client";

// ── helpers ──────────────────────────────────────────────────────────────────

async function createNotification({ user_email, client_id, project_id, type, title, message, related_entity_id }) {
  if (!user_email) return;
  return base44.entities.Notification.create({
    user_email,
    client_id: client_id || "",
    project_id: project_id || "",
    type,
    title,
    message,
    related_entity_type: "Task",
    related_entity_id,
    is_read: false,
  });
}

async function createAuditLog({ user_email, client_id, project_id, action, entity_id, details }) {
  return base44.entities.AuditLog.create({
    user_email: user_email || "system",
    client_id: client_id || "",
    project_id: project_id || "",
    action,
    entity_type: "Task",
    entity_id,
    details,
    timestamp: new Date().toISOString(),
  });
}

// ── 1. Tarea asignada ─────────────────────────────────────────────────────────

export async function notifyTaskAssigned({ task, assignedBy }) {
  if (!task.assignee_email) return;
  const due = task.due_date ? ` · Fecha límite: ${new Date(task.due_date).toLocaleDateString("es-ES")}` : "";
  await Promise.all([
    createNotification({
      user_email: task.assignee_email,
      client_id: task.client_id,
      project_id: task.project_id,
      type: "task_assigned",
      title: "Nueva tarea asignada",
      message: `Se te ha asignado la tarea "${task.title}"${due}`,
      related_entity_id: task.id,
    }),
    createAuditLog({
      user_email: assignedBy,
      client_id: task.client_id,
      project_id: task.project_id,
      action: "task_assigned",
      entity_id: task.id,
      details: `Tarea "${task.title}" asignada a ${task.assignee_email} por ${assignedBy}`,
    }),
  ]);
}

// ── 2. Mención en comentario ──────────────────────────────────────────────────

export async function notifyTaskMention({ task, mentionedEmail, commentText, mentionedBy }) {
  if (!mentionedEmail) return;
  const preview = commentText?.slice(0, 80) + (commentText?.length > 80 ? "…" : "");
  await Promise.all([
    createNotification({
      user_email: mentionedEmail,
      client_id: task.client_id,
      project_id: task.project_id,
      type: "mention",
      title: "Te mencionaron en una tarea",
      message: `${mentionedBy} te mencionó en "${task.title}": "${preview}"`,
      related_entity_id: task.id,
    }),
    createAuditLog({
      user_email: mentionedBy,
      client_id: task.client_id,
      project_id: task.project_id,
      action: "task_mention",
      entity_id: task.id,
      details: `${mentionedBy} mencionó a ${mentionedEmail} en tarea "${task.title}"`,
    }),
  ]);
}

// ── 3 & 4. Due-date checks (una sola vez por día via localStorage) ────────────

export async function checkTaskDueDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const sentKey = `dg_due_notified_${todayStr}`;
  let sent = {};
  try { sent = JSON.parse(localStorage.getItem(sentKey) || "{}"); } catch (_) {}

  const tasks = await base44.entities.Task.list();
  const toSave = { ...sent };
  const promises = [];

  for (const task of tasks) {
    if (!task.assignee_email || !task.due_date || task.status === "done") continue;

    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / 86400000);

    if (diffDays === 1 && !sent[`soon_${task.id}`]) {
      toSave[`soon_${task.id}`] = true;
      promises.push(
        createNotification({
          user_email: task.assignee_email,
          client_id: task.client_id,
          project_id: task.project_id,
          type: "task_due_soon",
          title: "Tarea próxima a vencer",
          message: `La tarea "${task.title}" vence mañana (${due.toLocaleDateString("es-ES")})`,
          related_entity_id: task.id,
        }),
        createAuditLog({
          user_email: "system",
          client_id: task.client_id,
          project_id: task.project_id,
          action: "task_due_soon",
          entity_id: task.id,
          details: `Aviso automático: tarea "${task.title}" vence mañana (${due.toLocaleDateString("es-ES")})`,
        })
      );
    }

    if (diffDays === 0 && !sent[`overdue_${task.id}`]) {
      toSave[`overdue_${task.id}`] = true;
      promises.push(
        createNotification({
          user_email: task.assignee_email,
          client_id: task.client_id,
          project_id: task.project_id,
          type: "task_overdue",
          title: "Tarea vencida hoy",
          message: `La tarea "${task.title}" ha vencido hoy (${due.toLocaleDateString("es-ES")})`,
          related_entity_id: task.id,
        }),
        createAuditLog({
          user_email: "system",
          client_id: task.client_id,
          project_id: task.project_id,
          action: "task_overdue",
          entity_id: task.id,
          details: `Aviso automático: tarea "${task.title}" venció el ${due.toLocaleDateString("es-ES")}`,
        })
      );
    }
  }

  await Promise.all(promises);
  localStorage.setItem(sentKey, JSON.stringify(toSave));
}