import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Play, Copy, Download } from 'lucide-react';

const PRESET_QUERIES = {
  meetings: {
    name: 'Volumen de Reuniones',
    query: `SELECT 
  DATE(created_date) as fecha,
  json_data->>'client_id' as cliente,
  COUNT(*) as total_reuniones,
  COUNT(DISTINCT json_data->>'project_id') as proyectos
FROM \`project.dataset.app_events\`
WHERE json_data->>'entity_type' = 'Meeting'
  AND DATE(created_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY fecha, cliente
ORDER BY fecha DESC`
  },
  transcriptions: {
    name: 'Tasas de Transcripción',
    query: `SELECT 
  json_data->>'client_id' as cliente,
  COUNT(*) as total_transcripciones,
  COUNT(CASE WHEN json_data->>'status' = 'completed' THEN 1 END) as completadas,
  ROUND(100 * COUNT(CASE WHEN json_data->>'status' = 'completed' THEN 1 END) / COUNT(*), 1) as tasa_exito
FROM \`project.dataset.app_events\`
WHERE json_data->>'entity_type' = 'Transcript'
GROUP BY cliente
ORDER BY total_transcripciones DESC`
  },
  deliveries: {
    name: 'Éxito de Entregas',
    query: `SELECT 
  json_data->>'client_id' as cliente,
  json_data->>'delivery_template_id' as plantilla,
  COUNT(*) as total,
  COUNT(CASE WHEN json_data->>'status' = 'delivered' THEN 1 END) as exitosas,
  ROUND(AVG(CAST(json_data->>'quality_score' AS FLOAT64)) * 100, 1) as calidad_promedio
FROM \`project.dataset.app_events\`
WHERE json_data->>'entity_type' = 'DeliveryRun'
GROUP BY cliente, plantilla
ORDER BY total DESC`
  },
  tasks: {
    name: 'Tareas por Estado',
    query: `SELECT 
  DATE(created_date) as fecha,
  json_data->>'status' as estado,
  COUNT(*) as cantidad,
  COUNT(DISTINCT json_data->>'assignee_email') as asignadas_a
FROM \`project.dataset.app_events\`
WHERE json_data->>'entity_type' = 'Task'
  AND DATE(created_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY fecha, estado
ORDER BY fecha DESC, cantidad DESC`
  }
};

export default function BigQueryCustom() {
  const [customQuery, setCustomQuery] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const executeQuery = async (query) => {
    if (!query.trim()) {
      setError('Por favor, ingresa una consulta');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const response = await base44.functions.invoke('executeBigQueryCustom', {
        query_template: query
      });

      if (response.data.success) {
        setResults(response.data);
      } else {
        setError(response.data.error || 'Error executing query');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (key) => {
    setSelectedPreset(key);
    setCustomQuery(PRESET_QUERIES[key].query);
  };

  const downloadCSV = () => {
    if (!results || !results.data || results.data.length === 0) return;

    const headers = results.columns.map(c => c.name);
    const rows = results.data.map(row => 
      headers.map(h => {
        const val = row[h];
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bigquery-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1B2731] font-heading">BigQuery Personalizado</h1>
        <p className="text-[#3E4C59] mt-2">Ejecuta consultas personalizadas y analiza tus datos</p>
      </div>

      <Tabs defaultValue="custom" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="custom">Consulta Personalizada</TabsTrigger>
          <TabsTrigger value="presets">Plantillas Predefinidas</TabsTrigger>
        </TabsList>

        <TabsContent value="custom" className="space-y-4">
          <Card className="bg-white border-[#B7CAC9]/30">
            <CardHeader>
              <CardTitle className="text-[#1B2731]">Escribe tu Consulta SQL</CardTitle>
              <CardDescription>BigQuery SQL estándar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="SELECT * FROM `project.dataset.app_events` LIMIT 100"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                className="font-mono text-sm h-64 border-[#B7CAC9]/40"
              />
              <Button
                onClick={() => executeQuery(customQuery)}
                disabled={loading}
                className="gap-2 bg-[#33A19A] hover:bg-[#2A857F] w-full"
              >
                <Play className="w-4 h-4" />
                {loading ? 'Ejecutando...' : 'Ejecutar Consulta'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presets" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(PRESET_QUERIES).map(([key, preset]) => (
              <Card 
                key={key}
                className="bg-white border-[#B7CAC9]/30 cursor-pointer hover:border-[#33A19A] transition-colors"
                onClick={() => handlePresetSelect(key)}
              >
                <CardHeader>
                  <CardTitle className="text-[#1B2731]">{preset.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#3E4C59] mb-4">{preset.query.substring(0, 100)}...</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-[#33A19A] text-[#33A19A] hover:bg-[#E8F5F4]"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePresetSelect(key);
                      executeQuery(preset.query);
                    }}
                  >
                    Usar Plantilla
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-800 font-mono text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card className="bg-white border-[#B7CAC9]/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[#1B2731]">Resultados</CardTitle>
                <CardDescription>{results.total_rows} filas encontradas</CardDescription>
              </div>
              <Button
                onClick={downloadCSV}
                variant="outline"
                size="sm"
                className="gap-2 border-[#33A19A] text-[#33A19A]"
              >
                <Download className="w-4 h-4" />
                Descargar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#E8F5F4]">
                    {results.columns.map((col) => (
                      <TableHead key={col.name} className="text-[#1B2731] font-semibold">
                        {col.name}
                        <span className="text-xs text-[#B7CAC9] ml-1">({col.type})</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.data.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-[#FFFAF3]">
                      {results.columns.map((col) => (
                        <TableCell key={col.name} className="text-[#3E4C59]">
                          {row[col.name]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}