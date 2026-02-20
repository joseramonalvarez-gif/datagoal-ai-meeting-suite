import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Flag, CheckCircle2, Circle, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-gray-100 text-gray-600", icon: Circle },
  in_progress: { label: "En progreso", color: "bg-blue-50 text-blue-700", icon: Clock },
  completed: { label: "Completado", color: "bg-green-50 text-green-700", icon: CheckCircle2 },
};

export default function Milestones({ selectedClient }) {
  const [milestones, setMilestones] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", project_id: "", target_date: "", status: "pending" });

  useEffect(() => { loadData(); }, [selectedClient]);

  const loadData = async () => {
    setLoading(true);
    const filters = selectedClient ? { client_id: selectedClient.id } : {};
    const [ms, p] = await Promise.all([
      selectedClient ? base44.entities.Milestone.filter(filters, '-target_date', 100) : base44.entities.Milestone.list('-target_date', 100),
      selectedClient ? base44.entities.Project.filter({ client_id: selectedClient.id }) : base44.entities.Project.list()
    ]);
    setMilestones(ms);
    setProjects(p);
    setLoading(false);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ title: "", description: "", project_id: "", target_date: "", status: "pending" });
    setShowForm(true);
  };

  const openEdit = (ms) => {
    setEditItem(ms);
    setForm({ title: ms.title, description: ms.description || "", project_id: ms.project_id || "", target_date: ms.target_date || "", status: ms.status || "pending" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (editItem) {
      await base44.entities.Milestone.update(editItem.id, { ...form, client_id: selectedClient?.id || "" });
    } else {
      await base44.entities.Milestone.create({ ...form, client_id: selectedClient?.id || "" });
    }
    setShowForm(false);
    loadData();
  };

  const handleComplete = async (ms) => {
    await base44.entities.Milestone.update(ms.id, { status: "completed" });
    loadData();
  };

  const handleDelete = async (id) => {
    await base44.entities.Milestone.delete(id);
    loadData();
  };

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || "—";

  const grouped = {
    pending: milestones.filter(ms => ms.status === "pending"),
    in_progress: milestones.filter(ms => ms.status === "in_progress"),
    completed: milestones.filter(ms => ms.status === "completed"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Hitos</h1>
          <p className="text-sm text-[#3E4C59] mt-1">Gestiona los hitos y entregables del proyecto</p>
        </div>
        <Button onClick={openCreate} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
          <Plus className="w-4 h-4" /> Nuevo Hito
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([statusKey, items]) => {
            if (items.length === 0) return null;
            const cfg = STATUS_CONFIG[statusKey];
            const Icon = cfg.icon;
            return (
              <div key={statusKey}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-[#3E4C59]" />
                  <h3 className="font-heading font-semibold text-[#3E4C59] text-sm uppercase tracking-wider">{cfg.label} ({items.length})</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map(ms => {
                    const isOverdue = ms.target_date && new Date(ms.target_date) < new Date() && ms.status !== "completed";
                    return (
                      <div key={ms.id} onClick={() => openEdit(ms)}
                        className="bg-white rounded-xl border border-[#B7CAC9]/20 p-4 hover:shadow-lg transition-all duration-300 cursor-pointer group">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Flag className={`w-4 h-4 ${ms.status === 'completed' ? 'text-green-500' : isOverdue ? 'text-red-500' : 'text-[#33A19A]'}`} />
                            <h4 className="font-heading font-semibold text-[#1B2731] text-sm">{ms.title}</h4>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={e => { e.stopPropagation(); handleDelete(ms.id); }}>
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </Button>
                        </div>
                        {ms.description && <p className="text-xs text-[#3E4C59] mb-3 line-clamp-2">{ms.description}</p>}
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-xs text-[#3E4C59]">{getProjectName(ms.project_id)}</p>
                            {ms.target_date && (
                              <p className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : 'text-[#3E4C59]'}`}>
                                <Clock className="w-3 h-3" />
                                {format(new Date(ms.target_date), "dd MMM yyyy", { locale: es })}
                                {isOverdue && " · Vencido"}
                              </p>
                            )}
                          </div>
                          {ms.status !== "completed" && (
                            <Button size="sm" variant="outline"
                              className="text-xs h-7 border-[#33A19A] text-[#33A19A] hover:bg-[#33A19A] hover:text-white"
                              onClick={e => { e.stopPropagation(); handleComplete(ms); }}>
                              Completar
                            </Button>
                          )}
                        </div>
                        <Badge className={`mt-2 border-0 text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {milestones.length === 0 && (
            <div className="text-center py-16 text-[#3E4C59]">
              <Flag className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
              <p>No hay hitos definidos aún</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">{editItem ? "Editar Hito" : "Nuevo Hito"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Proyecto</label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Fecha objetivo</label>
              <Input type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium">Estado</label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En progreso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">
              {editItem ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}