import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";

export default function ReportViewer({ meetingId }) {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [meetingId]);

  const loadReports = async () => {
    setLoading(true);
    const data = await base44.entities.Report.filter({ meeting_id: meetingId }, '-version');
    setReports(data);
    if (data.length > 0) setSelectedReport(data[0]);
    setLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><div className="animate-spin w-5 h-5 border-2 border-[#33A19A] border-t-transparent rounded-full" /></div>;
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-8 text-[#3E4C59]">
        <FileText className="w-10 h-10 mx-auto mb-2 text-[#B7CAC9]" />
        <p className="text-sm">Aún no hay informe generado</p>
      </div>
    );
  }

  const STATUS_COLORS = {
    draft: "bg-gray-100 text-gray-700",
    generated: "bg-blue-50 text-blue-700",
    pending_approval: "bg-amber-50 text-amber-700",
    approved: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {reports.length > 1 && (
          <Select value={selectedReport?.id} onValueChange={v => setSelectedReport(reports.find(r => r.id === v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {reports.map(r => (
                <SelectItem key={r.id} value={r.id}>v{r.version}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Badge className={`${STATUS_COLORS[selectedReport?.status] || ''} border-0 text-xs`}>
          {selectedReport?.status === 'generated' ? 'Generado' : selectedReport?.status === 'approved' ? 'Aprobado' : selectedReport?.status === 'rejected' ? 'Rechazado' : selectedReport?.status || ''}
        </Badge>
      </div>

      <div className="bg-white rounded-lg border border-[#B7CAC9]/20 p-6 max-h-[600px] overflow-y-auto">
        <ReactMarkdown 
          className="prose prose-sm max-w-none prose-headings:font-heading prose-headings:text-[#1B2731] prose-p:text-[#3E4C59] prose-strong:text-[#1B2731]"
        >
          {selectedReport?.content_markdown || ""}
        </ReactMarkdown>
      </div>
    </div>
  );
}