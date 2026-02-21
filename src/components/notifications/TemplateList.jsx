import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Mail } from "lucide-react";

export default function TemplateList({ templates, loading, onEdit, onDelete }) {
  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin w-5 h-5 border-2 border-[#33A19A] border-t-transparent rounded-full" /></div>;

  if (templates.length === 0) return (
    <div className="text-center py-14 bg-white rounded-xl border border-[#B7CAC9]/20">
      <Mail className="w-10 h-10 mx-auto text-[#B7CAC9] mb-2" />
      <p className="text-sm text-[#3E4C59]">No hay plantillas de email. Crea una para comenzar.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {templates.map(t => (
        <div key={t.id} className="bg-white rounded-xl border border-[#B7CAC9]/20 p-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-heading font-semibold text-[#1B2731]">{t.name}</span>
              <Badge className={`text-xs border ${t.is_active !== false ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {t.is_active !== false ? "Activa" : "Inactiva"}
              </Badge>
            </div>
            {t.description && <p className="text-xs text-[#3E4C59] mb-2">{t.description}</p>}
            <p className="text-xs text-[#B7CAC9]"><span className="font-medium text-[#3E4C59]">Asunto:</span> {t.subject}</p>
            {t.variables?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {t.variables.map(v => (
                  <code key={v} className="text-[10px] bg-[#E8F5F4] text-[#33A19A] px-1.5 py-0.5 rounded font-mono">{`{{${v}}}`}</code>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => onEdit(t)} className="h-8 w-8"><Edit2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)} className="h-8 w-8 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}