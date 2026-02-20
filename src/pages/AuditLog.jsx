import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, User, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ACTION_COLORS = {
  email_sent: "bg-blue-50 text-blue-700",
  report_generated: "bg-[#33A19A]/10 text-[#33A19A]",
  task_created: "bg-purple-50 text-purple-700",
  document_uploaded: "bg-amber-50 text-amber-700",
  permission_changed: "bg-red-50 text-red-700",
  project_closed: "bg-gray-100 text-gray-600",
  approval_requested: "bg-[#1B2731]/10 text-[#1B2731]",
  approval_decision: "bg-green-50 text-green-700",
};

export default function AuditLog({ selectedClient }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");

  useEffect(() => { loadLogs(); }, [selectedClient]);

  const loadLogs = async () => {
    setLoading(true);
    const filters = selectedClient ? { client_id: selectedClient.id } : {};
    const data = selectedClient
      ? await base44.entities.AuditLog.filter(filters, '-timestamp', 200)
      : await base44.entities.AuditLog.list('-timestamp', 200);
    setLogs(data);
    setLoading(false);
  };

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.user_email?.includes(search) || l.details?.toLowerCase().includes(search.toLowerCase()) || l.action?.includes(search);
    const matchAction = filterAction === "all" || l.action === filterAction;
    return matchSearch && matchAction;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Auditoría</h1>
        <p className="text-sm text-[#3E4C59] mt-1">Registro de acciones relevantes en el sistema</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B7CAC9]" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-white border-[#B7CAC9]/30" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Acción" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#B7CAC9]/20 divide-y divide-[#B7CAC9]/10">
          {filtered.map(log => (
            <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-[#FFFAF3] transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#33A19A]/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-[#33A19A]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <Badge className={`border-0 text-[10px] ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                    {log.action}
                  </Badge>
                  <span className="text-xs text-[#3E4C59] flex items-center gap-1">
                    <User className="w-3 h-3" /> {log.user_email}
                  </span>
                  <span className="text-xs text-[#B7CAC9] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.timestamp ? format(new Date(log.timestamp), "dd MMM yyyy, HH:mm", { locale: es }) : "—"}
                  </span>
                </div>
                {log.details && <p className="text-xs text-[#1B2731] mt-1">{log.details}</p>}
                <div className="flex gap-2 mt-1 text-[10px] text-[#B7CAC9]">
                  {log.entity_type && <span>Entidad: {log.entity_type}</span>}
                  {log.entity_id && <span>ID: {log.entity_id}</span>}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-[#B7CAC9]">
              <Shield className="w-12 h-12 mx-auto mb-3" />
              <p className="text-sm">No hay registros de auditoría</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}