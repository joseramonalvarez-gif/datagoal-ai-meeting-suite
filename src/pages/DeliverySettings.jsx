import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Save, AlertCircle } from 'lucide-react';

export default function DeliverySettings() {
  const [settings, setSettings] = useState({
    auto_qa_enabled: true,
    auto_send_on_success: false,
    default_template_id: '',
    max_retries: 3,
    retry_delay_minutes: 5,
    notification_emails: [],
    archive_after_days: 30
  });

  const [newEmail, setNewEmail] = useState('');
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.DeliveryTemplate.filter({ is_active: true })
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Save to user profile or settings entity
      await base44.auth.updateMe({ delivery_settings: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    }
  });

  const handleAddEmail = () => {
    if (newEmail && !settings.notification_emails.includes(newEmail)) {
      setSettings({
        ...settings,
        notification_emails: [...settings.notification_emails, newEmail]
      });
      setNewEmail('');
    }
  };

  const handleRemoveEmail = (email) => {
    setSettings({
      ...settings,
      notification_emails: settings.notification_emails.filter(e => e !== email)
    });
  };

  const handleSave = async () => {
    await saveMutation.mutateAsync(settings);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-[#1B2731] font-heading flex items-center gap-2">
          <Settings className="w-8 h-8 text-[#33A19A]" />
          Configuración de Entregas
        </h1>
        <p className="text-[#3E4C59] mt-1">Personaliza el comportamiento del pipeline de entregas</p>
      </div>

      {/* QA Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Validación QA</CardTitle>
          <CardDescription>Control automático de calidad</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer p-3 border border-[#B7CAC9]/30 rounded-lg hover:bg-[#FFFAF3]">
            <Checkbox
              checked={settings.auto_qa_enabled}
              onCheckedChange={(c) => setSettings({ ...settings, auto_qa_enabled: c })}
            />
            <div>
              <p className="font-medium text-sm">Habilitar QA automático</p>
              <p className="text-xs text-[#3E4C59]">Ejecuta validaciones automáticas antes de enviar</p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Auto-Send Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envío Automático</CardTitle>
          <CardDescription>Comportamiento después de validación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer p-3 border border-[#B7CAC9]/30 rounded-lg hover:bg-[#FFFAF3]">
            <Checkbox
              checked={settings.auto_send_on_success}
              onCheckedChange={(c) => setSettings({ ...settings, auto_send_on_success: c })}
            />
            <div>
              <p className="font-medium text-sm">Enviar automáticamente si pasa QA</p>
              <p className="text-xs text-[#3E4C59]">No requiere confirmación manual</p>
            </div>
          </label>

          {settings.auto_send_on_success && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded flex gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700">Las entregas se enviarán automáticamente sin confirmación manual</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Default Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template por Defecto</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={settings.default_template_id} onValueChange={(v) => setSettings({ ...settings, default_template_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Retry Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reintentos</CardTitle>
          <CardDescription>Configuración de reintentos fallidos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Máximo de reintentos</label>
            <Input
              type="number"
              min="1"
              max="10"
              value={settings.max_retries}
              onChange={(e) => setSettings({ ...settings, max_retries: parseInt(e.target.value) })}
              className="mt-1"
            />
            <p className="text-xs text-[#3E4C59] mt-1">Número de veces que se reintentará una entrega fallida</p>
          </div>

          <div>
            <label className="text-sm font-medium">Espera entre reintentos (minutos)</label>
            <Input
              type="number"
              min="1"
              max="60"
              value={settings.retry_delay_minutes}
              onChange={(e) => setSettings({ ...settings, retry_delay_minutes: parseInt(e.target.value) })}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificaciones</CardTitle>
          <CardDescription>Quién recibe alertas de entregas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
            />
            <Button variant="outline" onClick={handleAddEmail}>
              Añadir
            </Button>
          </div>

          {settings.notification_emails.length > 0 && (
            <div className="space-y-2">
              {settings.notification_emails.map(email => (
                <div key={email} className="flex items-center justify-between p-2 bg-[#FFFAF3] rounded border border-[#B7CAC9]/30">
                  <span className="text-sm">{email}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveEmail(email)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleanup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limpieza Automática</CardTitle>
          <CardDescription>Archivar entregas antiguas</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <label className="text-sm font-medium">Archivar después de (días)</label>
            <Input
              type="number"
              min="7"
              max="365"
              value={settings.archive_after_days}
              onChange={(e) => setSettings({ ...settings, archive_after_days: parseInt(e.target.value) })}
              className="mt-1"
            />
            <p className="text-xs text-[#3E4C59] mt-1">Las entregas completadas serán archivadas automáticamente</p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-[#33A19A] hover:bg-[#2A857F] gap-2">
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
}