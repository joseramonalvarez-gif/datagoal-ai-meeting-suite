import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Upload, CheckCircle, XCircle, Edit, Shield } from "lucide-react";
import { toast } from "sonner";

const ASSET_TYPES = ["AUDIO_SHORT", "AUDIO_LONG", "TRANSCRIPT_WITH_TIMECODES", "TRANSCRIPT_PLAIN"];
const REQUIRED_TYPES = ["AUDIO_SHORT", "TRANSCRIPT_WITH_TIMECODES"];

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5 space-y-4">
      <h3 className="font-heading font-semibold text-[#1B2731]">{title}</h3>
      {children}
    </div>
  );
}

export default function QaSetupTab({ selectedClient, selectedProject }) {
  const [assets, setAssets] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [pushTargets, setPushTargets] = useState([]);
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [showRecipDialog, setShowRecipDialog] = useState(false);
  const [editRecip, setEditRecip] = useState(null);
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [editPush, setEditPush] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [assetForm, setAssetForm] = useState({ name: "", asset_type: "AUDIO_SHORT", notes: "", enabled: true });
  const [recipForm, setRecipForm] = useState({ name: "", participant_emails: "", project_lead_emails: "", management_emails: "", enabled: true });
  const [pushForm, setPushForm] = useState({ user_email: "", push_token: "", device_label: "", enabled: true });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [a, r, p] = await Promise.all([
      base44.entities.QaTestAsset.list(),
      base44.entities.QaRecipientsConfig.list(),
      base44.entities.QaPushTarget.list(),
    ]);
    setAssets(a); setRecipients(r); setPushTargets(p);
  };

  const validateAssets = () => {
    const missing = REQUIRED_TYPES.filter(t => !assets.some(a => a.asset_type === t && a.enabled && a.file_url));
    if (missing.length === 0) toast.success("✅ Todos los activos requeridos están configurados");
    else toast.error(`❌ Faltan activos: ${missing.join(", ")}`);
  };

  const handleUploadAsset = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mp3,.wav,.m4a,.txt,.vtt,.srt,.ogg,.webm";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAssetForm(f => ({
        ...f,
        file_url,
        mime_type: file.type,
        size_bytes: file.size,
        name: f.name || file.name,
      }));
      setUploading(false);
      toast.success("Archivo subido. Guarda el activo.");
    };
    input.click();
  };

  const saveAsset = async () => {
    if (editAsset) await base44.entities.QaTestAsset.update(editAsset.id, assetForm);
    else await base44.entities.QaTestAsset.create(assetForm);
    setShowAssetDialog(false); loadAll();
  };

  const saveRecip = async () => {
    if (editRecip) await base44.entities.QaRecipientsConfig.update(editRecip.id, recipForm);
    else await base44.entities.QaRecipientsConfig.create(recipForm);
    setShowRecipDialog(false); loadAll();
  };

  const savePush = async () => {
    if (editPush) await base44.entities.QaPushTarget.update(editPush.id, pushForm);
    else await base44.entities.QaPushTarget.create(pushForm);
    setShowPushDialog(false); loadAll();
  };

  const openEditAsset = (a) => { setEditAsset(a); setAssetForm({ name: a.name, asset_type: a.asset_type, notes: a.notes||"", enabled: a.enabled, file_url: a.file_url, mime_type: a.mime_type, size_bytes: a.size_bytes }); setShowAssetDialog(true); };
  const openEditRecip = (r) => { setEditRecip(r); setRecipForm({ name: r.name, participant_emails: r.participant_emails||"", project_lead_emails: r.project_lead_emails||"", management_emails: r.management_emails||"", enabled: r.enabled }); setShowRecipDialog(true); };
  const openEditPush = (p) => { setEditPush(p); setPushForm({ user_email: p.user_email, push_token: p.push_token||"", device_label: p.device_label||"", enabled: p.enabled }); setShowPushDialog(true); };

  return (
    <div className="space-y-5">
      {/* Assets */}
      <Section title="Activos de prueba (QA Test Assets)">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { setEditAsset(null); setAssetForm({ name: "", asset_type: "AUDIO_SHORT", notes: "", enabled: true }); setShowAssetDialog(true); }} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
            <Plus className="w-3 h-3" /> Añadir activo
          </Button>
          <Button size="sm" variant="outline" onClick={validateAssets} className="gap-2">
            <Shield className="w-3 h-3" /> Validar activos
          </Button>
        </div>
        <div className="space-y-2">
          {REQUIRED_TYPES.map(t => {
            const has = assets.some(a => a.asset_type === t && a.enabled && a.file_url);
            return (
              <div key={t} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${has ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {has ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                <span>{t}</span>
                {!has && <span className="ml-auto font-medium">Requerido</span>}
              </div>
            );
          })}
        </div>
        <div className="divide-y divide-[#B7CAC9]/10">
          {assets.map(a => (
            <div key={a.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-[#3E4C59]">{a.asset_type} · {a.mime_type || "—"} · {a.size_bytes ? `${(a.size_bytes/1024).toFixed(1)}KB` : "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={a.enabled && a.file_url ? "bg-green-50 text-green-700 border-0 text-xs" : "bg-gray-100 text-gray-500 border-0 text-xs"}>
                  {a.file_url ? "Listo" : "Sin archivo"}
                </Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAsset(a)}><Edit className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => base44.entities.QaTestAsset.delete(a.id).then(loadAll)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
          {assets.length === 0 && <p className="text-xs text-[#B7CAC9] py-2">Sin activos configurados</p>}
        </div>
      </Section>

      {/* Recipients */}
      <Section title="Destinatarios email QA">
        <Button size="sm" onClick={() => { setEditRecip(null); setRecipForm({ name: "", participant_emails: "", project_lead_emails: "", management_emails: "", enabled: true }); setShowRecipDialog(true); }} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
          <Plus className="w-3 h-3" /> Añadir config
        </Button>
        <div className="divide-y divide-[#B7CAC9]/10">
          {recipients.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-[#3E4C59] truncate max-w-xs">{r.participant_emails || "Sin participantes"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={r.enabled ? "bg-green-50 text-green-700 border-0 text-xs" : "bg-gray-100 text-gray-500 border-0 text-xs"}>{r.enabled ? "Activo" : "Inactivo"}</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRecip(r)}><Edit className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => base44.entities.QaRecipientsConfig.delete(r.id).then(loadAll)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
          {recipients.length === 0 && <p className="text-xs text-[#B7CAC9] py-2">Sin configuraciones de destinatarios</p>}
        </div>
      </Section>

      {/* Push Targets */}
      <Section title="Dispositivos Push QA">
        <Button size="sm" onClick={() => { setEditPush(null); setPushForm({ user_email: "", push_token: "", device_label: "", enabled: true }); setShowPushDialog(true); }} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
          <Plus className="w-3 h-3" /> Añadir dispositivo
        </Button>
        <div className="divide-y divide-[#B7CAC9]/10">
          {pushTargets.map(p => (
            <div key={p.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{p.device_label || p.user_email}</p>
                <p className="text-xs text-[#3E4C59]">{p.user_email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={p.enabled && p.push_token ? "bg-green-50 text-green-700 border-0 text-xs" : "bg-gray-100 text-gray-500 border-0 text-xs"}>
                  {p.push_token ? "Token OK" : "Sin token"}
                </Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPush(p)}><Edit className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => base44.entities.QaPushTarget.delete(p.id).then(loadAll)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
          {pushTargets.length === 0 && <p className="text-xs text-[#B7CAC9] py-2">Sin dispositivos push configurados</p>}
        </div>
      </Section>

      {/* Asset dialog */}
      <Dialog open={showAssetDialog} onOpenChange={setShowAssetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">{editAsset ? "Editar" : "Nuevo"} Activo QA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Nombre</label><Input value={assetForm.name} onChange={e=>setAssetForm({...assetForm,name:e.target.value})} className="mt-1" /></div>
            <div><label className="text-sm font-medium">Tipo</label>
              <Select value={assetForm.asset_type} onValueChange={v=>setAssetForm({...assetForm,asset_type:v})}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Archivo</label>
              <div className="flex gap-2 mt-1">
                <Button type="button" variant="outline" size="sm" onClick={handleUploadAsset} disabled={uploading} className="gap-2">
                  {uploading ? <div className="animate-spin w-3 h-3 border-2 border-[#33A19A] border-t-transparent rounded-full"/> : <Upload className="w-3 h-3"/>}
                  {assetForm.file_url ? "Cambiar archivo" : "Subir archivo"}
                </Button>
                {assetForm.file_url && <Badge className="bg-green-50 text-green-700 border-0">Subido</Badge>}
              </div>
            </div>
            <div><label className="text-sm font-medium">Notas</label><Textarea value={assetForm.notes} onChange={e=>setAssetForm({...assetForm,notes:e.target.value})} className="mt-1" rows={2}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowAssetDialog(false)}>Cancelar</Button>
            <Button onClick={saveAsset} disabled={!assetForm.name} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipients dialog */}
      <Dialog open={showRecipDialog} onOpenChange={setShowRecipDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Config Destinatarios QA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Nombre config</label><Input value={recipForm.name} onChange={e=>setRecipForm({...recipForm,name:e.target.value})} className="mt-1" placeholder="ej: Staging default"/></div>
            <div><label className="text-sm font-medium">Emails participantes (separados por coma)</label><Textarea value={recipForm.participant_emails} onChange={e=>setRecipForm({...recipForm,participant_emails:e.target.value})} className="mt-1" rows={2} placeholder="a@empresa.com, b@empresa.com"/></div>
            <div><label className="text-sm font-medium">Project leads</label><Textarea value={recipForm.project_lead_emails} onChange={e=>setRecipForm({...recipForm,project_lead_emails:e.target.value})} className="mt-1" rows={2}/></div>
            <div><label className="text-sm font-medium">Gerencias</label><Textarea value={recipForm.management_emails} onChange={e=>setRecipForm({...recipForm,management_emails:e.target.value})} className="mt-1" rows={2}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowRecipDialog(false)}>Cancelar</Button>
            <Button onClick={saveRecip} disabled={!recipForm.name} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push dialog */}
      <Dialog open={showPushDialog} onOpenChange={setShowPushDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">Dispositivo Push QA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Email usuario</label><Input value={pushForm.user_email} onChange={e=>setPushForm({...pushForm,user_email:e.target.value})} className="mt-1"/></div>
            <div><label className="text-sm font-medium">Push token</label><Input value={pushForm.push_token} onChange={e=>setPushForm({...pushForm,push_token:e.target.value})} className="mt-1"/></div>
            <div><label className="text-sm font-medium">Label dispositivo</label><Input value={pushForm.device_label} onChange={e=>setPushForm({...pushForm,device_label:e.target.value})} className="mt-1" placeholder="ej: iPhone de Juan"/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowPushDialog(false)}>Cancelar</Button>
            <Button onClick={savePush} disabled={!pushForm.user_email} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}