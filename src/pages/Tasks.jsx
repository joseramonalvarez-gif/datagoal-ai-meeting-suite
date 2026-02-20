import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, LayoutGrid, List, User, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import KanbanBoard from "../components/tasks/KanbanBoard";
import TaskDetail from "../components/tasks/TaskDetail";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function Tasks({ selectedClient }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", project_id: "", priority: "medium", assignee_name: "", assignee_email: "", due_date: "" });

  useEffect(() => { loadData(); }, [selectedClient]);

  const loadData = async () => {
    setLoading(true);
    const filters = selectedClient ? { client_id: selectedClient.id } : {};
    const [t, p] = await Promise.all([
      selectedClient ? base44.entities.Task.filter(filters, '-created_date', 200) : base44.entities.Task.list('-created_date', 200),
      selectedClient ? base44.entities.Project.filter({ client_id: selectedClient.id }) : base44.entities.Project.list()
    ]);
    setTasks(t);
    setProjects(p);
    setLoading(false);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    await base44.entities.Task.update(taskId, { status: newStatus });
    loadData();
  };

  const handleCreateTask = async () => {
    await base44.entities.Task.create({
      ...newTask,
      client_id: selectedClient?.id || "",
      status: "todo",
    });
    setShowNewTask(false);
    setNewTask({ title: "", description: "", project_id: "", priority: "medium", assignee_name: "", assignee_email: "", due_date: "" });
    loadData();
  };

  const filtered = tasks.filter(t => {
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase());
    const matchProject = filterProject === "all" || t.project_id === filterProject;
    const matchPriority = filterPriority === "all" || t.priority === filterPriority;
    return matchSearch && matchProject && matchPriority;
  });

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Tareas</h1>
          <p className="text-sm text-[#3E4C59] mt-1">Gestiona las tareas extraídas de reuniones</p>
        </div>
        <Button onClick={() => setShowNewTask(true)} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
          <Plus className="w-4 h-4" /> Nueva Tarea
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B7CAC9]" />
          <Input placeholder="Buscar tarea..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-white border-[#B7CAC9]/30" />
        </div>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Proyecto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 bg-white"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
        </div>
      ) : (
        <Tabs defaultValue="kanban">
          <TabsList className="bg-white border border-[#B7CAC9]/20">
            <TabsTrigger value="kanban"><LayoutGrid className="w-4 h-4 mr-1" /> Kanban</TabsTrigger>
            <TabsTrigger value="list"><List className="w-4 h-4 mr-1" /> Lista</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban" className="mt-4">
            <KanbanBoard tasks={filtered} onTaskClick={setSelectedTask} onStatusChange={handleStatusChange} />
          </TabsContent>
          <TabsContent value="list" className="mt-4">
            <div className="bg-white rounded-xl border border-[#B7CAC9]/20 divide-y divide-[#B7CAC9]/10">
              {filtered.map(task => (
                <div key={task.id} onClick={() => setSelectedTask(task)}
                  className="flex items-center justify-between p-4 hover:bg-[#FFFAF3] transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${task.status === 'done' ? 'bg-green-500' : task.status === 'blocked' ? 'bg-red-500' : 'bg-[#33A19A]'}`} />
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-[#1B2731] truncate">{task.title}</h4>
                      <p className="text-xs text-[#3E4C59]">{getProjectName(task.project_id)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {task.assignee_name && (
                      <span className="text-xs text-[#3E4C59] flex items-center gap-1"><User className="w-3 h-3" /> {task.assignee_name}</span>
                    )}
                    {task.due_date && (
                      <span className="text-xs text-[#3E4C59]">{format(new Date(task.due_date), "dd/MM")}</span>
                    )}
                    <Badge className={`border-0 text-[10px] ${
                      task.priority === 'urgent' ? 'bg-red-50 text-red-700' : task.priority === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>{task.priority}</Badge>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="p-8 text-center text-sm text-[#3E4C59]">No hay tareas</div>}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <TaskDetail task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} onUpdate={loadData} />

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Nueva Tarea</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Proyecto *</label>
              <Select value={newTask.project_id} onValueChange={v => setNewTask({ ...newTask, project_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} className="mt-1" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Prioridad</label>
                <Select value={newTask.priority} onValueChange={v => setNewTask({ ...newTask, priority: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Fecha límite</label>
                <Input type="date" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Responsable</label>
              <Input value={newTask.assignee_name} onChange={e => setNewTask({ ...newTask, assignee_name: e.target.value })} placeholder="Nombre" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTask(false)}>Cancelar</Button>
            <Button onClick={handleCreateTask} disabled={!newTask.title || !newTask.project_id} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}