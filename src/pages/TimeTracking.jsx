import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Clock, User, TrendingUp, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function TimeTracking({ selectedClient, user }) {
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    project_id: "", task_id: "", date: new Date().toISOString().split("T")[0],
    duration_minutes: 60, description: "", billable: true
  });

  useEffect(() => { loadData(); }, [selectedClient]);

  const loadData = async () => {
    setLoading(true);
    const filters = selectedClient ? { client_id: selectedClient.id } : {};
    const [e, p, t] = await Promise.all([
      selectedClient ? base44.entities.TimeEntry.filter(filters, '-date', 200) : base44.entities.TimeEntry.list('-date', 200),
      selectedClient ? base44.entities.Project.filter({ client_id: selectedClient.id }) : base44.entities.Project.list(),
      selectedClient ? base44.entities.Task.filter(filters) : base44.entities.Task.list()
    ]);
    setEntries(e);
    setProjects(p);
    setTasks(t);
    setLoading(false);
  };

  const handleCreate = async () => {
    await base44.entities.TimeEntry.create({
      ...form,
      client_id: selectedClient?.id || "",
      user_email: user?.email || "",
      user_name: user?.full_name || "",
    });
    setShowForm(false);
    setForm({ project_id: "", task_id: "", date: new Date().toISOString().split("T")[0], duration_minutes: 60, description: "", billable: true });
    loadData();
  };

  const handleDelete = async (id) => {
    await base44.entities.TimeEntry.delete(id);
    loadData();
  };

  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const billableMinutes = entries.filter(e => e.billable).reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const getProjectName = (id) => projects.find(p => p.id === id)?.name || "—";
  const getTaskName = (id) => tasks.find(t => t.id === id)?.title || "";

  // Chart data: by project
  const byProject = {};
  entries.forEach(e => {
    const name = getProjectName(e.project_id);
    byProject[name] = (byProject[name] || 0) + (e.duration_minutes || 0) / 60;
  });
  const chartData = Object.entries(byProject).map(([name, hours]) => ({ name: name.substring(0, 15), hours: parseFloat(hours.toFixed(1)) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Registro de Horas</h1>
          <p className="text-sm text-[#3E4C59] mt-1">Time tracking por proyecto y tarea</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
          <Plus className="w-4 h-4" /> Registrar Horas
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total horas", value: (totalMinutes / 60).toFixed(1), color: "#33A19A", icon: Clock },
          { label: "Horas facturables", value: (billableMinutes / 60).toFixed(1), color: "#1B2731", icon: TrendingUp },
          { label: "Registros", value: entries.length, color: "#3E4C59", icon: User },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#B7CAC9]/20 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + "18" }}>
              <s.icon className="w-5 h-5" style={{ color: s.color }} />
            </div>
            <div>
              <div className="font-heading text-2xl font-bold text-[#1B2731]">{s.value}</div>
              <div className="text-xs text-[#3E4C59]">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5">
          <h3 className="font-heading font-semibold text-[#1B2731] mb-4">Horas por Proyecto</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="hours" fill="#33A19A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entries list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#B7CAC9]/20 divide-y divide-[#B7CAC9]/10">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between p-4 hover:bg-[#FFFAF3] transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#33A19A]/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[#33A19A]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#1B2731]">{getProjectName(entry.project_id)}</div>
                  <div className="text-xs text-[#3E4C59]">
                    {entry.date} • {entry.user_name} {getTaskName(entry.task_id) && `• ${getTaskName(entry.task_id).substring(0, 30)}`}
                  </div>
                  {entry.description && <div className="text-xs text-[#B7CAC9] mt-0.5">{entry.description}</div>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={entry.billable ? "bg-green-50 text-green-700 border-0" : "bg-gray-100 text-gray-600 border-0"}>
                  {entry.billable ? "Facturable" : "No facturable"}
                </Badge>
                <span className="font-heading font-bold text-[#1B2731] text-sm">
                  {(entry.duration_minutes / 60).toFixed(1)}h
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(entry.id)}>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="text-center py-12 text-[#3E4C59]">
              <Clock className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
              <p>No hay registros de horas aún</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Registrar Horas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Proyecto *</label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Tarea (opcional)</label>
              <Select value={form.task_id} onValueChange={v => setForm({ ...form, task_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar tarea" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sin tarea</SelectItem>
                  {tasks.filter(t => !form.project_id || t.project_id === form.project_id).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title?.substring(0, 40)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Fecha</label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Duración (min)</label>
                <Input type="number" min={15} step={15} value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 60 })} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="billable" checked={form.billable} onChange={e => setForm({ ...form, billable: e.target.checked })} className="w-4 h-4 accent-[#33A19A]" />
              <label htmlFor="billable" className="text-sm font-medium cursor-pointer">Facturable</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.project_id} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}