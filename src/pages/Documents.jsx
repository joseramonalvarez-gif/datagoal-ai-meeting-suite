import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Search, FolderOpen } from "lucide-react";
import { toast } from "sonner";

import FolderTree from "../components/documents/FolderTree";
import DocumentCard from "../components/documents/DocumentCard";
import DocumentDetail from "../components/documents/DocumentDetail";

export default function Documents({ selectedClient, user }) {
  const [docs, setDocs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState("all");
  const [form, setForm] = useState({ name: "", description: "", folder: "", project_id: "", status: "draft" });
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [newVersionFor, setNewVersionFor] = useState(null);

  useEffect(() => { loadData(); }, [selectedClient]);

  const loadData = async () => {
    setLoading(true);
    const filters = selectedClient ? { client_id: selectedClient.id } : {};
    const [d, p] = await Promise.all([
      selectedClient
        ? base44.entities.Document.filter(filters, '-created_date', 200)
        : base44.entities.Document.list('-created_date', 200),
      selectedClient
        ? base44.entities.Project.filter({ client_id: selectedClient.id })
        : base44.entities.Project.list()
    ]);
    setDocs(d);
    setProjects(p);
    setLoading(false);
  };

  const handleUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.pptx,.zip";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      if (newVersionFor) {
        // Upload new version — mark old as not latest
        await base44.entities.Document.update(newVersionFor.id, { is_latest: false });
        const rootId = newVersionFor.parent_document_id || newVersionFor.id;
        const siblings = docs.filter(d =>
          d.id === rootId || d.parent_document_id === rootId
        );
        const nextVersion = Math.max(...siblings.map(d => d.version || 1)) + 1;
        await base44.entities.Document.create({
          ...newVersionFor,
          id: undefined,
          created_date: undefined,
          updated_date: undefined,
          file_url,
          file_type: file.name.split('.').pop(),
          version: nextVersion,
          is_latest: true,
          parent_document_id: rootId,
          comments: [],
          status: "draft",
        });
        toast.success(`Versión ${nextVersion} subida`);
        setNewVersionFor(null);
      } else {
        const folder = form.folder || activeFolder !== "all" ? (form.folder || activeFolder) : "otros";
        await base44.entities.Document.create({
          ...form,
          client_id: selectedClient?.id || "",
          file_url,
          file_type: file.name.split('.').pop(),
          name: form.name || file.name,
          folder,
          version: 1,
          is_latest: true,
          parent_document_id: null,
        });
        toast.success("Documento subido");
        setShowUpload(false);
        setForm({ name: "", description: "", folder: "", project_id: "", status: "draft" });
      }
      setUploading(false);
      loadData();
    };
    input.click();
  };

  const handleDelete = async (id) => {
    await base44.entities.Document.delete(id);
    toast.success("Documento eliminado");
    loadData();
  };

  const handleNewVersion = (doc) => {
    setNewVersionFor(doc);
    // Trigger upload immediately
    setTimeout(handleUpload, 0);
  };

  // Group docs: only show latest versions in list, keep all for version history
  const latestDocs = docs.filter(d => d.is_latest !== false);

  const filtered = latestDocs.filter(d => {
    const matchSearch = !search || d.name?.toLowerCase().includes(search.toLowerCase());
    const matchFolder = activeFolder === "all" || d.folder === activeFolder || d.folder?.startsWith(activeFolder + "/");
    return matchSearch && matchFolder;
  });

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || "";

  const getVersions = (doc) => {
    if (!doc) return [];
    const rootId = doc.parent_document_id || doc.id;
    return docs.filter(d => d.id === rootId || d.parent_document_id === rootId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Documentos</h1>
          <p className="text-sm text-[#3E4C59] mt-1">Repositorio de documentos y entregables</p>
        </div>
        <Button onClick={() => setShowUpload(true)} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
          <Upload className="w-4 h-4" /> Subir Documento
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar folder tree */}
        <div className="hidden md:block w-52 flex-shrink-0">
          <FolderTree docs={docs} activeFolder={activeFolder} onSelectFolder={setActiveFolder} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B7CAC9]" />
            <Input
              placeholder="Buscar documento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-white border-[#B7CAC9]/30"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(doc => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  projectName={getProjectName(doc.project_id)}
                  onOpen={setSelectedDoc}
                  onDelete={handleDelete}
                  onNewVersion={handleNewVersion}
                />
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-12 text-[#3E4C59]">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
                  <p>No se encontraron documentos</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Subir Documento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Se usará el nombre del archivo si vacío" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Carpeta</label>
              <Input
                value={form.folder}
                onChange={e => setForm({ ...form, folder: e.target.value })}
                placeholder={activeFolder !== "all" ? activeFolder : "ej: informes/mensuales"}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Proyecto</label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
              {uploading
                ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                : <Upload className="w-4 h-4" />}
              Seleccionar archivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document detail dialog */}
      <DocumentDetail
        doc={selectedDoc}
        open={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        onUpdated={() => { loadData(); setSelectedDoc(null); }}
        user={user}
        allVersions={getVersions(selectedDoc)}
      />
    </div>
  );
}