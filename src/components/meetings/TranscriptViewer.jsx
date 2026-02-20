import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, User, FileText, Download, Edit2, Save, X, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function TranscriptViewer({ meetingId }) {
  const [transcripts, setTranscripts] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSegmentId, setEditingSegmentId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  useEffect(() => {
    loadTranscripts();
  }, [meetingId]);

  const loadTranscripts = async () => {
    setLoading(true);
    const data = await base44.entities.Transcript.filter({ meeting_id: meetingId }, '-version');
    setTranscripts(data);
    if (data.length > 0) setSelectedVersion(data[0]);
    setLoading(false);
  };

  const handleEditSegment = (segmentIndex, text) => {
    setEditingSegmentId(segmentIndex);
    setEditingText(text);
  };

  const handleSaveSegment = async (segmentIndex) => {
    if (!selectedVersion) return;
    const updatedSegments = [...selectedVersion.segments];
    updatedSegments[segmentIndex].text_literal = editingText;
    
    // Update full_text
    const updatedFullText = updatedSegments.map(s => s.text_literal).join(" ");
    
    await base44.entities.Transcript.update(selectedVersion.id, {
      segments: updatedSegments,
      full_text: updatedFullText
    });
    
    setEditingSegmentId(null);
    setEditingText("");
    setSelectedVersion({ ...selectedVersion, segments: updatedSegments, full_text: updatedFullText });
    toast.success("Segmento actualizado");
  };

  const generateSRT = (segments) => {
    return segments.map((seg, i) => {
      const startTime = seg.start_time || "00:00:00";
      const endTime = seg.end_time || "00:00:01";
      return `${i + 1}\n${formatTimeToSRT(startTime)} --> ${formatTimeToSRT(endTime)}\n${seg.speaker_label || 'Speaker'}: ${seg.text_literal}\n`;
    }).join("\n");
  };

  const generateVTT = (segments) => {
    const header = "WEBVTT\n\n";
    const content = segments.map((seg, i) => {
      const startTime = seg.start_time || "00:00:00";
      const endTime = seg.end_time || "00:00:01";
      return `${formatTimeToVTT(startTime)} --> ${formatTimeToVTT(endTime)}\n${seg.speaker_label || 'Speaker'}: ${seg.text_literal}`;
    }).join("\n\n");
    return header + content;
  };

  const formatTimeToSRT = (time) => {
    // Convert HH:MM:SS or HH:MM:SS.mmm to HH:MM:SS,mmm format
    if (!time) return "00:00:00,000";
    return time.replace(/\./g, ",");
  };

  const formatTimeToVTT = (time) => {
    // Keep HH:MM:SS.mmm format for VTT
    if (!time) return "00:00:00.000";
    return time;
  };

  const exportTranscript = (format) => {
    if (!selectedVersion) return;
    
    let content = "";
    let filename = `transcripcion_v${selectedVersion.version}`;

    if (format === "txt") {
      content = selectedVersion.segments?.map(s => 
        `[${s.start_time}] ${s.speaker_label}: ${s.text_literal}`
      ).join("\n") || selectedVersion.full_text || "";
      filename += ".txt";
    } else if (format === "srt") {
      content = generateSRT(selectedVersion.segments || []);
      filename += ".srt";
    } else if (format === "vtt") {
      content = generateVTT(selectedVersion.segments || []);
      filename += ".vtt";
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Transcripción exportada como ${format.toUpperCase()}`);
    setShowExportDialog(false);
  };

  const filteredSegments = selectedVersion?.segments?.filter(seg =>
    searchQuery === "" || 
    seg.text_literal?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seg.speaker_label?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (loading) {
    return <div className="flex items-center justify-center py-8"><div className="animate-spin w-5 h-5 border-2 border-[#33A19A] border-t-transparent rounded-full" /></div>;
  }

  if (transcripts.length === 0) {
    return (
      <div className="text-center py-8 text-[#3E4C59]">
        <FileText className="w-10 h-10 mx-auto mb-2 text-[#B7CAC9]" />
        <p className="text-sm">Aún no hay transcripción</p>
      </div>
    );
  }

  const SPEAKER_COLORS = ["#33A19A", "#1B2731", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

  return (
    <div className="space-y-4">
      {transcripts.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[#3E4C59]">Versión:</span>
          <Select value={selectedVersion?.id} onValueChange={v => setSelectedVersion(transcripts.find(t => t.id === v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {transcripts.map(t => (
                <SelectItem key={t.id} value={t.id}>v{t.version} - {t.source}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-2 mb-3 flex-wrap">
        <Badge className={`border-0 text-xs ${selectedVersion?.has_timeline ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {selectedVersion?.has_timeline ? "Con timeline" : "Sin timeline"}
        </Badge>
        <Badge className={`border-0 text-xs ${selectedVersion?.has_diarization ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {selectedVersion?.has_diarization ? "Con hablantes" : "Sin diarización"}
        </Badge>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          variant={isEditing ? "destructive" : "outline"}
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
          className="gap-2"
        >
          {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          {isEditing ? "Cancelar edición" : "Editar"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExportDialog(true)}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Exportar
        </Button>
        
        {selectedVersion?.segments && selectedVersion.segments.length > 0 && (
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4 text-[#B7CAC9]" />
            <Input
              placeholder="Buscar en transcripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs flex-1"
            />
            {searchQuery && (
              <span className="text-xs text-[#3E4C59]">{filteredSegments.length} resultados</span>
            )}
          </div>
        )}
      </div>

      {/* Transcript Content */}
      {selectedVersion?.segments && selectedVersion.segments.length > 0 ? (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {filteredSegments.map((seg, i) => {
            const colorIdx = parseInt(seg.speaker_id?.replace(/\D/g, '') || '0') % SPEAKER_COLORS.length;
            const isEditing_ = editingSegmentId === i;
            
            return (
              <div key={i} className="flex gap-3 p-3 rounded-lg hover:bg-[#FFFAF3] transition-colors border border-transparent hover:border-[#B7CAC9]/20">
                {seg.start_time && (
                  <div className="flex items-center gap-1 text-xs text-[#B7CAC9] flex-shrink-0 w-28">
                    <Clock className="w-3 h-3" />
                    {seg.start_time}–{seg.end_time}
                  </div>
                )}
                <div className="flex-1">
                  {seg.speaker_label && (
                    <div className="flex items-center gap-1 mb-1">
                      <User className="w-3 h-3" style={{ color: SPEAKER_COLORS[colorIdx] }} />
                      <span className="text-xs font-semibold" style={{ color: SPEAKER_COLORS[colorIdx] }}>
                        {seg.speaker_label}
                      </span>
                    </div>
                  )}
                  {isEditing_ ? (
                    <div className="flex gap-2 items-start">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="text-sm border border-[#33A19A] rounded px-2 py-1 flex-1 font-mono"
                        rows="2"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveSegment(i)}
                        className="gap-1 h-auto py-1"
                      >
                        <Save className="w-3 h-3" /> Guardar
                      </Button>
                    </div>
                  ) : (
                    <p 
                      className="text-sm text-[#1B2731] leading-relaxed cursor-pointer hover:bg-[#E8F5F4] px-2 py-1 rounded"
                      onClick={() => isEditing && handleEditSegment(i, seg.text_literal)}
                    >
                      {seg.text_literal}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : selectedVersion?.full_text ? (
        <div className="p-4 bg-white rounded-lg border border-[#B7CAC9]/20">
          <p className="text-sm text-[#1B2731] whitespace-pre-wrap leading-relaxed">{selectedVersion.full_text}</p>
        </div>
      ) : (
        <p className="text-sm text-[#3E4C59] text-center py-4">No hay contenido de transcripción</p>
      )}

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Exportar Transcripción</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button onClick={() => exportTranscript("txt")} variant="outline" className="w-full justify-start">
              <Download className="w-4 h-4 mr-2" /> Exportar como TXT
            </Button>
            <Button onClick={() => exportTranscript("srt")} variant="outline" className="w-full justify-start">
              <Download className="w-4 h-4 mr-2" /> Exportar como SRT (subtítulos)
            </Button>
            <Button onClick={() => exportTranscript("vtt")} variant="outline" className="w-full justify-start">
              <Download className="w-4 h-4 mr-2" /> Exportar como VTT (WebVTT)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}