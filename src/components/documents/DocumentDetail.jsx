import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Clock, MessageSquare, CheckCircle, XCircle, Send, History, Upload } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_CONFIG = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-600" },
  pending_approval: { label: "Pendiente aprobación", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Aprobado", color: "bg-green-100 text-green-700" },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-700" },
  archived: { label: "Archivado", color: "bg-gray-100 text-gray-500" },
};

export default function DocumentDetail({ doc, open, onClose, onUpdated, user, allVersions }) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(doc?.status || "draft");

  useEffect(() => {
    if (doc) setStatus(doc.status || "draft");
  }, [doc]);

  if (!doc) return null;

  const comments = doc.comments || [];
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

  const handleAddComment = async (type = "comment") => {
    if (!comment.trim()) return;
    setSaving(true);
    const newComment = {
      author_email: user?.email || "",
      author_name: user?.full_name || user?.email || "Usuario",
      text: comment.trim(),
      timestamp: new Date().toISOString(),
      type,
    };
    const newStatus = type === "approval" ? "approved" : type === "rejection" ? "rejected" : doc.status;
    await base44.entities.Document.update(doc.id, {
      comments: [...comments, newComment],
      status: newStatus,
    });
    setComment("");
    setSaving(false);
    toast.success(type === "approval" ? "Documento aprobado" : type === "rejection" ? "Documento rechazado" : "Comentario añadido");
    onUpdated();
  };

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    await base44.entities.Document.update(doc.id, { status: newStatus });
    toast.success("Estado actualizado");
    onUpdated();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg flex items-center gap-3">
            <span className="truncate">{doc.name}</span>
            <Badge className={`${statusCfg.color} border-0 text-xs flex-shrink-0`}>{statusCfg.label}</Badge>
            <Badge className="bg-[#33A19A]/10 text-[#33A19A] border-0 text-xs flex-shrink-0">v{doc.version || 1}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="bg-white border border-[#B7CAC9]/20">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="comments">Comentarios ({comments.length})</TabsTrigger>
            <TabsTrigger value="versions">Versiones ({allVersions?.length || 1})</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-4">
            {doc.description && (
              <p className="text-sm text-[#3E4C59]">{doc.description}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {doc.file_url && (
                <Button variant="outline" size="sm" onClick={() => window.open(doc.file_url, '_blank')} className="gap-2">
                  <ExternalLink className="w-4 h-4" /> Abrir archivo
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cambiar estado</label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-[#B7CAC9]">
              Creado por {doc.created_by} · {doc.created_date ? format(new Date(doc.created_date), "dd MMM yyyy HH:mm", { locale: es }) : ""}
            </div>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="mt-4 space-y-4">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {comments.length === 0 && (
                <p className="text-sm text-[#3E4C59] text-center py-6">Sin comentarios aún</p>
              )}
              {comments.map((c, i) => (
                <div key={i} className={`rounded-lg p-3 text-sm border
                  ${c.type === "approval" ? "border-green-200 bg-green-50" :
                    c.type === "rejection" ? "border-red-200 bg-red-50" :
                    "border-[#B7CAC9]/20 bg-[#FFFAF3]"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {c.type === "approval" && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {c.type === "rejection" && <XCircle className="w-4 h-4 text-red-500" />}
                    {c.type === "comment" && <MessageSquare className="w-4 h-4 text-[#33A19A]" />}
                    <span className="font-medium text-[#1B2731]">{c.author_name || c.author_email}</span>
                    <span className="text-xs text-[#B7CAC9] ml-auto">
                      {c.timestamp ? format(new Date(c.timestamp), "dd MMM yyyy HH:mm", { locale: es }) : ""}
                    </span>
                  </div>
                  <p className="text-[#3E4C59]">{c.text}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-[#B7CAC9]/20 pt-4">
              <Textarea
                placeholder="Escribe un comentario..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleAddComment("comment")} disabled={!comment.trim() || saving} className="gap-2">
                  <Send className="w-3 h-3" /> Comentar
                </Button>
                <Button size="sm" onClick={() => handleAddComment("approval")} disabled={!comment.trim() || saving} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                  <CheckCircle className="w-3 h-3" /> Aprobar
                </Button>
                <Button size="sm" onClick={() => handleAddComment("rejection")} disabled={!comment.trim() || saving} className="bg-red-500 hover:bg-red-600 text-white gap-2">
                  <XCircle className="w-3 h-3" /> Rechazar
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Versions Tab */}
          <TabsContent value="versions" className="mt-4">
            <div className="space-y-2">
              {(allVersions || [doc]).sort((a, b) => (b.version || 1) - (a.version || 1)).map((v, i) => (
                <div key={v.id} className={`flex items-center gap-3 p-3 rounded-lg border
                  ${v.id === doc.id ? "border-[#33A19A] bg-[#33A19A]/5" : "border-[#B7CAC9]/20 bg-white"}`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#33A19A]/10 flex items-center justify-center text-xs font-bold text-[#33A19A]">
                    v{v.version || 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1B2731]">
                      Versión {v.version || 1}
                      {v.id === doc.id && <span className="ml-2 text-xs text-[#33A19A]">(actual)</span>}
                    </p>
                    <p className="text-xs text-[#3E4C59]">
                      {v.created_by} · {v.created_date ? format(new Date(v.created_date), "dd MMM yyyy", { locale: es }) : ""}
                    </p>
                  </div>
                  <Badge className={`${(STATUS_CONFIG[v.status] || STATUS_CONFIG.draft).color} border-0 text-xs`}>
                    {(STATUS_CONFIG[v.status] || STATUS_CONFIG.draft).label}
                  </Badge>
                  {v.file_url && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(v.file_url, '_blank')}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}