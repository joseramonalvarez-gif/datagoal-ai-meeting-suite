import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';

export default function PermissionSelector({ permissions = {}, onChange, title = "Permisos" }) {
  const [email, setEmail] = useState('');
  const [selectedPermission, setSelectedPermission] = useState('can_view');

  const permissionTypes = ['can_view', 'can_edit', 'can_execute', 'can_approve'];

  const handleAddPermission = () => {
    if (!email.trim()) return;

    const updated = { ...permissions };
    if (!updated[selectedPermission]) updated[selectedPermission] = [];
    if (!updated[selectedPermission].includes(email)) {
      updated[selectedPermission].push(email);
    }
    onChange(updated);
    setEmail('');
  };

  const handleRemovePermission = (permType, email) => {
    const updated = { ...permissions };
    updated[permType] = updated[permType].filter(e => e !== email);
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Email usuario/grupo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAddPermission()}
          />
          <select
            value={selectedPermission}
            onChange={(e) => setSelectedPermission(e.target.value)}
            className="border rounded px-2"
          >
            {permissionTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <Button onClick={handleAddPermission} size="sm" className="bg-[#33A19A]">
            Añadir
          </Button>
        </div>

        <div className="space-y-3">
          {permissionTypes.map(permType => (
            permissions[permType]?.length > 0 && (
              <div key={permType} className="text-xs">
                <p className="font-semibold text-[#3E4C59] mb-2">{permType}:</p>
                <div className="space-y-1 pl-2">
                  {permissions[permType].map(email => (
                    <div key={email} className="flex items-center justify-between bg-[#F5F5F5] p-2 rounded">
                      <span>{email}</span>
                      <button
                        onClick={() => handleRemovePermission(permType, email)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </CardContent>
    </Card>
  );
}