import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, Calendar, ChevronRight, Search, FileText, Mic, Brain, Paperclip, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import MeetingForm from "../components/meetings/MeetingForm";
import MeetingActions from "../components/meetings/MeetingActions";
import TranscriptViewer from "../components/meetings/TranscriptViewer";
import ReportViewer from "../components/meetings/ReportViewer";
import MeetingCalendarLink from "../components/meetings/MeetingCalendarLink";
import MeetingAttachments from "../components/meetings/MeetingAttachments";
import MeetingMinutes from "../components/meetings/MeetingMinutes";

const STATUS_LABELS = {
  scheduled: { label: "Programada", color: "bg-blue-50 text-blue-700" },
  recorded: { label: "Grabada", color: "bg-purple-50 text-purple-700" },
  transcribed: { label: "Transcrita", color: "bg-amber-50 text-amber-700" },
  report_generated: { label: "Informe generado", color: "bg-green-50 text-green-700" },
  approved: { label: "Aprobada", color: "bg-[#33A19A]/10 text-[#33A19A]" },
  closed: { label: "Cerrada", color: "bg-gray-100 text-gray-600" },
};

export default function Meetings({ selectedClient }) {
  const [meetings, setMeetings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMeeting, setEditMeeting] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => { loadData(); }, [selectedClient]);

  const loadData = async () => {
    setLoading(true);
    const filters = selectedClient ? { client_id: selectedClient.id } : {};
    const [m, p] = await Promise.all([
      selectedClient ? base44.entities.Meeting.filter(filters, '-created_date', 50) : base44.entities.Meeting.list('-created_date', 50),
      selectedClient ? base44.entities.Project.filter({ client_id: selectedClient.id }) : base44.entities.Project.list()
    ]);
    setMeetings(m);
    setProjects(p);
    setLoading(false);
  };

  const handleSaveMeeting = async (data) => {
    if (editMeeting) {
      await base44.entities.Meeting.update(editMeeting.id, data);
    } else {
      await base44.entities.Meeting.create(data);
    }
    setShowForm(false);
    setEditMeeting(null);
    loadData();
  };

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || "—";
  const filtered = meetings.filter(m => m.title?.toLowerCase().includes(search.toLowerCase()));

  if (selectedMeeting) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-[#3E4C59]">
          <button onClick={() => setSelectedMeeting(null)} className="hover:text-[#33A19A] transition-colors">Reuniones</button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-[#1B2731] font-medium">{selectedMeeting.title}</span>
        </div>

        <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="font-heading text-xl font-bold text-[#1B2731]">{selectedMeeting.title}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-[#3E4C59]">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {selectedMeeting.date ? format(new Date(selectedMeeting.date), "dd MMM yyyy, HH:mm", { locale: es }) : "—"}</span>
                <span>•</span>
                <span>{getProjectName(selectedMeeting.project_id)}</span>
              </div>
              {selectedMeeting.objective && <p className="text-sm text-[#3E4C59] mt-2">{selectedMeeting.objective}</p>}
            </div>
            <Badge className={`${STATUS_LABELS[selectedMeeting.status]?.color || ''} border-0`}>
              {STATUS_LABELS[selectedMeeting.status]?.label || selectedMeeting.status}
            </Badge>
          </div>

          {/* Participants */}
          {selectedMeeting.participants?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wider mb-2">Participantes</h4>
              <div className="flex flex-wrap gap-2">
                {selectedMeeting.participants.map((p, i) => (
                  <Badge key={i} className="bg-[#33A19A]/10 text-[#33A19A] border-0">{p.name} ({p.email})</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-[#B7CAC9]/20 pt-4">
            <h4 className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wider mb-3">Acciones</h4>
            <MeetingActions meeting={selectedMeeting} onUpdate={async () => {
              const updated = await base44.entities.Meeting.filter({ id: selectedMeeting.id });
              if (updated[0]) setSelectedMeeting(updated[0]);
              loadData();
            }} />
          </div>
        </div>

        {/* Tabs: Transcript & Report */}
        <Tabs defaultValue="transcript" className="bg-white rounded-xl border border-[#B7CAC9]/20">
          <TabsList className="w-full border-b border-[#B7CAC9]/20 bg-transparent p-0 h-auto">
            <TabsTrigger value="transcript" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#33A19A] data-[state=active]:bg-transparent px-6 py-3">
              <Mic className="w-4 h-4 mr-2" /> Transcripción
            </TabsTrigger>
            <TabsTrigger value="report" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#33A19A] data-[state=active]:bg-transparent px-6 py-3">
              <Brain className="w-4 h-4 mr-2" /> Informe
            </TabsTrigger>
          </TabsList>
          <TabsContent value="transcript" className="p-6">
            <TranscriptViewer meetingId={selectedMeeting.id} />
          </TabsContent>
          <TabsContent value="report" className="p-6">
            <ReportViewer meetingId={selectedMeeting.id} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Reuniones</h1>
          <p className="text-sm text-[#3E4C59] mt-1">Gestiona y transcribe reuniones de consultoría</p>
        </div>
        <Button onClick={() => { setEditMeeting(null); setShowForm(true); }} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
          <Plus className="w-4 h-4" /> Nueva Reunión
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B7CAC9]" />
        <Input placeholder="Buscar reunión..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-white border-[#B7CAC9]/30" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} onClick={() => setSelectedMeeting(m)}
              className="bg-white rounded-xl border border-[#B7CAC9]/20 p-4 hover:shadow-lg transition-all duration-300 cursor-pointer group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#1B2731]/5 flex items-center justify-center group-hover:bg-[#33A19A]/10 transition-colors">
                    <Users className="w-5 h-5 text-[#3E4C59] group-hover:text-[#33A19A] transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-[#1B2731]">{m.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-[#3E4C59] mt-1">
                      <span>{m.date ? format(new Date(m.date), "dd MMM yyyy, HH:mm", { locale: es }) : "Sin fecha"}</span>
                      <span>•</span>
                      <span>{getProjectName(m.project_id)}</span>
                      <span>•</span>
                      <span>{m.participants?.length || 0} participantes</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`${STATUS_LABELS[m.status]?.color || 'bg-gray-100 text-gray-600'} border-0 text-xs`}>
                    {STATUS_LABELS[m.status]?.label || m.status || 'Pendiente'}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-[#B7CAC9] group-hover:text-[#33A19A] transition-colors" />
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-[#3E4C59]">
              <Users className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
              <p>No se encontraron reuniones</p>
            </div>
          )}
        </div>
      )}

      <MeetingForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSaveMeeting}
        meeting={editMeeting}
        projects={projects}
        selectedClient={selectedClient}
      />
    </div>
  );
}