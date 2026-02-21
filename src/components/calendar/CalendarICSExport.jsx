import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, Loader2, Calendar, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

function escapeICS(str) {
  return (str || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toICSDate(dateStr) {
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function buildICSContent(meetings, tasks) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DATA GOAL//Calendar//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const m of meetings) {
    if (!m.date) continue;
    const start = toICSDate(m.date);
    const end = toICSDate(new Date(new Date(m.date).getTime() + 60 * 60 * 1000).toISOString());
    lines.push(
      "BEGIN:VEVENT",
      `UID:meeting-${m.id}@datagoal`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:📅 ${escapeICS(m.title)}`,
      `DESCRIPTION:${escapeICS(m.objective || "")}`,
      `CATEGORIES:MEETING`,
      "END:VEVENT"
    );
  }

  for (const t of tasks) {
    if (!t.due_date || t.status === "done") continue;
    const due = toICSDate(t.due_date + "T09:00:00");
    const end = toICSDate(t.due_date + "T10:00:00");
    lines.push(
      "BEGIN:VEVENT",
      `UID:task-${t.id}@datagoal`,
      `DTSTART:${due}`,
      `DTEND:${end}`,
      `SUMMARY:✅ ${escapeICS(t.title)}`,
      `DESCRIPTION:Prioridad: ${escapeICS(t.priority)}\\nAsignado: ${escapeICS(t.assignee_name || "")}`,
      `CATEGORIES:TASK`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function parseICSEvents(icsText) {
  const events = [];
  const blocks = icsText.split("BEGIN:VEVENT").slice(1);
  for (const block of blocks) {
    const get = (key) => {
      const match = block.match(new RegExp(`${key}[^:]*:([^\r\n]+)`));
      return match ? match[1].replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";") : "";
    };
    const uid = get("UID");
    const summary = get("SUMMARY").replace(/^[📅✅]\s*/, "");
    const dtstart = get("DTSTART");
    const description = get("DESCRIPTION");
    const categories = get("CATEGORIES");
    let date = null;
    if (dtstart) {
      try {
        const d = dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, "$1-$2-$3T$4:$5:$6Z");
        date = new Date(d);
      } catch { }
    }
    events.push({ uid, summary, date, description, categories, raw: block });
  }
  return events;
}

export default function CalendarICSExport({ meetings, tasks, onImport }) {
  const [importing, setImporting] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    const ics = buildICSContent(meetings, tasks);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `datagoal-calendar-${format(new Date(), "yyyy-MM-dd")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
    toast.success("Calendario exportado como .ics");
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const events = parseICSEvents(ev.target.result);
      onImport?.(events);
      setImporting(false);
      toast.success(`${events.length} evento(s) importado(s) desde .ics`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleGCalLink = () => {
    // Build Google Calendar URL with webcal subscription
    const gcalUrl = `https://calendar.google.com/calendar/r/settings/addbyurl`;
    window.open(gcalUrl, "_blank");
    toast.info("En Google Calendar, pega la URL de tu feed .ics exportado");
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExport}>
        {exported ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Download className="w-3.5 h-3.5" />}
        Exportar .ics
      </Button>

      <label className="cursor-pointer">
        <input type="file" accept=".ics" className="hidden" onChange={handleImportFile} />
        <Button variant="outline" size="sm" className="gap-1.5 text-xs pointer-events-none" asChild>
          <span>
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Importar .ics
          </span>
        </Button>
      </label>

      <Button variant="outline" size="sm" className="gap-1.5 text-xs border-blue-200 text-blue-600 hover:bg-blue-50" onClick={handleGCalLink}>
        <Calendar className="w-3.5 h-3.5" />
        Sincronizar con Google Cal
      </Button>
    </div>
  );
}