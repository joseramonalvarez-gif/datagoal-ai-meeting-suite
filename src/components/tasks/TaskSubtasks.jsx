import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Circle, Trash2, ChevronRight } from "lucide-react";

const STATUS_COLORS = {
  done: "text-green-600",
  in_progress: "text-blue-500",
  blocked: "text-red-500",
  todo: "text-[#3E4C59]",
};

export default function TaskSubtasks({ parentTask, onSubtaskClick }) {
  const [subtasks, setSubtasks] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [parentTask.id]);

  const load = async () => {
    setLoading(true);
    const all = await base44.entities.Task.filter({
      client_id: parentTask.client_id,
      project_id: parentTask.project_id,
    }, "created_date", 200);
    // Filter those whose dependencies array contains this task's id as parent marker
    // We use a convention: subtasks have a tag "subtask_of:<parentId>"
    const subs = all.filter(t =>
      t.tags?.includes(`subtask_of:${parentTask.id}`)
    );
    setSubtasks(subs);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await base44.entities.Task.create({
      client_id: parentTask.client_id,
      project_id: parentTask.project_id,
      title: newTitle.trim(),
      status: "todo",
      priority: parentTask.priority || "medium",
      tags: [`subtask_of:${parentTask.id}`],
    });
    setNewTitle("");
    setAdding(false);
    load();
  };

  const toggleDone = async (subtask) => {
    const newStatus = subtask.status === "done" ? "todo" : "done";
    await base44.entities.Task.update(subtask.id, { status: newStatus });
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Task.delete(id);
    load();
  };

  const doneCount = subtasks.filter(s => s.status === "done").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wider">
          Subtareas
          {subtasks.length > 0 && (
            <span className="ml-2 text-[#33A19A]">{doneCount}/{subtasks.length}</span>
          )}
        </h4>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-[#33A19A]" onClick={() => setAdding(true)}>
          <Plus className="w-3 h-3" /> Añadir
        </Button>
      </div>

      {subtasks.length > 0 && (
        <div className="w-full bg-[#E8F5F4] rounded-full h-1.5 mb-2">
          <div className="bg-[#33A19A] h-1.5 rounded-full transition-all" style={{ width: `${subtasks.length ? (doneCount / subtasks.length) * 100 : 0}%` }} />
        </div>
      )}

      {loading ? (
        <div className="text-xs text-[#B7CAC9]">Cargando…</div>
      ) : (
        <div className="space-y-1">
          {subtasks.map(s => (
            <div key={s.id} className="flex items-center gap-2 group p-1.5 rounded-lg hover:bg-[#F8FAFB]">
              <button onClick={() => toggleDone(s)} className="flex-shrink-0">
                {s.status === "done"
                  ? <Check className="w-4 h-4 text-green-500" />
                  : <Circle className={`w-4 h-4 ${STATUS_COLORS[s.status] || "text-[#B7CAC9]"}`} />
                }
              </button>
              <span
                className={`flex-1 text-sm cursor-pointer hover:text-[#33A19A] ${s.status === "done" ? "line-through text-[#B7CAC9]" : "text-[#1B2731]"}`}
                onClick={() => onSubtaskClick && onSubtaskClick(s)}
              >
                {s.title}
              </span>
              <button
                className="opacity-0 group-hover:opacity-100 text-[#B7CAC9] hover:text-red-500 transition-opacity"
                onClick={() => handleDelete(s.id)}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="flex gap-2 mt-1">
          <Input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Título de la subtarea…"
            className="text-sm h-8"
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
          />
          <Button size="sm" className="h-8 bg-[#33A19A] hover:bg-[#2A857F] text-white" onClick={handleAdd} disabled={!newTitle.trim()}>
            <Plus className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setAdding(false)}>✕</Button>
        </div>
      )}
    </div>
  );
}