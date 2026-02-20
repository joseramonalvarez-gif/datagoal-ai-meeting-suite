import React, { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const ROOT_FOLDERS = [
  "informes", "entregables", "reuniones", "plantillas", "reportes", "otros"
];

function buildTree(docs) {
  const folders = new Set(ROOT_FOLDERS);
  docs.forEach(d => {
    if (d.folder) {
      const parts = d.folder.split("/");
      let path = "";
      parts.forEach(p => {
        path = path ? `${path}/${p}` : p;
        folders.add(path);
      });
    }
  });
  return Array.from(folders).sort();
}

function FolderNode({ path, label, activeFolder, onSelect, children, depth = 0 }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = children && children.length > 0;
  const isActive = activeFolder === path;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors
          ${isActive ? "bg-[#33A19A] text-white" : "text-[#3E4C59] hover:bg-[#33A19A]/10"}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => { onSelect(path); if (hasChildren) setOpen(!open); }}
      >
        {hasChildren ? (
          open ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />
        ) : <span className="w-3" />}
        {isActive ? <FolderOpen className="w-4 h-4 flex-shrink-0" /> : <Folder className="w-4 h-4 flex-shrink-0" />}
        <span className="truncate">{label}</span>
      </div>
      {open && hasChildren && (
        <div>{children}</div>
      )}
    </div>
  );
}

export default function FolderTree({ docs, activeFolder, onSelectFolder }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newFolder, setNewFolder] = useState({ parent: "", name: "" });

  const allPaths = buildTree(docs);

  // Build tree structure
  const tree = {};
  allPaths.forEach(path => {
    const parts = path.split("/");
    let node = tree;
    parts.forEach(part => {
      if (!node[part]) node[part] = { children: {}, path: "" };
      node[part].path = parts.slice(0, parts.indexOf(part) + 1).join("/");
      node = node[part].children;
    });
  });

  const renderNode = (node, depth = 0) => {
    return Object.entries(node).map(([key, val]) => {
      const childNodes = renderNode(val.children, depth + 1);
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      return (
        <FolderNode key={val.path} path={val.path} label={label} activeFolder={activeFolder} onSelect={onSelectFolder} depth={depth}>
          {childNodes}
        </FolderNode>
      );
    });
  };

  const handleCreate = () => {
    const fullPath = newFolder.parent
      ? `${newFolder.parent}/${newFolder.name.toLowerCase().replace(/\s+/g, "_")}`
      : newFolder.name.toLowerCase().replace(/\s+/g, "_");
    onSelectFolder(fullPath);
    setShowCreate(false);
    setNewFolder({ parent: "", name: "" });
  };

  return (
    <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-3 min-w-[200px]">
      <div className="flex items-center justify-between mb-2 px-2">
        <span className="text-xs font-semibold text-[#1B2731] uppercase tracking-wide">Carpetas</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowCreate(true)}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm mb-1
          ${activeFolder === "all" ? "bg-[#33A19A] text-white" : "text-[#3E4C59] hover:bg-[#33A19A]/10"}`}
        onClick={() => onSelectFolder("all")}
      >
        <FolderOpen className="w-4 h-4" />
        <span>Todos</span>
      </div>

      {renderNode(tree)}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">Nueva Carpeta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Carpeta padre (opcional)</label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={newFolder.parent}
                onChange={e => setNewFolder({ ...newFolder, parent: e.target.value })}
              >
                <option value="">Raíz</option>
                {allPaths.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input
                className="mt-1"
                value={newFolder.name}
                onChange={e => setNewFolder({ ...newFolder, name: e.target.value })}
                placeholder="Nueva carpeta"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newFolder.name} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}