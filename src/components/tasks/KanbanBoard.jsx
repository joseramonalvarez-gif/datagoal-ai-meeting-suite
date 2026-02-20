import React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, User, AlertTriangle, GripVertical } from "lucide-react";
import { format } from "date-fns";

const COLUMNS = [
  { key: "backlog", label: "Backlog", color: "#9CA3AF" },
  { key: "todo", label: "Por hacer", color: "#3B82F6" },
  { key: "in_progress", label: "En progreso", color: "#33A19A" },
  { key: "blocked", label: "Bloqueado", color: "#EF4444" },
  { key: "in_review", label: "En revisión", color: "#F59E0B" },
  { key: "done", label: "Hecho", color: "#22C55E" },
];

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-700",
};

export default function KanbanBoard({ tasks, onTaskClick, onStatusChange }) {
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) onStatusChange(taskId, newStatus);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.key);
        return (
          <div
            key={col.key}
            className="flex-shrink-0 w-72 bg-[#FFFAF3] rounded-xl border border-[#B7CAC9]/20"
            onDrop={(e) => handleDrop(e, col.key)}
            onDragOver={handleDragOver}
          >
            <div className="p-3 border-b border-[#B7CAC9]/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="text-sm font-heading font-semibold text-[#1B2731]">{col.label}</span>
              </div>
              <span className="text-xs text-[#B7CAC9] font-medium">{colTasks.length}</span>
            </div>
            <div className="p-2 space-y-2 kanban-column min-h-[200px]">
              {colTasks.map(task => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => onTaskClick(task)}
                    className="bg-white rounded-lg p-3 border border-[#B7CAC9]/15 hover:shadow-md transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-[#1B2731] leading-tight line-clamp-2 flex-1">{task.title}</h4>
                      <GripVertical className="w-4 h-4 text-[#B7CAC9] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className={`${PRIORITY_COLORS[task.priority] || ''} border-0 text-[10px] px-1.5 py-0`}>
                        {task.priority}
                      </Badge>
                      {task.assignee_name && (
                        <span className="flex items-center gap-1 text-[10px] text-[#3E4C59]">
                          <User className="w-3 h-3" /> {task.assignee_name}
                        </span>
                      )}
                      {task.due_date && (
                        <span className={`flex items-center gap-1 text-[10px] ${isOverdue ? 'text-red-600' : 'text-[#3E4C59]'}`}>
                          {isOverdue && <AlertTriangle className="w-3 h-3" />}
                          <Clock className="w-3 h-3" /> {format(new Date(task.due_date), "dd/MM")}
                        </span>
                      )}
                    </div>
                    {task.evidence_segments?.length > 0 && (
                      <div className="mt-2 text-[10px] text-[#33A19A] font-medium">
                        📎 {task.evidence_segments.length} evidencia(s)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}