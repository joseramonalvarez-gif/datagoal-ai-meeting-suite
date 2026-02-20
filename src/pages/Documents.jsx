import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Upload, Search, FolderOpen, Download, MoreVertical, Trash2, ExternalLink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const FOLDERS = [
  { key: "informes", label: "Informes", icon: "📊" },
  { key: "entregables", label: "Entregables", icon: "📦" },
  { key: "reuniones", label: "Reuniones", icon: "🗣️" },
  { key: "plantillas", label: "Plantillas", icon: "📋" },
  { key: "reportes", label: "Reportes", icon: "📈" },
  { key: "otros", label: "Otros", icon: "📁" },
];

export default function Documents({ selectedClient }) {
  const [docs, setDocs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState("all");
  const [form, setForm] = useState({ name: "", description: "", folder: "otros", project_id: "" });
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadData(); }, [selectedClient]);

  const loadData = async () => {
    setLoading(true);
    const filters = selectedClient ? { client_id: selectedClient.id } : {};
    const [d, p] = await Promise.all([
      selectedClient ? base44.entities.Document.filter(filters, '-created_date', 100) : base44.entities.Document.list('-created_date', 100),
      selectedClient ? base44.entities.Project.filter({ client_id: selectedClient.id }) : base44.entities.Project.list()
    ]);
    setDocs(d);
    setProjects(p);
    setLoading(false);
  };

  const handleUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Document.create({
        ...form,
        client_id: selectedClient?.id || "",
        file_url,
        file_type: file.name.split('.').pop(),
        name: form.name || file.name,
      });
      setUploading(false);
      setShowUpload(false);
      setForm({ name: "", description: "", folder: "otros", project_id: "" });
      loadData();
    };
    input.click();
  };

  const handleDelete = async (id) => {
    await base44.entities.Document.delete(id);
    loadData();
  };

  const filtered = docs.filter(d => {
    const matchSearch = d.name?.toLowerCase().includes(search.toLowerCase());
    const matchFolder = activeFolder === "all" || d.folder === activeFolder;
    return matchSearch && matchFolder;
  });

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || "";

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B7CAC9]" />
          <Input placeholder="Buscar documento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-white border-[#B7CAC9]/30" />
        </div>
      </div>

      <Tabs value={activeFolder} onValueChange={setActiveFolder}>
        <TabsList className="bg-white border border-[#B7CAC9]/20 flex-wrap h-auto">
          <TabsTrigger value="all">Todos</TabsTrigger>
          {FOLDERS.map(f => (
            <TabsTrigger key={f.key} value={f.key}>{f.icon} {f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <div key={doc.id} className="bg-white rounded-xl border border-[#B7CAC9]/20 p-4 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#33A19A]/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#33A19A]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#1B2731] truncate">{doc.name}</h3>
                    <p className="text-xs text-[#3E4C59]">{getProjectName(doc.project_id)} • v{doc.version || 1}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {doc.file_url && (
                      <DropdownMenuItem onClick={() => window.open(doc.file_url, '_blank')}>
                        <ExternalLink className="w-4 h-4 mr-2" /> Abrir
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleDelete(doc.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {doc.description && <p className="text-xs text-[#3E4C59] mt-2 line-clamp-2">{doc.description}</p>}
              <div className="flex items-center gap-2 mt-3">
                <Badge className="bg-[#FFFAF3] text-[#3E4C59] border-[#B7CAC9]/20 text-xs">
                  {FOLDERS.find(f => f.key === doc.folder)?.label || "Otros"}
                </Badge>
                {doc.file_type && <Badge className="bg-[#33A19A]/10 text-[#33A19A] border-0 text-xs">{doc.file_type.toUpperCase()}</Badge>}
              </div>
              <p className="text-[10px] text-[#B7CAC9] mt-2">
                {doc.created_date ? format(new Date(doc.created_date), "dd MMM yyyy", { locale: es }) : ""}
              </p>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#3E4C59]">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
              <p>No se encontraron documentos</p>
            </div>
          )}
        </div>
      )}

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
              <Select value={form.folder} onValueChange={v => setForm({ ...form, folder: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FOLDERS.map(f => <SelectItem key={f.key} value={f.key}>{f.icon} {f.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
              {uploading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Upload className="w-4 h-4" />}
              Subir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}