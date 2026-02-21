import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, Users, Flag } from "lucide-react";

function getHealthScore(project, tasks, milestones) {
  let score = 0;
  const weights = { progress: 40, tasks: 35, milestones: 25 };

  // Progress score (0-40)
  score += ((project.progress || 0) / 100) * weights.progress;

  // Task score: penalize overdue/blocked (0-35)
  const projectTasks = tasks.filter(t => t.project_id === project.id);
  if (projectTasks.length > 0) {
    const done = projectTasks.filter(t => t.status === "done").length;
    const blocked = projectTasks.filter(t => t.status === "blocked").length;
    const overdue = projectTasks.filter(t =>
      t.due_date && new Date(t.due_date) < new Date() && t.status !== "done"
    ).length;
    const base = (done / projectTasks.length) * weights.tasks;
    const penalty = ((blocked + overdue) / projectTasks.length) * weights.tasks * 0.5;
    score += Math.max(0, base - penalty);
  } else {
    score += weights.tasks * 0.5; // neutral if no tasks
  }

  // Milestones score (0-25)
  const projectMilestones = milestones.filter(m => m.project_id === project.id);
  if (projectMilestones.length > 0) {
    const completedM = projectMilestones.filter(m => m.status === "completed").length;
    const overdueM = projectMilestones.filter(m =>
      m.target_date && new Date(m.target_date) < new Date() && m.status !== "completed"
    ).length;
    const base = (completedM / projectMilestones.length) * weights.milestones;
    const penalty = (overdueM / projectMilestones.length) * weights.milestones * 0.6;
    score += Math.max(0, base - penalty);
  } else {
    score += weights.milestones * 0.5;
  }

  return Math.round(Math.min(100, score));
}

function HealthBadge({ score }) {
  if (score >= 75) return { label: "Saludable", color: "text-green-600", bg: "bg-green-50", icon: CheckCircle2, ring: "ring-green-200" };
  if (score >= 50) return { label: "Moderado", color: "text-amber-600", bg: "bg-amber-50", icon: AlertTriangle, ring: "ring-amber-200" };
  return { label: "En riesgo", color: "text-red-600", bg: "bg-red-50", icon: XCircle, ring: "ring-red-200" };
}

function ScoreRing({ score }) {
  const r = 28, c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#F1F5F9" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${filled} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill={color} fontFamily="Space Grotesk">{score}</text>
    </svg>
  );
}

export default function ProjectHealthCard({ projects, tasks, milestones }) {
  const scored = projects
    .filter(p => p.status === "active" || p.status === "on_hold")
    .map(p => ({ ...p, score: getHealthScore(p, tasks, milestones) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);

  if (scored.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-[#33A19A]" />
        <h3 className="font-heading font-semibold text-[#1B2731]">Salud de Proyectos</h3>
      </div>

      <div className="space-y-3">
        {scored.map(p => {
          const badge = HealthBadge({ score: p.score });
          const Icon = badge.icon;
          const projectTasks = tasks.filter(t => t.project_id === p.id);
          const openTasks = projectTasks.filter(t => t.status !== "done").length;
          const projectMilestones = milestones.filter(m => m.project_id === p.id);
          const pendingMilestones = projectMilestones.filter(m => m.status !== "completed").length;

          return (
            <div key={p.id} className={`flex items-center gap-4 p-3 rounded-xl ring-1 ${badge.ring} ${badge.bg}`}>
              <ScoreRing score={p.score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[#1B2731] text-sm truncate">{p.name}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.color} ring-1 ${badge.ring}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[#3E4C59]">
                  <span className="flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />{p.progress || 0}%
                  </span>
                  <span className="flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" />{openTasks} tareas abiertas
                  </span>
                  {pendingMilestones > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Flag className="w-3 h-3" />{pendingMilestones} hitos
                    </span>
                  )}
                </div>
                {/* mini progress bar */}
                <div className="h-1 bg-white/60 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${p.score}%`,
                      backgroundColor: p.score >= 75 ? "#22c55e" : p.score >= 50 ? "#f59e0b" : "#ef4444"
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[#B7CAC9] mt-3 text-right">
        Score basado en progreso (40%), tareas (35%) e hitos (25%)
      </p>
    </div>
  );
}