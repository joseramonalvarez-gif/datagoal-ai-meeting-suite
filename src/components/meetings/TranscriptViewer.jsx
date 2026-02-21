import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, User, FileText, Download, Edit2, Save, X, Search, Users, CheckCircle2, AlertCircle, Mic } from "lucide-react";
import { toast } from "sonner";

const SPEAKER_COLORS = [
  { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", dot: "#33A19A" },
  { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "#3B82F6" },
  { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "#F59E0B" },
  { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "#8B5CF6" },
  { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "#F43F5E" },
  { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "#6366F1" },
];

function getSpeakerColor(speakerId) {
  const idx = parseInt((speakerId || "0").replace(/\D/g, "") || "0") % SPEAKER_COLORS.length;
  return SPEAKER_COLORS[idx];
}

function buildSpeakerMap(segments) {
  const map = {};
  (segments || []).forEach(seg => {
    if (seg.speaker_id && !map[seg.speaker_id]) {
      map[seg.speaker_id] = seg.speaker_label || seg.speaker_id;
    }
  });
  return map;
}

export default function TranscriptViewer({ meetingId }) {
  const [transcripts, setTranscripts] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSegmentIdx, setEditingSegmentIdx] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [editingSpeaker, setEditingSpeaker] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [speakerMap, setSpeakerMap] = useState({});
  const textareaRef = useRef(null);

  useEffect(() => { loadTranscripts(); }, [meetingId]);

  useEffect(() => {
    if (selectedVersion) {
      setSpeakerMap(buildSpeakerMap(selectedVersion.segments));
    }
  }, [selectedVersion]);

  const loadTranscripts = async () => {
    setLoading(true);
    const data = await base44.entities.Transcript.filter({ meeting_id: meetingId }, '-version');
    setTranscripts(data);
    if (data.length > 0) setSelectedVersion(data[0]);
    setLoading(false);
  };

  const openEditSegment = (idx, seg) => {
    setEditingSegmentIdx(idx);
    setEditingText(seg.text_literal || "");
    setEditingSpeaker(seg.speaker_label || "");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditingSegmentIdx(null);
    setEditingText("");
    setEditingSpeaker("");
  };

  const saveSegment = async (idx) => {
    if (!selectedVersion) return;
    setSaving(true);
    const updatedSegments = selectedVersion.segments.map((s, i) =>
      i === idx ? { ...s, text_literal: editingText, speaker_label: editingSpeaker } : s
    );
    const updatedFullText = updatedSegments.map(s =>
      s.speaker_label ? `${s.speaker_label}: ${s.text_literal}` : s.text_literal
    ).join("\n");

    await base44.entities.Transcript.update(selectedVersion.id, {
      segments: updatedSegments,
      full_text: updatedFullText
    });
    const updated = { ...selectedVersion, segments: updatedSegments, full_text: updatedFullText };
    setSelectedVersion(updated);
    setTranscripts(prev => prev.map(t => t.id === updated.id ? updated : t));
    setEditingSegmentIdx(null);
    setSaving(false);
    toast.success("Segmento guardado");
  };

  // Export helpers
  const exportTranscript = (format) => {
    if (!selectedVersion) return;
    const segs = selectedVersion.segments || [];
    let content = "";
    let filename = `transcripcion_v${selectedVersion.version}`;

    if (format === "txt") {
      content = segs.length > 0
        ? segs.map(s => `[${s.start_time || ""}] ${s.speaker_label || ""}: ${s.text_literal || ""}`).join("\n")
        : selectedVersion.full_text || "";
      filename += ".txt";
    } else if (format === "srt") {
      content = segs.map((s, i) =>
        `${i + 1}\n${toSRT(s.start_time)} --> ${toSRT(s.end_time)}\n${s.speaker_label ? s.speaker_label + ": " : ""}${s.text_literal}\n`
      ).join("\n");
      filename += ".srt";
    } else if (format === "vtt") {
      content = "WEBVTT\n\n" + segs.map((s) =>
        `${toVTT(s.start_time)} --> ${toVTT(s.end_time)}\n${s.speaker_label ? s.speaker_label + ": " : ""}${s.text_literal}`
      ).join("\n\n");
      filename += ".vtt";
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportado como ${format.toUpperCase()}`);
    setShowExportDialog(false);
  };

  const toSRT = (t) => (t || "00:00:00").replace(/\./g, ",");
  const toVTT = (t) => t || "00:00:00.000";

  const filteredSegments = (selectedVersion?.segments || [])
    .map((seg, originalIdx) => ({ seg, originalIdx }))
    .filter(({ seg }) =>
      searchQuery === "" ||
      seg.text_literal?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seg.speaker_label?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const speakerList = Object.entries(speakerMap);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
    </div>
  );

  if (transcripts.length === 0) return (
    <div className="text-center py-10 text-[#3E4C59]">
      <FileText className="w-10 h-10 mx-auto mb-2 text-[#B7CAC9]" />
      <p className="text-sm">Aún no hay transcripción para esta reunión</p>
    </div>
  );

  const hasSegments = (selectedVersion?.segments?.length || 0) > 0;

  return (
    <div className="flex flex-col gap-4">

      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        {transcripts.length > 1 && (
          <Select value={selectedVersion?.id} onValueChange={v => setSelectedVersion(transcripts.find(t => t.id === v))}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {transcripts.map(t => (
                <SelectItem key={t.id} value={t.id}>v{t.version} — {t.source}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Badge className={`border text-xs font-medium ${selectedVersion?.has_timeline ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {selectedVersion?.has_timeline ? <><CheckCircle2 className="w-3 h-3 mr-1 inline" />Con timestamps</> : <><AlertCircle className="w-3 h-3 mr-1 inline" />Sin timestamps</>}
        </Badge>
        <Badge className={`border text-xs font-medium ${selectedVersion?.has_diarization ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {selectedVersion?.has_diarization ? <><Users className="w-3 h-3 mr-1 inline" />Con diarización</> : <><Mic className="w-3 h-3 mr-1 inline" />Sin hablantes</>}
        </Badge>
        {hasSegments && (
          <span className="text-xs text-[#3E4C59] ml-auto">{selectedVersion.segments.length} segmentos</span>
        )}
      </div>

      {/* Speaker legend */}
      {speakerList.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-white rounded-lg border border-[#B7CAC9]/20">
          <span className="text-xs font-semibold text-[#3E4C59] self-center mr-1">Hablantes:</span>
          {speakerList.map(([id, label]) => {
            const col = getSpeakerColor(id);
            return (
              <span key={id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${col.bg} ${col.text} ${col.border}`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.dot }} />
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {hasSegments && (
          <>
            <Button
              variant={isEditMode ? "default" : "outline"}
              size="sm"
              onClick={() => { setIsEditMode(!isEditMode); cancelEdit(); }}
              className={`gap-1.5 text-xs ${isEditMode ? 'bg-[#33A19A] hover:bg-[#2A857F]' : ''}`}
            >
              {isEditMode ? <><X className="w-3.5 h-3.5" />Salir de edición</> : <><Edit2 className="w-3.5 h-3.5" />Editar segmentos</>}
            </Button>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#B7CAC9]" />
              <Input
                placeholder="Buscar en transcripción..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            {searchQuery && (
              <span className="text-xs text-[#3E4C59]">{filteredSegments.length} resultado{filteredSegments.length !== 1 ? 's' : ''}</span>
            )}
          </>
        )}
        <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)} className="gap-1.5 text-xs ml-auto">
          <Download className="w-3.5 h-3.5" />Exportar
        </Button>
      </div>

      {/* Segments */}
      {hasSegments ? (
        <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
          {filteredSegments.length === 0 ? (
            <p className="text-center text-sm text-[#3E4C59] py-6">No hay resultados para "{searchQuery}"</p>
          ) : filteredSegments.map(({ seg, originalIdx }) => {
            const col = getSpeakerColor(seg.speaker_id);
            const isThisEditing = editingSegmentIdx === originalIdx;

            return (
              <div
                key={originalIdx}
                className={`flex gap-3 p-3 rounded-lg border transition-all ${
                  isThisEditing
                    ? 'bg-[#E8F5F4] border-[#33A19A]/40'
                    : isEditMode
                    ? 'hover:bg-[#FFFAF3] border-transparent hover:border-[#B7CAC9]/30 cursor-pointer'
                    : 'border-transparent hover:bg-[#FFFAF3]'
                }`}
                onClick={() => isEditMode && !isThisEditing && openEditSegment(originalIdx, seg)}
              >
                {/* Timestamp */}
                <div className="flex-shrink-0 w-24 pt-0.5">
                  {seg.start_time ? (
                    <div className="flex items-center gap-1 text-[10px] text-[#B7CAC9] font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{seg.start_time}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#B7CAC9]">—</span>
                  )}
                  {seg.end_time && seg.start_time && (
                    <div className="text-[10px] text-[#B7CAC9]/70 font-mono pl-4">{seg.end_time}</div>
                  )}
                </div>

                {/* Speaker + text */}
                <div className="flex-1 min-w-0">
                  {isThisEditing ? (
                    <div className="space-y-2" onClick={e => e.stopPropagation()}>
                      <div>
                        <label className="text-[10px] font-semibold text-[#3E4C59] uppercase tracking-wide mb-1 block">Hablante</label>
                        <Input
                          value={editingSpeaker}
                          onChange={e => setEditingSpeaker(e.target.value)}
                          className="h-7 text-xs"
                          placeholder="Nombre del hablante"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-[#3E4C59] uppercase tracking-wide mb-1 block">Texto</label>
                        <textarea
                          ref={textareaRef}
                          value={editingText}
                          onChange={e => setEditingText(e.target.value)}
                          rows={3}
                          className="w-full text-sm border border-[#33A19A]/50 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#33A19A]/30 font-mono leading-relaxed bg-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveSegment(originalIdx)} disabled={saving} className="h-7 text-xs bg-[#33A19A] hover:bg-[#2A857F] gap-1">
                          <Save className="w-3 h-3" />{saving ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit} className="h-7 text-xs">
                          <X className="w-3 h-3 mr-1" />Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {seg.speaker_label && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold mb-1 px-2 py-0.5 rounded-full border ${col.bg} ${col.text} ${col.border}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: col.dot }} />
                          {seg.speaker_label}
                        </span>
                      )}
                      <p className={`text-sm text-[#1B2731] leading-relaxed ${isEditMode ? 'group-hover:text-[#33A19A]' : ''}`}>
                        {searchQuery ? highlightText(seg.text_literal || "", searchQuery) : (seg.text_literal || "")}
                      </p>
                      {isEditMode && (
                        <span className="text-[10px] text-[#33A19A] mt-1 block">Click para editar</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : selectedVersion?.full_text ? (
        <div className="p-4 bg-white rounded-lg border border-[#B7CAC9]/20 max-h-[400px] overflow-y-auto">
          <p className="text-sm text-[#1B2731] whitespace-pre-wrap leading-relaxed">{selectedVersion.full_text}</p>
        </div>
      ) : (
        <p className="text-center text-sm text-[#3E4C59] py-6">No hay contenido en esta transcripción</p>
      )}

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-heading">Exportar Transcripción</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { fmt: "txt", label: "Texto plano (.TXT)" },
              { fmt: "srt", label: "Subtítulos SRT (.SRT)" },
              { fmt: "vtt", label: "WebVTT (.VTT)" },
            ].map(({ fmt, label }) => (
              <Button key={fmt} onClick={() => exportTranscript(fmt)} variant="outline" className="w-full justify-start gap-2 text-sm">
                <Download className="w-4 h-4 text-[#33A19A]" />{label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function highlightText(text, query) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
      : part
  );
}