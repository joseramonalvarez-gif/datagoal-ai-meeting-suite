import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Lightbulb, Target, TrendingUp, Loader, AlertTriangle, CheckCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const severityColors = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const impactColors = {
  low: 'bg-slate-100 text-slate-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-green-100 text-green-800',
};

const priorityColors = {
  low: 'bg-slate-100 text-slate-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-red-100 text-red-800',
};

export default function MeetingInsightsViewer({ transcriptId, meetingId }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInsights();
  }, [transcriptId]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const result = await base44.entities.MeetingInsights.filter(
        { transcript_id: transcriptId },
        '-created_date',
        1
      );
      if (result.length > 0) {
        setInsights(result[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const analyzeTranscript = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get transcript data
      const transcript = await base44.entities.Transcript.filter({
        id: transcriptId,
      });

      if (transcript.length === 0) {
        setError('Transcripción no encontrada');
        return;
      }

      const t = transcript[0];

      // Call analysis function
      const response = await base44.functions.invoke('analyzeMeetingTranscript', {
        transcript_id: transcriptId,
        meeting_id: meetingId,
        client_id: t.client_id,
        project_id: t.project_id,
        full_text: t.full_text,
      });

      if (response.data.success) {
        setInsights(response.data.analysis);
        await loadInsights();
      } else {
        setError(response.data.error || 'Error en el análisis');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin text-[#33A19A]" />
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="text-center py-12">
        <p className="text-[#3E4C59] mb-4">No hay análisis disponible para esta transcripción</p>
        <button
          onClick={analyzeTranscript}
          className="px-4 py-2 bg-[#33A19A] text-white rounded-lg hover:bg-[#2A857F]"
        >
          Analizar transcripción
        </button>
      </div>
    );
  }

  if (insights.analysis_status === 'analyzing') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader className="w-6 h-6 animate-spin text-[#33A19A] mx-auto mb-2" />
          <p className="text-[#3E4C59]">Analizando transcripción...</p>
        </div>
      </div>
    );
  }

  if (insights.analysis_status === 'error') {
    return (
      <Card className="p-6 border-red-300 bg-red-50">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-800">Error en el análisis</h3>
            <p className="text-red-700 text-sm mt-1">{insights.error_message}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.key_metrics && (
          <>
            <Card className="p-4 border-[#B7CAC9]/30">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-[#33A19A]" />
                <div>
                  <p className="text-xs text-[#3E4C59]">Sentimiento</p>
                  <p className="font-semibold text-[#1B2731]">{insights.key_metrics.sentiment}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-[#B7CAC9]/30">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-xs text-[#3E4C59]">Decisiones</p>
                  <p className="font-semibold text-[#1B2731]">{insights.key_metrics.decision_count}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-[#B7CAC9]/30">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-[#3E4C59]">Items de acción</p>
                  <p className="font-semibold text-[#1B2731]">{insights.key_metrics.action_items_count}</p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Insights Tabs */}
      <Tabs defaultValue="risks" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="risks" className="gap-2">
            <AlertCircle className="w-4 h-4" /> Riesgos
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-2">
            <Lightbulb className="w-4 h-4" /> Oportunidades
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="gap-2">
            <Target className="w-4 h-4" /> Recomendaciones
          </TabsTrigger>
        </TabsList>

        {/* Risks */}
        <TabsContent value="risks" className="space-y-4 mt-4">
          {insights.risks && insights.risks.length > 0 ? (
            insights.risks.map((risk, idx) => (
              <Card key={idx} className="p-5 border-[#B7CAC9]/30 hover:border-[#33A19A]/50 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="font-semibold text-[#1B2731]">{risk.title}</h4>
                  <Badge className={`${severityColors[risk.severity]} flex-shrink-0`}>
                    {risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1)}
                  </Badge>
                </div>
                <p className="text-sm text-[#3E4C59] mb-3">{risk.description}</p>
                <div className="bg-[#FFFAF3] p-3 rounded border border-[#B7CAC9]/20">
                  <p className="text-xs font-semibold text-[#3E4C59] mb-1">Mitigación:</p>
                  <p className="text-sm text-[#3E4C59]">{risk.mitigation}</p>
                </div>
              </Card>
            ))
          ) : (
            <p className="text-[#3E4C59] text-center py-8">No se identificaron riesgos</p>
          )}
        </TabsContent>

        {/* Opportunities */}
        <TabsContent value="opportunities" className="space-y-4 mt-4">
          {insights.opportunities && insights.opportunities.length > 0 ? (
            insights.opportunities.map((opp, idx) => (
              <Card key={idx} className="p-5 border-[#B7CAC9]/30 hover:border-[#33A19A]/50 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="font-semibold text-[#1B2731]">{opp.title}</h4>
                  <Badge className={`${impactColors[opp.impact]} flex-shrink-0`}>
                    {opp.impact === 'low' ? 'Bajo' : opp.impact === 'medium' ? 'Medio' : 'Alto'}
                  </Badge>
                </div>
                <p className="text-sm text-[#3E4C59] mb-3">{opp.description}</p>
                <div className="bg-[#FFFAF3] p-3 rounded border border-[#B7CAC9]/20">
                  <p className="text-xs font-semibold text-[#3E4C59] mb-1">Próximos pasos:</p>
                  <p className="text-sm text-[#3E4C59]">{opp.next_steps}</p>
                </div>
              </Card>
            ))
          ) : (
            <p className="text-[#3E4C59] text-center py-8">No se identificaron oportunidades</p>
          )}
        </TabsContent>

        {/* Recommendations */}
        <TabsContent value="recommendations" className="space-y-4 mt-4">
          {insights.strategic_recommendations && insights.strategic_recommendations.length > 0 ? (
            insights.strategic_recommendations.map((rec, idx) => (
              <Card key={idx} className="p-5 border-[#B7CAC9]/30 hover:border-[#33A19A]/50 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="font-semibold text-[#1B2731]">{rec.title}</h4>
                  <Badge className={`${priorityColors[rec.priority]} flex-shrink-0`}>
                    {rec.priority === 'low' ? 'Baja' : rec.priority === 'medium' ? 'Media' : 'Alta'}
                  </Badge>
                </div>
                <p className="text-sm text-[#3E4C59] mb-3">{rec.description}</p>
                <div className="bg-[#FFFAF3] p-3 rounded border border-[#B7CAC9]/20">
                  <p className="text-xs font-semibold text-[#3E4C59] mb-1">Timeline:</p>
                  <p className="text-sm text-[#3E4C59]">{rec.timeline}</p>
                </div>
              </Card>
            ))
          ) : (
            <p className="text-[#3E4C59] text-center py-8">No hay recomendaciones disponibles</p>
          )}
        </TabsContent>
      </Tabs>

      {insights.analysis_date && (
        <p className="text-xs text-[#B7CAC9] text-center">
          Análisis realizado: {new Date(insights.analysis_date).toLocaleDateString('es-ES')}
        </p>
      )}
    </div>
  );
}