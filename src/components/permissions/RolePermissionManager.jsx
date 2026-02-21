import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const MODULE_PERMISSIONS = {
  meetings: ['create', 'edit', 'delete', 'view_all'],
  tasks: ['create', 'edit', 'assign', 'delete', 'view_all'],
  queries: ['create', 'edit', 'delete', 'execute', 'share', 'view_all'],
  reports: ['create', 'edit', 'delete', 'approve', 'send', 'view_all'],
  analytics: ['view', 'export'],
  admin: ['manage_users', 'manage_permissions', 'view_audit', 'manage_settings']
};

const MODULE_LABELS = {
  meetings: 'Reuniones',
  tasks: 'Tareas',
  queries: 'Consultas',
  reports: 'Reportes',
  analytics: 'Análisis',
  admin: 'Administración'
};

export default function RolePermissionManager({ role = '', permissions = {}, onChange }) {
  const handlePermissionChange = (module, permission, value) => {
    const updated = { ...permissions };
    if (!updated[module]) updated[module] = {};
    updated[module][permission] = value;
    onChange(updated);
  };

  const allPermissions = (module) => {
    const modulePerms = MODULE_PERMISSIONS[module] || [];
    return modulePerms.every(p => permissions[module]?.[p]);
  };

  const toggleAllPermissions = (module) => {
    const updated = { ...permissions };
    if (!updated[module]) updated[module] = {};
    const newValue = !allPermissions(module);
    MODULE_PERMISSIONS[module].forEach(p => {
      updated[module][p] = newValue;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {Object.keys(MODULE_PERMISSIONS).map(module => (
        <Card key={module}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{MODULE_LABELS[module]}</CardTitle>
              <Checkbox
                checked={allPermissions(module)}
                onCheckedChange={() => toggleAllPermissions(module)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {MODULE_PERMISSIONS[module].map(permission => (
                <label key={permission} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={permissions[module]?.[permission] || false}
                    onCheckedChange={(value) =>
                      handlePermissionChange(module, permission, value)
                    }
                  />
                  <span className="text-sm text-[#3E4C59]">{permission}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}