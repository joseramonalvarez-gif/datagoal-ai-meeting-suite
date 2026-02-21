import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paperclip, MessageSquare, Upload, Trash2, ExternalLink, FileText, FileImage, File, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { notifyTaskMention } from "./taskNotifications";

function FileIcon({ type }) {
  if (!type) return <File className="w-4 h-4 text-[#3E4C59]" />;
  if (type.includes("image")) return <FileImage className="w-4 h-4 text-blue-500" />;
  return <FileText className="w-4 h-4 text-[#33A19A]" />;
}

export default function TaskAttachmentsComments({ task }) {
  const [docs, setDocs] = useState([]);
  const [comments, setComments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [comment, setComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => { loadDocs(); loadComments(); }, [task.id]);

  const loadDocs = async () => {
    setLoadingDocs(true);
    const all = await base44.entities.Document.filter({
      client_id: task.client_id,
      project_id: task.project_id,
    }, '-created_date', 100);
    setDocs(all.filter(d => d.linked_task_id === task.id));
    setLoadingDocs(false);
  };

  const loadComments = async () => {
    setLoadingComments(true);
    const logs = await base44.entities.AuditLog.filter({
      entity_type: "Task",
      entity_id: task.id,
      action: "task_comment",
    }, "created_date", 50);
    setComments(logs);
    setLoadingComments(false);
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Document.create({
        client_id: task.client_id,
        project_id: task.project_id,
        linked_task_id: task.id,
        name: file.name,
        file_url,
        file_type: file.type,
        status: "draft",
        folder: "tareas",
      });
    }
    toast.success(`${files.length} archivo(s) adjuntado(s)`);
    setUploading(false);
    loadDocs();
    e.target.value = "";
  };

  const handleDeleteDoc = async (docId) => {
    await base44.entities.Document.delete(docId);
    loadDocs();
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setSendingComment(true);
    const me = await base44.auth.me();
    const mentionRegex = /@([\w.+-]+@[\w-]+\.[\w.]+)/g;
    const mentions = [...comment.matchAll(mentionRegex)].map(m => m[1]);
    for (const email of mentions) {
      await notifyTaskMention({ task, mentionedEmail: email, commentText: comment, mentionedBy: me.email });
    }
    await base44.entities.AuditLog.create({
      user_email: me.email,
      client_id: task.client_id || "",
      project_id: task.project_id || "",
      action: "task_comment",
      entity_type: "Task",
      entity_id: task.id,
      details: comment,
      timestamp: new Date().toISOString(),
    });
    setComment("");
    setSendingComment(false);
    loadComments();
  };

  return (
    <Tabs defaultValue="comments">
      <TabsList className="bg-[#F8FAFB] border border-[#B7CAC9]/20 h-8">
        <TabsTrigger value="comments" className="text-xs h-7 data-[state=active]:bg-white gap-1">
          <MessageSquare className="w-3 h-3" /> Comentarios
          {comments.length > 0 && <Badge className="bg-[#E8F5F4] text-[#33A19A] border-0 text-[10px] py-0 px-1">{comments.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="files" className="text-xs h-7 data-[state=active]:bg-white gap-1">
          <Paperclip className="w-3 h-3" /> Archivos
          {docs.length > 0 && <Badge className="bg-[#E8F5F4] text-[#33A19A] border-0 text-[10px] py-0 px-1">{docs.length}</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="comments" className="mt-3 space-y-3">
        {/* Comment input */}
        <div>
          <p className="text-[11px] text-[#3E4C59] mb-1.5">Usa @email para mencionar (ej. @usuario@empresa.com)</p>
          <div className="flex gap-2">
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Escribe un comentario…"
              rows={2}
              className="flex-1 text-sm"
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleAddComment(); }}
            />
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!comment.trim() || sendingComment}
              className="self-end bg-[#33A19A] hover:bg-[#2A857F] text-white"
            >
              {sendingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* Comments list */}
        {loadingComments ? (
          <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-[#33A19A]" /></div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-[#B7CAC9] text-center py-3">Sin comentarios aún.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {comments.map(c => (
              <div key={c.id} className="p-2.5 bg-[#F8FAFB] rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-[#33A19A] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                    {c.user_email?.[0]?.toUpperCase() || "?"}
                  </div>
                  <span className="text-xs font-medium text-[#1B2731]">{c.user_email}</span>
                  <span className="text-[10px] text-[#B7CAC9] ml-auto">
                    {c.created_date ? format(new Date(c.created_date), "dd MMM, HH:mm", { locale: es }) : ""}
                  </span>
                </div>
                <p className="text-sm text-[#3E4C59] ml-7">{c.details}</p>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="files" className="mt-3 space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-xs text-[#3E4C59]">{docs.length} archivo(s) adjunto(s)</p>
          <label className="cursor-pointer">
            <input type="file" multiple className="hidden" onChange={handleUpload} />
            <Button variant="outline" size="sm" className="text-xs gap-1.5 pointer-events-none" asChild>
              <span>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Adjuntar
              </span>
            </Button>
          </label>
        </div>

        {loadingDocs ? (
          <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-[#33A19A]" /></div>
        ) : docs.length === 0 ? (
          <p className="text-xs text-[#B7CAC9] text-center py-3">Sin archivos adjuntos.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-2 p-2 bg-[#F8FAFB] rounded-lg group hover:bg-[#E8F5F4] transition-colors">
                <FileIcon type={doc.file_type} />
                <span className="text-sm text-[#1B2731] flex-1 truncate">{doc.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-6 w-6"><ExternalLink className="w-3 h-3" /></Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => handleDeleteDoc(doc.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}