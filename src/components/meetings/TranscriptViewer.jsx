import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, User, FileText } from "lucide-react";

export default function TranscriptViewer({ meetingId }) {
  const [transcripts, setTranscripts] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);

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

      <div className="flex gap-2 mb-3">
        <Badge className={`border-0 text-xs ${selectedVersion?.has_timeline ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {selectedVersion?.has_timeline ? "Con timeline" : "Sin timeline"}
        </Badge>
        <Badge className={`border-0 text-xs ${selectedVersion?.has_diarization ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {selectedVersion?.has_diarization ? "Con hablantes" : "Sin diarización"}
        </Badge>
      </div>

      {selectedVersion?.segments && selectedVersion.segments.length > 0 ? (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {selectedVersion.segments.map((seg, i) => {
            const colorIdx = parseInt(seg.speaker_id?.replace(/\D/g, '') || '0') % SPEAKER_COLORS.length;
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
                  <p className="text-sm text-[#1B2731] leading-relaxed">{seg.text_literal}</p>
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
    </div>
  );
}