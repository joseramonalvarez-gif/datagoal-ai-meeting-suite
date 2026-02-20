import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Building2, Mail, Phone, Search, MoreVertical, Edit, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", contact_email: "", contact_phone: "", industry: "", address: "", notes: "" });

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    setLoading(true);
    const data = await base44.entities.Client.list();
    setClients(data);
    setLoading(false);
  };

  const openNew = () => {
    setEditClient(null);
    setForm({ name: "", contact_email: "", contact_phone: "", industry: "", address: "", notes: "" });
    setShowDialog(true);
  };

  const openEdit = (c) => {
    setEditClient(c);
    setForm({ name: c.name || "", contact_email: c.contact_email || "", contact_phone: c.contact_phone || "", industry: c.industry || "", address: c.address || "", notes: c.notes || "" });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (editClient) {
      await base44.entities.Client.update(editClient.id, form);
    } else {
      await base44.entities.Client.create(form);
    }
    setShowDialog(false);
    loadClients();
  };

  const handleDelete = async (id) => {
    await base44.entities.Client.delete(id);
    loadClients();
  };

  const filtered = clients.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Clientes</h1>
          <p className="text-sm text-[#3E4C59] mt-1">Gestiona tus clientes y tenants</p>
        </div>
        <Button onClick={openNew} className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2">
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B7CAC9]" />
        <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-white border-[#B7CAC9]/30" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-[#B7CAC9]/20 p-5 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#33A19A]/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#33A19A]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-[#1B2731]">{c.name}</h3>
                    {c.industry && <p className="text-xs text-[#3E4C59]">{c.industry}</p>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(c)}><Edit className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Eliminar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4 space-y-2">
                {c.contact_email && (
                  <div className="flex items-center gap-2 text-sm text-[#3E4C59]">
                    <Mail className="w-3.5 h-3.5" /> {c.contact_email}
                  </div>
                )}
                {c.contact_phone && (
                  <div className="flex items-center gap-2 text-sm text-[#3E4C59]">
                    <Phone className="w-3.5 h-3.5" /> {c.contact_phone}
                  </div>
                )}
              </div>
              <div className="mt-3">
                <Badge className={c.status === 'active' ? 'bg-green-50 text-green-700 border-0' : 'bg-gray-100 text-gray-600 border-0'}>
                  {c.status === 'active' ? 'Activo' : c.status || 'Activo'}
                </Badge>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#3E4C59]">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
              <p>No se encontraron clientes</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{editClient ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#1B2731]">Nombre *</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B2731]">Email de contacto</label>
              <Input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B2731]">Teléfono</label>
              <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B2731]">Industria</label>
              <Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1B2731]">Notas</label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name} className="bg-[#33A19A] hover:bg-[#2A857F] text-white">
              {editClient ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}