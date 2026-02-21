import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Upload, Trash2, ExternalLink, FileText, FileImage, File, Loader2 } from "lucide-react";
import { toast } from "sonner";

function FileIcon({ type }) {
  if (!type) return <File className="w-4 h-4" />;
  if (type.includes("image")) return <FileImage className="w-4 h-4 text-blue-500" />;
  if (type.includes("pdf")) return <FileText className="w-4 h-4 text-red-500" />;
  return <FileText className="w-4 h-4 text-[#33A19A]" />;
}

export default function MeetingAttachments({ meeting, onUpdate }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDocs(); }, [meeting.id]);

  const loadDocs = async () => {
    setLoading(true);
    const all = await base44.entities.Document.filter({ linked_meeting_id: meeting.id }, '-created_date');
    setDocs(all);
    setLoading(false);
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Document.create({
        client_id: meeting.client_id,
        project_id: meeting.project_id,
        linked_meeting_id: meeting.id,
        name: file.name,
        file_url,
        file_type: file.type,
        status: "draft",
        folder: "reuniones",
      });
    }
    toast.success(`${files.length} archivo(s) adjuntado(s)`);
    setUploading(false);
    loadDocs();
    e.target.value = "";
  };

  const handleDelete = async (docId) => {
    await base44.entities.Document.delete(docId);
    loadDocs();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" /> Documentos adjuntos
          {docs.length > 0 && <Badge className="bg-[#E8F5F4] text-[#33A19A] border-0 text-[10px]">{docs.length}</Badge>}
        </h4>
        <label className="cursor-pointer">
          <input type="file" multiple className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg" />
          <Button variant="outline" size="sm" className="gap-1.5 text-xs pointer-events-none" asChild>
            <span>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Adjuntar archivo
            </span>
          </Button>
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[#33A19A]" /></div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-[#B7CAC9] text-center py-4">Sin documentos adjuntos. Sube archivos relevantes a esta reunión.</p>
      ) : (
        <div className="space-y-1.5">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 p-2.5 bg-[#F8FAFB] rounded-lg group hover:bg-[#E8F5F4] transition-colors">
              <FileIcon type={doc.file_type} />
              <span className="text-sm text-[#1B2731] flex-1 truncate">{doc.name}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-6 w-6"><ExternalLink className="w-3 h-3" /></Button>
                </a>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => handleDelete(doc.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}