import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link2, Plus, X, AlertTriangle, CheckCircle2 } from "lucide-react";

const STATUS_LABELS = {
  backlog: "Backlog", todo: "Por hacer", in_progress: "En progreso",
  blocked: "Bloqueado", in_review: "En revisión", done: "Hecho",
};

export default function TaskDependencies({ task, onUpdate }) {
  const [allTasks, setAllTasks] = useState([]);
  const [depTasks, setDepTasks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [selectedDep, setSelectedDep] = useState("");

  useEffect(() => { load(); }, [task.id]);

  const load = async () => {
    const all = await base44.entities.Task.filter({
      client_id: task.client_id,
      project_id: task.project_id,
    }, "created_date", 200);
    setAllTasks(all.filter(t => t.id !== task.id && !t.tags?.includes(`subtask_of:${task.id}`)));
    // Load current dependency details
    const depIds = task.dependencies || [];
    if (depIds.length > 0) {
      const deps = all.filter(t => depIds.includes(t.id));
      setDepTasks(deps);
    } else {
      setDepTasks([]);
    }
  };

  const handleAdd = async () => {
    if (!selectedDep) return;
    const currentDeps = task.dependencies || [];
    if (currentDeps.includes(selectedDep)) return;
    const updated = [...currentDeps, selectedDep];
    await base44.entities.Task.update(task.id, { dependencies: updated });
    setAdding(false);
    setSelectedDep("");
    onUpdate?.();
    load();
  };

  const handleRemove = async (depId) => {
    const updated = (task.dependencies || []).filter(id => id !== depId);
    await base44.entities.Task.update(task.id, { dependencies: updated });
    onUpdate?.();
    load();
  };

  const isBlocked = depTasks.some(d => d.status !== "done");
  const availableTasks = allTasks.filter(t => !(task.dependencies || []).includes(t.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wider flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" /> Dependencias
          {depTasks.length > 0 && (
            <Badge className={`text-[10px] border-0 ml-1 ${isBlocked ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
              {isBlocked ? "Bloqueada" : "Libre"}
            </Badge>
          )}
        </h4>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-[#33A19A]" onClick={() => setAdding(true)}>
          <Plus className="w-3 h-3" /> Añadir
        </Button>
      </div>

      {isBlocked && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Esta tarea no puede iniciarse hasta que terminen sus dependencias.
        </div>
      )}

      {depTasks.length === 0 && !adding && (
        <p className="text-xs text-[#B7CAC9]">Sin dependencias. Esta tarea puede iniciarse libremente.</p>
      )}

      <div className="space-y-1.5">
        {depTasks.map(dep => (
          <div key={dep.id} className="flex items-center gap-2 p-2 bg-[#F8FAFB] rounded-lg group">
            {dep.status === "done"
              ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#1B2731] truncate">{dep.title}</p>
              <p className="text-[10px] text-[#3E4C59]">{STATUS_LABELS[dep.status] || dep.status}</p>
            </div>
            <button
              onClick={() => handleRemove(dep.id)}
              className="opacity-0 group-hover:opacity-100 text-[#B7CAC9] hover:text-red-500 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="flex gap-2">
          <Select value={selectedDep} onValueChange={setSelectedDep}>
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="Seleccionar tarea bloqueante…" />
            </SelectTrigger>
            <SelectContent>
              {availableTasks.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${t.status === "done" ? "bg-green-500" : "bg-amber-500"}`} />
                    {t.title}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 bg-[#33A19A] hover:bg-[#2A857F] text-white" onClick={handleAdd} disabled={!selectedDep}>
            <Plus className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAdding(false); setSelectedDep(""); }}>✕</Button>
        </div>
      )}
    </div>
  );
}