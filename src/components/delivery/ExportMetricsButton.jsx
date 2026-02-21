import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileJson, FileText } from 'lucide-react';

export default function ExportMetricsButton({ clientId }) {
  const [format, setFormat] = useState('json');
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const response = await base44.functions.invoke('exportDeliveryMetrics', {
        format,
        days: parseInt(days),
        client_id: clientId
      });

      if (format === 'csv') {
        // Handle CSV download
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `delivery_metrics_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        // Handle JSON download
        const jsonString = JSON.stringify(response.data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `delivery_metrics_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={days} onValueChange={setDays}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Último día</SelectItem>
          <SelectItem value="7">Últimos 7 días</SelectItem>
          <SelectItem value="30">Últimos 30 días</SelectItem>
          <SelectItem value="90">Últimos 90 días</SelectItem>
        </SelectContent>
      </Select>

      <Select value={format} onValueChange={setFormat}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="json">JSON</SelectItem>
          <SelectItem value="csv">CSV</SelectItem>
        </SelectContent>
      </Select>

      <Button onClick={handleExport} disabled={loading} className="gap-2 bg-[#33A19A] hover:bg-[#2A857F]">
        <Download className="w-4 h-4" />
        {loading ? 'Descargando...' : 'Exportar'}
      </Button>
    </div>
  );
}