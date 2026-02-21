import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, FolderOpen, Search, Calendar as CalIcon, MoreVertical, Edit, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

const STATUS_COLORS = {
  active: "bg-green-50 text-green-700",
  on_hold: "bg-amber-50 text-amber-700",
  completed: "bg-blue-50 text-blue-700",
  archived: "bg-gray-100 text-gray-600",
};

export default function Projects({ selectedClient }) {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editProj, setEditProj] = useState(null);
  const [search, setSearch] = useState("");
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: "", industry: "" });
  const [form, setForm] = useState({ name: "", description: "", client_id: "", status: "active", start_date: "", end_date: "" });

  useEffect(() => { loadData(); }, [selectedClient]);

  const loadData = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([
      selectedClient ? base44.entities.Project.filter({ client_id: selectedClient.id }) : base44.entities.Project.list(),
      base44.entities.Client.list()
    ]);
    setProjects(p);
    setClients(c);
    setLoading(false);
  };

  const openNew = () => {
    setEditProj(null);
    setForm({ name: "", description: "", client_id: selectedClient?.id || "", status: "active", start_date: "", end_date: "" });
    setShowDialog(true);
  };

  const openEdit = (p) => {
    setEditProj(p);
    setForm({ name: p.name, description: p.description || "", client_id: p.client_id, status: p.status || "active", start_date: p.start_date || "", end_date: p.end_date || "" });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (editProj) {
      await base44.entities.Project.update(editProj.id, form);
    } else {
      await base44.entities.Project.create(form);
    }
    setShowDialog(false);
    loadData();
  };

  const handleDelete = async (id) => {
    await base44.entities.Project.delete(id);
    loadData();
  };

  const handleCreateClient = async () => {
    if (!newClientForm.name.trim()) return;
    const newClient = await base44.entities.Client.create(newClientForm);
    // Auto-trigger Drive folder creation
    try {
      await base44.functions.invoke('createClientFolderStructure', {
        client_id: newClient.id,
        client_name: newClient.name,
      });
    } catch (err) {
      console.error('Drive folder creation failed:', err);
      // No bloquear si falla Drive
    }
    setClients([...clients, newClient]);
    setForm({ ...form, client_id: newClient.id });
    setShowNewClientModal(false);
    setNewClientForm({ name: "", industry: "" });
  };

  const getClientName = (id) => clients.find(c => c.id === id)?.name || "—";
  const filtered = projects.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Proyectos</h1>
          <p className="text-sm text-[#3E4C59] mt-1">Gestiona los proyectos de consultoría</p>
        </div>
        <Button onClick={openNew} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
          <Plus className="w-4 h-4" /> Nuevo Proyecto
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B7CAC9]" />
        <Input placeholder="Buscar proyecto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-white border-[#B7CAC9]/30" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1B2731]/5 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-[#1B2731]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-[#1B2731]">{p.name}</h3>
                    <p className="text-xs text-[#3E4C59]">{getClientName(p.client_id)}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(p)}><Edit className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(p.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Eliminar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {p.description && <p className="text-sm text-[#3E4C59] mt-3 line-clamp-2">{p.description}</p>}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-[#3E4C59] mb-1">
                  <span>Progreso</span>
                  <span>{p.progress || 0}%</span>
                </div>
                <Progress value={p.progress || 0} className="h-2" />
              </div>
              <div className="flex items-center justify-between mt-3">
                <Badge className={`${STATUS_COLORS[p.status] || STATUS_COLORS.active} border-0 text-xs`}>
                  {p.status === 'active' ? 'Activo' : p.status === 'on_hold' ? 'En pausa' : p.status === 'completed' ? 'Completado' : 'Archivado'}
                </Badge>
                {p.end_date && (
                  <span className="flex items-center gap-1 text-xs text-[#3E4C59]">
                    <CalIcon className="w-3 h-3" /> {format(new Date(p.end_date), "dd/MM/yyyy")}
                  </span>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#3E4C59]">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
              <p>No se encontraron proyectos</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{editProj ? "Editar Proyecto" : "Nuevo Proyecto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
             <div>
               <label className="text-sm font-medium">Cliente *</label>
               <div className="flex gap-2 mt-1">
                 <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                   <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                   <SelectContent>
                     {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
                 <Button variant="outline" onClick={() => setShowNewClientModal(true)} className="px-3">+ Nuevo</Button>
               </div>
             </div>
            <div>
              <label className="text-sm font-medium">Nombre *</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Fecha inicio</label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Fecha fin</label>
                <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.client_id} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">
              {editProj ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Crear Cliente On-the-Fly */}
      <Dialog open={showNewClientModal} onOpenChange={setShowNewClientModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Crear Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre *</label>
              <Input 
                value={newClientForm.name} 
                onChange={e => setNewClientForm({ ...newClientForm, name: e.target.value })} 
                placeholder="Ej: Acme Corp" 
                className="mt-1" 
              />
            </div>
            <div>
              <label className="text-sm font-medium">Industria</label>
              <Input 
                value={newClientForm.industry} 
                onChange={e => setNewClientForm({ ...newClientForm, industry: e.target.value })} 
                placeholder="Ej: Finanzas" 
                className="mt-1" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClientModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateClient} disabled={!newClientForm.name.trim()} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">
              Crear Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}