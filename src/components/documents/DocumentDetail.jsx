import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Clock, MessageSquare, CheckCircle, XCircle, Upload, History, User } from "lucide-react";
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

export default function DocumentDetail({ doc, user, onClose, onUpdated }) {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (doc) loadVersions();
  }, [doc]);

  const loadVersions = async () => {
    // The "parent" is either doc itself (if it's the original) or doc.parent_document_id
    const rootId = doc.parent_document_id || doc.id;
    const allVersions = await base44.entities.Document.filter(
      { $or: [{ id: rootId }, { parent_document_id: rootId }] },
      "-version", 20
    ).catch(() => [doc]);
    const sorted = allVersions.length > 0 ? allVersions : [doc];
    setVersions(sorted);
    setSelectedVersion(sorted[0]);
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    const newComment = {
      author_email: user?.email,
      author_name: user?.full_name || user?.email,
      text: comment,
      timestamp: new Date().toISOString(),
      type: "comment",
    };
    const updated = [...(selectedVersion.comments || []), newComment];
    await base44.entities.Document.update(selectedVersion.id, { comments: updated });
    setComment("");
    setSubmitting(false);
    toast.success("Comentario añadido");
    onUpdated();
    loadVersions();
  };

  const handleApproval = async (decision) => {
    setSubmitting(true);
    const newComment = {
      author_email: user?.email,
      author_name: user?.full_name || user?.email,
      text: comment || (decision === "approval" ? "Aprobado" : "Rechazado"),
      timestamp: new Date().toISOString(),
      type: decision,
    };
    const updated = [...(selectedVersion.comments || []), newComment];
    const newStatus = decision === "approval" ? "approved" : "rejected";
    await base44.entities.Document.update(selectedVersion.id, { comments: updated, status: newStatus });
    setComment("");
    setSubmitting(false);
    toast.success(decision === "approval" ? "Documento aprobado" : "Documento rechazado");
    onUpdated();
    loadVersions();
  };

  const handleRequestApproval = async () => {
    await base44.entities.Document.update(selectedVersion.id, { status: "pending_approval" });
    toast.success("Aprobación solicitada");
    onUpdated();
    loadVersions();
  };

  const handleNewVersion = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.ppt,.pptx";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const rootId = doc.parent_document_id || doc.id;
      const maxVersion = Math.max(...versions.map(v => v.version || 1));
      // Mark old versions as not latest
      await Promise.all(versions.map(v => base44.entities.Document.update(v.id, { is_latest: false })));
      await base44.entities.Document.create({
        ...selectedVersion,
        id: undefined,
        created_date: undefined,
        updated_date: undefined,
        parent_document_id: rootId,
        version: maxVersion + 1,
        is_latest: true,
        status: "draft",
        file_url,
        file_type: file.name.split('.').pop(),
        comments: [],
      });
      setUploading(false);
      toast.success(`Versión ${maxVersion + 1} subida correctamente`);
      onUpdated();
      loadVersions();
    };
    input.click();
  };

  if (!doc) return null;
  const sv = selectedVersion || doc;
  const statusCfg = STATUS_CONFIG[sv.status] || STATUS_CONFIG.draft;

  return (
    <Dialog open={!!doc} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-3">
            <span className="truncate">{doc.name}</span>
            <Badge className={`${statusCfg.color} border-0 text-xs flex-shrink-0`}>{statusCfg.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detail" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="detail">Detalle</TabsTrigger>
            <TabsTrigger value="versions">
              <History className="w-3 h-3 mr-1" /> Versiones ({versions.length})
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="w-3 h-3 mr-1" /> Comentarios ({sv.comments?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* DETAIL TAB */}
          <TabsContent value="detail" className="flex-1 overflow-y-auto space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-[#B7CAC9] text-xs">Versión actual</span><p className="font-semibold">v{sv.version || 1}</p></div>
              <div><span className="text-[#B7CAC9] text-xs">Tipo</span><p className="font-semibold uppercase">{sv.file_type || "—"}</p></div>
              <div><span className="text-[#B7CAC9] text-xs">Estado</span><p>{statusCfg.label}</p></div>
              <div><span className="text-[#B7CAC9] text-xs">Subido por</span><p className="truncate">{sv.created_by || "—"}</p></div>
              {sv.description && <div className="col-span-2"><span className="text-[#B7CAC9] text-xs">Descripción</span><p>{sv.description}</p></div>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {sv.file_url && (
                <Button variant="outline" size="sm" onClick={() => window.open(sv.file_url, '_blank')} className="gap-2">
                  <ExternalLink className="w-4 h-4" /> Abrir archivo
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleNewVersion} disabled={uploading} className="gap-2">
                {uploading ? <div className="animate-spin w-4 h-4 border-2 border-[#33A19A] border-t-transparent rounded-full" /> : <Upload className="w-4 h-4" />}
                Nueva versión
              </Button>
              {sv.status === "draft" && (
                <Button size="sm" variant="outline" onClick={handleRequestApproval} className="gap-2 text-yellow-700 border-yellow-300">
                  <Clock className="w-4 h-4" /> Solicitar aprobación
                </Button>
              )}
              {sv.status === "pending_approval" && (
                <>
                  <Button size="sm" onClick={() => handleApproval("approval")} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                    <CheckCircle className="w-4 h-4" /> Aprobar
                  </Button>
                  <Button size="sm" onClick={() => handleApproval("rejection")} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                    <XCircle className="w-4 h-4" /> Rechazar
                  </Button>
                </>
              )}
            </div>
          </TabsContent>

          {/* VERSIONS TAB */}
          <TabsContent value="versions" className="flex-1 overflow-y-auto mt-4">
            <div className="space-y-2">
              {versions.map(v => {
                const vStatus = STATUS_CONFIG[v.status] || STATUS_CONFIG.draft;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVersion(v)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors
                      ${selectedVersion?.id === v.id ? "border-[#33A19A] bg-[#33A19A]/5" : "border-[#B7CAC9]/20 hover:border-[#33A19A]/40"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#33A19A]/10 flex items-center justify-center text-xs font-bold text-[#33A19A]">
                        v{v.version || 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{v.is_latest ? "Versión actual" : `Versión ${v.version}`}</p>
                        <p className="text-xs text-[#B7CAC9]">
                          {v.created_by} · {v.created_date ? format(new Date(v.created_date), "dd MMM yyyy HH:mm", { locale: es }) : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${vStatus.color} border-0 text-xs`}>{vStatus.label}</Badge>
                      {v.file_url && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); window.open(v.file_url, '_blank'); }}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* COMMENTS TAB */}
          <TabsContent value="comments" className="flex-1 flex flex-col overflow-hidden mt-4">
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {(sv.comments || []).length === 0 && (
                <p className="text-sm text-[#B7CAC9] text-center py-6">Sin comentarios aún</p>
              )}
              {(sv.comments || []).map((c, i) => (
                <div key={i} className={`flex gap-3 p-3 rounded-lg border
                  ${c.type === "approval" ? "border-green-200 bg-green-50" : c.type === "rejection" ? "border-red-200 bg-red-50" : "border-[#B7CAC9]/20 bg-white"}`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#33A19A] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {c.author_name?.[0] || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{c.author_name}</span>
                      {c.type === "approval" && <Badge className="bg-green-100 text-green-700 border-0 text-xs">Aprobó</Badge>}
                      {c.type === "rejection" && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Rechazó</Badge>}
                      <span className="text-xs text-[#B7CAC9] ml-auto">
                        {c.timestamp ? format(new Date(c.timestamp), "dd MMM HH:mm", { locale: es }) : ""}
                      </span>
                    </div>
                    <p className="text-sm text-[#3E4C59]">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-shrink-0 space-y-2 border-t pt-3">
              <Textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Escribe un comentario..."
                rows={2}
                className="resize-none"
              />
              <div className="flex gap-2 justify-end">
                {sv.status === "pending_approval" && (
                  <>
                    <Button size="sm" onClick={() => handleApproval("approval")} disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white gap-1">
                      <CheckCircle className="w-3 h-3" /> Aprobar
                    </Button>
                    <Button size="sm" onClick={() => handleApproval("rejection")} disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white gap-1">
                      <XCircle className="w-3 h-3" /> Rechazar
                    </Button>
                  </>
                )}
                <Button size="sm" onClick={handleComment} disabled={submitting || !comment.trim()} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">
                  Comentar
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}