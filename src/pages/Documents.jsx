import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Search, FolderOpen, Filter } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import FolderTree from "../components/documents/FolderTree";
import DocumentCard from "../components/documents/DocumentCard";
import DocumentDetail from "../components/documents/DocumentDetail";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "draft", label: "Borrador" },
  { value: "pending_approval", label: "Pendiente aprobación" },
  { value: "approved", label: "Aprobado" },
  { value: "rejected", label: "Rechazado" },
];

export default function Documents({ selectedClient, user }) {
  const [docs, setDocs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", folder: "otros", project_id: "" });

  useEffect(() => { loadData(); }, [selectedClient]);

  const loadData = async () => {
    setLoading(true);
    const filters = selectedClient ? { client_id: selectedClient.id } : {};
    const [d, p] = await Promise.all([
      selectedClient
        ? base44.entities.Document.filter(filters, "-created_date", 200)
        : base44.entities.Document.list("-created_date", 200),
      selectedClient
        ? base44.entities.Project.filter({ client_id: selectedClient.id })
        : base44.entities.Project.list(),
    ]);
    // Only show latest versions (or docs without a parent) as top-level items
    const topLevel = d.filter(doc => !doc.parent_document_id || doc.is_latest);
    setDocs(topLevel);
    setProjects(p);
    setLoading(false);
  };

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.ppt,.pptx,.zip";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Document.create({
        ...form,
        client_id: selectedClient?.id || "",
        folder: activeFolder !== "all" ? activeFolder : form.folder,
        file_url,
        file_type: file.name.split(".").pop().toLowerCase(),
        name: form.name || file.name,
        version: 1,
        is_latest: true,
        status: "draft",
        comments: [],
      });
      setUploading(false);
      setShowUpload(false);
      setForm({ name: "", description: "", folder: "otros", project_id: "" });
      toast.success("Documento subido correctamente");
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
    setSelectedDoc(doc);
    // DocumentDetail will handle the version upload logic internally
  };

  // Filter docs
  const filtered = docs.filter(d => {
    const matchSearch = d.name?.toLowerCase().includes(search.toLowerCase());
    const matchFolder = activeFolder === "all" || d.folder === activeFolder || d.folder?.startsWith(activeFolder + "/");
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchFolder && matchStatus;
  });

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Documentos</h1>
          <p className="text-sm text-[#3E4C59] mt-1">Repositorio de documentos con versiones y aprobaciones</p>
        </div>
        <Button onClick={() => setShowUpload(true)} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
          <Upload className="w-4 h-4" /> Subir Documento
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Folder Tree */}
        <div className="hidden lg:block w-56 flex-shrink-0">
          <FolderTree docs={docs} activeFolder={activeFolder} onSelectFolder={setActiveFolder} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B7CAC9]" />
              <Input
                placeholder="Buscar documento..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 bg-white border-[#B7CAC9]/30"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-white border-[#B7CAC9]/30">
                <Filter className="w-4 h-4 mr-2 text-[#B7CAC9]" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Mobile folder selector */}
            <div className="lg:hidden">
              <Select value={activeFolder} onValueChange={setActiveFolder}>
                <SelectTrigger className="w-40 bg-white border-[#B7CAC9]/30">
                  <SelectValue placeholder="Carpeta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {["informes","entregables","reuniones","plantillas","reportes","otros"].map(f => (
                    <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active folder breadcrumb */}
          {activeFolder !== "all" && (
            <div className="flex items-center gap-2 text-sm text-[#3E4C59]">
              <span
                className="cursor-pointer hover:text-[#33A19A]"
                onClick={() => setActiveFolder("all")}
              >Todos</span>
              {activeFolder.split("/").map((part, i, arr) => (
                <React.Fragment key={i}>
                  <span className="text-[#B7CAC9]">/</span>
                  <span
                    className="cursor-pointer hover:text-[#33A19A] capitalize"
                    onClick={() => setActiveFolder(arr.slice(0, i + 1).join("/"))}
                  >{part}</span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Documents grid */}
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
                <div className="col-span-full text-center py-16 text-[#3E4C59]">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
                  <p className="font-medium">No se encontraron documentos</p>
                  <p className="text-sm text-[#B7CAC9] mt-1">Sube el primer documento en esta carpeta</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Subir Documento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Se usará el nombre del archivo si vacío"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Carpeta</label>
              <Input
                value={activeFolder !== "all" ? activeFolder : form.folder}
                onChange={e => setForm({ ...form, folder: e.target.value })}
                placeholder="ej: informes/mensuales"
                className="mt-1"
              />
              <p className="text-xs text-[#B7CAC9] mt-1">Usa / para subcarpetas, ej: informes/2024</p>
            </div>
            <div>
              <label className="text-sm font-medium">Proyecto</label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar proyecto" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancelar</Button>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2"
            >
              {uploading
                ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                : <Upload className="w-4 h-4" />}
              Seleccionar archivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Detail Modal */}
      <DocumentDetail
        doc={selectedDoc}
        user={user}
        onClose={() => setSelectedDoc(null)}
        onUpdated={loadData}
      />
    </div>
  );
}