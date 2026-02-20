import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { LayoutDashboard, Users, CheckSquare, FileText, Clock, Flag, AlertTriangle } from "lucide-react";
import StatsCard from "../components/dashboard/StatsCard";
import RecentActivity from "../components/dashboard/RecentActivity";
import TaskOverview from "../components/dashboard/TaskOverview";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#33A19A", "#1B2731", "#3E4C59", "#B7CAC9", "#F59E0B", "#EF4444"];

export default function Dashboard({ selectedClient }) {
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [selectedClient]);

  const loadDashboard = async () => {
    setLoading(true);
    const filters = selectedClient ? { client_id: selectedClient.id } : {};
    const [m, t, p, te, ms] = await Promise.all([
      selectedClient ? base44.entities.Meeting.filter(filters, '-created_date', 50) : base44.entities.Meeting.list('-created_date', 50),
      selectedClient ? base44.entities.Task.filter(filters, '-created_date', 100) : base44.entities.Task.list('-created_date', 100),
      selectedClient ? base44.entities.Project.filter(filters) : base44.entities.Project.list(),
      selectedClient ? base44.entities.TimeEntry.filter(filters, '-created_date', 50) : base44.entities.TimeEntry.list('-created_date', 50),
      selectedClient ? base44.entities.Milestone.filter(filters) : base44.entities.Milestone.list(),
    ]);
    setMeetings(m);
    setTasks(t);
    setProjects(p);
    setTimeEntries(te);
    setMilestones(ms);
    setLoading(false);
  };

  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done");
  const totalHours = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / 60;

  const tasksByStatus = {};
  tasks.forEach(t => { tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1; });
  const pieData = Object.entries(tasksByStatus).map(([name, value]) => ({ name, value }));

  const projectProgress = projects.map(p => ({
    name: p.name?.substring(0, 15) || "Sin nombre",
    progreso: p.progress || 0,
  }));

  const recentActivity = [
    ...meetings.slice(0, 3).map(m => ({ type: "meeting", title: m.title, subtitle: `Reunión`, date: m.created_date })),
    ...tasks.slice(0, 3).map(t => ({ type: "task", title: t.title, subtitle: t.assignee_name || "Sin asignar", date: t.created_date })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-3 border-[#33A19A] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Panel de Control</h1>
        <p className="text-sm text-[#3E4C59] mt-1">
          {selectedClient ? `Cliente: ${selectedClient.name}` : "Vista general de todos los clientes"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatsCard title="Proyectos" value={projects.length} icon={LayoutDashboard} />
        <StatsCard title="Reuniones" value={meetings.length} icon={Users} color="#1B2731" />
        <StatsCard title="Tareas" value={tasks.length} icon={CheckSquare} color="#3E4C59" />
        <StatsCard title="Vencidas" value={overdueTasks.length} icon={AlertTriangle} color="#EF4444" />
        <StatsCard title="Hitos" value={milestones.length} icon={Flag} color="#F59E0B" />
        <StatsCard title="Horas" value={totalHours.toFixed(1)} subtitle="registradas" icon={Clock} />
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Progress */}
        <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5 lg:col-span-2">
          <h3 className="font-heading font-semibold text-[#1B2731] mb-4">Progreso por Proyecto</h3>
          {projectProgress.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={projectProgress} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="progreso" fill="#33A19A" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#3E4C59] text-center py-10">Sin proyectos aún</p>
          )}
        </div>

        {/* Task Pie */}
        <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5">
          <h3 className="font-heading font-semibold text-[#1B2731] mb-4">Tareas por Estado</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#3E4C59] text-center py-10">Sin tareas aún</p>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity items={recentActivity} />
        <TaskOverview tasks={tasks} />
      </div>
    </div>
  );
}