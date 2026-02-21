import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2 } from 'lucide-react';
import RolePermissionManager from '../components/permissions/RolePermissionManager';
import { getRoleLabel } from '../components/utils/roleUtils';

const ROLES = ['admin', 'consultor', 'lider_proyecto', 'colaborador', 'cliente', 'gerencia', 'director_area', 'staff'];

export default function PermissionManager() {
  const [selectedRole, setSelectedRole] = useState('consultor');
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ role: 'consultor', permissions: {} });

  const queryClient = useQueryClient();

  const { data: permissions = [] } = useQuery({
    queryKey: ['permissionMatrix'],
    queryFn: () => base44.entities.PermissionMatrix.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PermissionMatrix.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissionMatrix'] });
      setFormData({ role: 'consultor', permissions: {} });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PermissionMatrix.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissionMatrix'] });
      setEditingId(null);
      setFormData({ role: 'consultor', permissions: {} });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PermissionMatrix.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['permissionMatrix'] })
  });

  const handleSave = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const rolePermissions = permissions.filter(p => p.role === selectedRole);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-[#1B2731]">Gestión de Permisos</h1>
        <p className="text-sm text-[#3E4C59]">Define permisos granulares para cada rol</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role Selector */}
        <div className="space-y-3">
          <h3 className="font-heading font-semibold text-[#1B2731]">Roles</h3>
          {ROLES.map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                selectedRole === role
                  ? 'bg-[#33A19A] text-white'
                  : 'bg-white text-[#1B2731] hover:bg-[#F5F5F5]'
              }`}
            >
              {getRoleLabel(role)}
            </button>
          ))}
        </div>

        {/* Permissions List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-semibold text-[#1B2731]">Permisos por Rol</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-[#33A19A] gap-2">
                  <Plus className="w-4 h-4" /> Nueva Configuración
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configurar Permisos</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-[#1B2731]">Rol</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full border rounded px-3 py-2 mt-1"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{getRoleLabel(r)}</option>
                      ))}
                    </select>
                  </div>
                  <RolePermissionManager
                    role={formData.role}
                    permissions={formData.permissions}
                    onChange={(p) => setFormData({ ...formData, permissions: p })}
                  />
                  <Button onClick={handleSave} className="w-full bg-[#33A19A]">
                    Guardar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {rolePermissions.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-[#3E4C59]">
                  Sin configuraciones personalizadas
                </CardContent>
              </Card>
            ) : (
              rolePermissions.map(perm => (
                <Card key={perm.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{getRoleLabel(perm.role)}</CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingId(perm.id);
                            setFormData(perm);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(perm.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(perm.permissions || {}).map(([module, perms]) => (
                        <div key={module}>
                          <p className="text-xs font-semibold text-[#1B2731] mb-1">{module}</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(perms).map(([perm, value]) => (
                              value && (
                                <Badge key={perm} variant="secondary" className="text-xs">
                                  {perm}
                                </Badge>
                              )
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}