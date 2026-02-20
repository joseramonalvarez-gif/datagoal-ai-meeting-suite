import React from "react";
import { FileText, FileImage, FileSpreadsheet, File, MoreVertical, ExternalLink, Clock, MessageSquare, CheckCircle, XCircle, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const FILE_ICONS = {
  pdf: { icon: FileText, color: "text-red-500", bg: "bg-red-50" },
  xlsx: { icon: FileSpreadsheet, color: "text-green-600", bg: "bg-green-50" },
  csv: { icon: FileSpreadsheet, color: "text-green-600", bg: "bg-green-50" },
  png: { icon: FileImage, color: "text-blue-500", bg: "bg-blue-50" },
  jpg: { icon: FileImage, color: "text-blue-500", bg: "bg-blue-50" },
  jpeg: { icon: FileImage, color: "text-blue-500", bg: "bg-blue-50" },
};

const STATUS_CONFIG = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-600" },
  pending_approval: { label: "Pendiente aprobación", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Aprobado", color: "bg-green-100 text-green-700" },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-700" },
  archived: { label: "Archivado", color: "bg-gray-100 text-gray-500" },
};

export default function DocumentCard({ doc, projectName, onOpen, onDelete, onNewVersion }) {
  const ext = doc.file_type?.toLowerCase();
  const iconConfig = FILE_ICONS[ext] || { icon: File, color: "text-[#33A19A]", bg: "bg-[#33A19A]/10" };
  const IconComp = iconConfig.icon;
  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.draft;
  const commentCount = doc.comments?.length || 0;

  return (
    <div
      className="bg-white rounded-xl border border-[#B7CAC9]/20 p-4 hover:shadow-lg transition-all duration-300 cursor-pointer"
      onClick={() => onOpen(doc)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl ${iconConfig.bg} flex items-center justify-center flex-shrink-0`}>
            <IconComp className={`w-5 h-5 ${iconConfig.color}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#1B2731] truncate">{doc.name}</h3>
            <p className="text-xs text-[#3E4C59] truncate">{projectName || "—"}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
            {doc.file_url && (
              <DropdownMenuItem onClick={() => window.open(doc.file_url, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" /> Abrir archivo
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onNewVersion(doc)}>
              <Upload className="w-4 h-4 mr-2" /> Nueva versión
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(doc.id)} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {doc.description && (
        <p className="text-xs text-[#3E4C59] mt-2 line-clamp-2">{doc.description}</p>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Badge className={`${statusCfg.color} border-0 text-xs`}>{statusCfg.label}</Badge>
        <Badge className="bg-[#33A19A]/10 text-[#33A19A] border-0 text-xs">v{doc.version || 1}</Badge>
        {ext && <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">{ext.toUpperCase()}</Badge>}
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-[10px] text-[#B7CAC9]">
          {doc.created_date ? format(new Date(doc.created_date), "dd MMM yyyy", { locale: es }) : ""}
        </p>
        {commentCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-[#3E4C59]">
            <MessageSquare className="w-3 h-3" /> {commentCount}
          </span>
        )}
      </div>
    </div>
  );
}