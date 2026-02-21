import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Shield, Mail, Plus, Edit2, Trash2 } from 'lucide-react';

export default function AdminPanel() {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('consultant');
  const [editingUser, setEditingUser] = useState(null);
  const [permissionForm, setPermissionForm] = useState({});

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => base44.asServiceRole.entities.PermissionMatrix.list()
  });

  const inviteMutation = useMutation({
    mutationFn: (email) => base44.users.inviteUser(email, inviteRole),
    onSuccess: () => {
      setInviteEmail('');
      setInviteRole('consultant');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('updateUserPermissions', data),
    onSuccess: () => {
      setEditingUser(null);
      setPermissionForm({});
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    }
  });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    inviteMutation.mutate(inviteEmail);
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    await updatePermissionsMutation.mutateAsync({
      user_email: editingUser.email,
      role: permissionForm.role || editingUser.role,
      permissions: permissionForm.permissions
    });
  };

  const PermissionCheckbox = ({ section, key, label }) => (
    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-[#FFFAF3] rounded">
      <Checkbox
        checked={permissionForm.permissions?.[section]?.[key] || false}
        onCheckedChange={(c) => setPermissionForm({
          ...permissionForm,
          permissions: {
            ...permissionForm.permissions,
            [section]: {
              ...permissionForm.permissions?.[section],
              [key]: c
            }
          }
        })}
      />
      <span className="text-sm">{label}</span>
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1B2731] font-heading flex items-center gap-2">
          <Shield className="w-8 h-8 text-[#33A19A]" />
          Panel de Administración
        </h1>
        <p className="text-[#3E4C59] mt-1">Gestión de usuarios, roles y permisos</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" /> Usuarios
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Shield className="w-4 h-4" /> Permisos
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card className="bg-[#E8F5F4] border-[#33A19A]">
            <CardHeader>
              <CardTitle className="text-base">Invitar Usuario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                />
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultant">Consultor</SelectItem>
                    <SelectItem value="analyst">Analista</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleInvite}
                  disabled={inviteMutation.isPending}
                  className="bg-[#33A19A] hover:bg-[#2A857F]"
                >
                  <Plus className="w-4 h-4 mr-1" /> Invitar
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {users.map(user => (
              <Card key={user.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[#1B2731]">{user.full_name}</p>
                      <p className="text-sm text-[#3E4C59]">{user.email}</p>
                      <Badge className="mt-2" variant={user.role === 'admin' ? 'default' : 'outline'}>
                        {user.role}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => {
                        setEditingUser(user);
                        setPermissionForm({ role: user.role, permissions: {} });
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4">
          {editingUser ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{editingUser.full_name}</CardTitle>
                    <CardDescription>{editingUser.email}</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setEditingUser(null)}>Cerrar</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium block mb-2">Rol Base</label>
                  <Select
                    value={permissionForm.role || editingUser.role}
                    onValueChange={(r) => setPermissionForm({ ...permissionForm, role: r })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="analyst">Analista</SelectItem>
                      <SelectItem value="consultant">Consultor</SelectItem>
                      <SelectItem value="viewer">Visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="font-medium text-sm mb-2">Reuniones</p>
                    <div className="space-y-1">
                      <PermissionCheckbox section="meetings" key="create" label="Crear" />
                      <PermissionCheckbox section="meetings" key="edit" label="Editar" />
                      <PermissionCheckbox section="meetings" key="delete" label="Eliminar" />
                      <PermissionCheckbox section="meetings" key="view_all" label="Ver todas" />
                    </div>
                  </div>

                  <div>
                    <p className="font-medium text-sm mb-2">Tareas</p>
                    <div className="space-y-1">
                      <PermissionCheckbox section="tasks" key="create" label="Crear" />
                      <PermissionCheckbox section="tasks" key="edit" label="Editar" />
                      <PermissionCheckbox section="tasks" key="assign" label="Asignar" />
                      <PermissionCheckbox section="tasks" key="delete" label="Eliminar" />
                      <PermissionCheckbox section="tasks" key="view_all" label="Ver todas" />
                    </div>
                  </div>

                  <div>
                    <p className="font-medium text-sm mb-2">Reportes</p>
                    <div className="space-y-1">
                      <PermissionCheckbox section="reports" key="generate" label="Generar" />
                      <PermissionCheckbox section="reports" key="approve" label="Aprobar" />
                      <PermissionCheckbox section="reports" key="send" label="Enviar" />
                      <PermissionCheckbox section="reports" key="view_all" label="Ver todos" />
                    </div>
                  </div>

                  <div>
                    <p className="font-medium text-sm mb-2">Admin</p>
                    <div className="space-y-1">
                      <PermissionCheckbox section="admin" key="manage_users" label="Gestionar usuarios" />
                      <PermissionCheckbox section="admin" key="manage_permissions" label="Gestionar permisos" />
                      <PermissionCheckbox section="admin" key="view_audit" label="Ver auditoría" />
                      <PermissionCheckbox section="admin" key="manage_settings" label="Gestionar configuración" />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSavePermissions}
                  disabled={updatePermissionsMutation.isPending}
                  className="w-full bg-[#33A19A] hover:bg-[#2A857F]"
                >
                  Guardar Permisos
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-[#3E4C59]">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Selecciona un usuario de la pestaña "Usuarios" para editar permisos</p>
              </CardContent>
            </Card>
          )}

          {/* Matrix View */}
          <Card>
            <CardHeader>
              <CardTitle>Matriz de Permisos Actual</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#B7CAC9]/30">
                    <th className="text-left p-2 font-medium">Usuario</th>
                    <th className="text-left p-2 font-medium">Rol</th>
                    <th className="text-left p-2 font-medium">Permisos Activos</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map(perm => {
                    const activePerms = Object.entries(perm.permissions || {})
                      .flatMap(([section, perms]) => 
                        Object.entries(perms).filter(([_, v]) => v).map(([k]) => `${section}.${k}`)
                      );
                    return (
                      <tr key={perm.id} className="border-b border-[#B7CAC9]/30">
                        <td className="p-2 text-[#1B2731]">{perm.user_email}</td>
                        <td className="p-2"><Badge variant="outline">{perm.role}</Badge></td>
                        <td className="p-2 text-xs text-[#3E4C59]">{activePerms.length} permisos</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}