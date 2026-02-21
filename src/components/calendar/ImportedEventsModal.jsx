import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, CheckSquare, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function ImportedEventsModal({ open, onClose, events, projects, selectedClient }) {
  const [assignments, setAssignments] = useState(() =>
    events.map(e => ({
      ...e,
      importAs: e.categories === "TASK" ? "task" : "meeting",
      project_id: "",
      skip: false,
    }))
  );
  const [saving, setSaving] = useState(false);

  const update = (idx, patch) => {
    setAssignments(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a));
  };

  const handleImport = async () => {
    setSaving(true);
    let created = 0;
    for (const ev of assignments) {
      if (ev.skip || !ev.project_id) continue;
      if (ev.importAs === "meeting") {
        await base44.entities.Meeting.create({
          client_id: selectedClient?.id || "",
          project_id: ev.project_id,
          title: ev.summary,
          date: ev.date ? ev.date.toISOString() : new Date().toISOString(),
          objective: ev.description || "",
          status: "scheduled",
        });
      } else {
        const due = ev.date ? format(ev.date, "yyyy-MM-dd") : "";
        await base44.entities.Task.create({
          client_id: selectedClient?.id || "",
          project_id: ev.project_id,
          title: ev.summary,
          description: ev.description || "",
          due_date: due,
          status: "todo",
          priority: "medium",
        });
      }
      created++;
    }
    toast.success(`${created} evento(s) importado(s) correctamente`);
    setSaving(false);
    onClose?.();
  };

  const validCount = assignments.filter(a => !a.skip && a.project_id).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Importar eventos desde .ics</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[#3E4C59]">Asigna cada evento a un proyecto y elige si importarlo como reunión o tarea.</p>

        <div className="space-y-2 mt-2">
          {assignments.map((ev, i) => (
            <div key={i} className={`p-3 rounded-lg border transition-colors ${ev.skip ? "opacity-40 bg-gray-50 border-gray-200" : "bg-white border-[#B7CAC9]/30"}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => update(i, { skip: !ev.skip })} className="mt-0.5 flex-shrink-0">
                  {ev.skip ? <X className="w-4 h-4 text-red-400" /> : <Check className="w-4 h-4 text-green-500" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1B2731] truncate">{ev.summary}</p>
                  {ev.date && (
                    <p className="text-[11px] text-[#3E4C59]">
                      {format(ev.date, "dd MMM yyyy, HH:mm", { locale: es })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Select value={ev.importAs} onValueChange={v => update(i, { importAs: v })}>
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting"><span className="flex items-center gap-1"><Users className="w-3 h-3" /> Reunión</span></SelectItem>
                      <SelectItem value="task"><span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" /> Tarea</span></SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={ev.project_id} onValueChange={v => update(i, { project_id: v })}>
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue placeholder="Proyecto…" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleImport}
            disabled={validCount === 0 || saving}
            className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Importar {validCount > 0 ? `(${validCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}