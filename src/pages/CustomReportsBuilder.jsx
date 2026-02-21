import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Eye, Zap, Mail } from 'lucide-react';

export default function CustomReportsBuilder() {
  const queryClient = useQueryClient();
  const [newReport, setNewReport] = useState({
    name: '',
    description: '',
    query_ids: [],
    sections: [],
    is_scheduled: false,
    schedule_frequency: 'weekly',
    recipients: []
  });
  const [showDialog, setShowDialog] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');

  const { data: savedQueries = [] } = useQuery({
    queryKey: ['savedQueries'],
    queryFn: () => base44.entities.SavedQuery.list('-updated_date', 100)
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['customReports'],
    queryFn: () => base44.entities.CustomReport.list('-updated_date', 50)
  });

  const createMutation = useMutation({
    mutationFn: (report) => base44.entities.CustomReport.create(report),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customReports'] });
      setNewReport({
        name: '',
        description: '',
        query_ids: [],
        sections: [],
        is_scheduled: false,
        schedule_frequency: 'weekly',
        recipients: []
      });
      setShowDialog(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomReport.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customReports'] })
  });

  const toggleQuery = (queryId) => {
    const updated = newReport.query_ids.includes(queryId)
      ? newReport.query_ids.filter(id => id !== queryId)
      : [...newReport.query_ids, queryId];
    setNewReport({ ...newReport, query_ids: updated });
  };

  const addRecipient = () => {
    if (recipientEmail && !newReport.recipients.includes(recipientEmail)) {
      setNewReport({
        ...newReport,
        recipients: [...newReport.recipients, recipientEmail]
      });
      setRecipientEmail('');
    }
  };

  const removeRecipient = (email) => {
    setNewReport({
      ...newReport,
      recipients: newReport.recipients.filter(e => e !== email)
    });
  };

  const handleSave = () => {
    if (!newReport.name || newReport.query_ids.length === 0) return;

    const sections = newReport.query_ids.map((qid, idx) => ({
      title: savedQueries.find(q => q.id === qid)?.name || `Sección ${idx + 1}`,
      query_id: qid,
      chart_type: 'table',
      order: idx
    }));

    createMutation.mutate({
      ...newReport,
      sections,
      status: 'draft'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2731] font-heading">Reportes Personalizados</h1>
          <p className="text-[#3E4C59] mt-2">Crea reportes combinando múltiples consultas</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-[#33A19A] hover:bg-[#2A857F]">
              <Plus className="w-4 h-4" />
              Nuevo Reporte
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Reporte</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre del Reporte</label>
                <Input
                  placeholder="Ej: Reporte Semanal de Entregas"
                  value={newReport.name}
                  onChange={(e) => setNewReport({...newReport, name: e.target.value})}
                  className="mt-1 border-[#B7CAC9]/40"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  placeholder="Describe qué información contiene este reporte"
                  value={newReport.description}
                  onChange={(e) => setNewReport({...newReport, description: e.target.value})}
                  className="mt-1 border-[#B7CAC9]/40 h-20"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-3">Selecciona Consultas</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-[#B7CAC9]/30 rounded-lg p-3">
                  {savedQueries.map(query => (
                    <div key={query.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={newReport.query_ids.includes(query.id)}
                        onCheckedChange={() => toggleQuery(query.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#1B2731]">{query.name}</p>
                        <p className="text-xs text-[#B7CAC9]">{query.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    checked={newReport.is_scheduled}
                    onCheckedChange={(v) => setNewReport({...newReport, is_scheduled: v})}
                  />
                  <label className="text-sm font-medium">Programar generación automática</label>
                </div>

                {newReport.is_scheduled && (
                  <div className="space-y-3 bg-[#FFFAF3] p-3 rounded">
                    <div>
                      <label className="text-sm font-medium">Frecuencia</label>
                      <Select
                        value={newReport.schedule_frequency}
                        onValueChange={(v) => setNewReport({...newReport, schedule_frequency: v})}
                      >
                        <SelectTrigger className="mt-1 border-[#B7CAC9]/40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Diariamente</SelectItem>
                          <SelectItem value="weekly">Semanalmente</SelectItem>
                          <SelectItem value="monthly">Mensualmente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Enviar a</label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          placeholder="email@example.com"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          className="border-[#B7CAC9]/40"
                        />
                        <Button onClick={addRecipient} size="sm" className="bg-[#33A19A]">
                          Agregar
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {newReport.recipients.map(email => (
                          <Badge key={email} className="bg-[#E8F5F4] text-[#33A19A]">
                            {email}
                            <button
                              onClick={() => removeRecipient(email)}
                              className="ml-2 text-xs hover:opacity-70"
                            >
                              ✕
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || !newReport.name || newReport.query_ids.length === 0}
                className="w-full bg-[#33A19A] hover:bg-[#2A857F]"
              >
                Crear Reporte
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="bg-white rounded-lg p-6 animate-pulse h-32" />)}
        </div>
      ) : reports.length === 0 ? (
        <Card className="bg-white border-[#B7CAC9]/30">
          <CardContent className="pt-6 text-center">
            <p className="text-[#3E4C59]">No tienes reportes personalizados. Crea uno nuevo.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map(report => (
            <Card key={report.id} className="bg-white border-[#B7CAC9]/30 hover:border-[#33A19A] transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-[#1B2731]">{report.name}</CardTitle>
                    <CardDescription>{report.description}</CardDescription>
                    <div className="flex gap-2 mt-2">
                      <Badge className="bg-[#E8F5F4] text-[#33A19A]">{report.status}</Badge>
                      {report.is_scheduled && <Badge className="bg-blue-100 text-blue-800 gap-1">
                        <Zap className="w-3 h-3" /> {report.schedule_frequency}
                      </Badge>}
                      {report.recipients?.length > 0 && <Badge className="bg-purple-100 text-purple-800 gap-1">
                        <Mail className="w-3 h-3" /> {report.recipients.length}
                      </Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-[#33A19A] text-[#33A19A]">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(report.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#3E4C59]">
                  {report.query_ids?.length || 0} consultas • {report.recipients?.length || 0} destinatarios
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}