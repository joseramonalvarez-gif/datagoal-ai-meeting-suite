import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Play, RefreshCw, CheckCircle2, XCircle, Loader2, Clock,
  Zap, AlertTriangle, BarChart2, Info
} from "lucide-react";
import AutomationCard from "@/components/automation/AutomationCard";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

export default function AutomationDashboard({ user }) {
  const queryClient = useQueryClient();
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [runningManual, setRunningManual] = useState(false);
  const [manualResult, setManualResult] = useState(null);

  const { data: automations = [], isLoading, refetch } = useQuery({
    queryKey: ["automationRuns"],
    queryFn: () => base44.entities.AutomationRun.list("-created_date", 50),
    refetchInterval: 10000
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings-for-automation"],
    queryFn: () => base44.entities.Meeting.list("-created_date", 30)
  });

  const handleManualRun = async () => {
    if (!selectedMeetingId) return;
    setRunningManual(true);
    setManualResult(null);
    try {
      const res = await base44.functions.invoke("orchestrateMeetingDelivery", {
        meeting_id: selectedMeetingId
      });
      setManualResult({ success: true, data: res.data });
      queryClient.invalidateQueries({ queryKey: ["automationRuns"] });
    } catch (err) {
      setManualResult({ success: false, error: err.message });
    } finally {
      setRunningManual(false);
    }
  };

  const handleTestPMO = async () => {
    try {
      await base44.functions.invoke("pmoAgentMonitor", {});
      queryClient.invalidateQueries({ queryKey: ["automationRuns"] });
    } catch (err) {
      console.error(err);
    }
  };

  // Estadísticas
  const stats = {
    total: automations.length,
    success: automations.filter(a => a.status === "success").length,
    failed: automations.filter(a => a.status === "failed").length,
    running: automations.filter(a => a.status === "running").length
  };
  const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;

  const liveAutomations = automations.filter(a => a.status === "running");
  const historyAutomations = automations.filter(a => a.status !== "running");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[#1B2731]">Automation Hub</h1>
          <p className="text-sm text-[#3E4C59] mt-1">
            Monitor y control de automatizaciones post-reunión
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2 border-[#B7CAC9]/40"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, icon: BarChart2, color: "text-[#1B2731]" },
          { label: "Exitosas", value: stats.success, icon: CheckCircle2, color: "text-green-600" },
          { label: "Fallidas", value: stats.failed, icon: XCircle, color: "text-red-600" },
          { label: "Tasa éxito", value: `${successRate}%`, icon: Zap, color: "text-[#33A19A]" }
        ].map((s) => (
          <Card key={s.label} className="border-[#B7CAC9]/30">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-heading font-bold text-[#1B2731]">{s.value}</p>
                <p className="text-xs text-[#3E4C59]">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Manual trigger */}
      <Card className="border-[#33A19A]/40 bg-[#E8F5F4]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading font-semibold text-[#1B2731] flex items-center gap-2">
            <Play className="w-4 h-4 text-[#33A19A]" />
            Generar informe manualmente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Select value={selectedMeetingId} onValueChange={setSelectedMeetingId}>
              <SelectTrigger className="flex-1 bg-white border-[#B7CAC9]/40">
                <SelectValue placeholder="Seleccionar reunión..." />
              </SelectTrigger>
              <SelectContent>
                {meetings.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title} {m.date ? `(${new Date(m.date).toLocaleDateString('es-ES')})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleManualRun}
              disabled={!selectedMeetingId || runningManual}
              className="bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2"
            >
              {runningManual
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                : <><Play className="w-4 h-4" /> Ejecutar</>}
            </Button>
          </div>

          {manualResult && (
            <div className={`rounded-lg p-3 text-sm ${manualResult.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
              {manualResult.success ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  ✅ Automatización completada. Drive: {manualResult.data?.drive_url
                    ? <a href={manualResult.data.drive_url} target="_blank" rel="noreferrer" className="underline ml-1">Ver archivo</a>
                    : "sin archivo"
                  }
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Error: {manualResult.error}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <div className="h-px flex-1 bg-[#B7CAC9]/30" />
            <span className="text-xs text-[#3E4C59]">otras acciones</span>
            <div className="h-px flex-1 bg-[#B7CAC9]/30" />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTestPMO}
            className="border-[#B7CAC9]/40 text-[#3E4C59] gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            Ejecutar PMO Monitor ahora
          </Button>
        </CardContent>
      </Card>

      {/* Automations list */}
      <Tabs defaultValue="all">
        <TabsList className="bg-[#1B2731]/5">
          <TabsTrigger value="all">
            Todas ({automations.length})
          </TabsTrigger>
          <TabsTrigger value="live">
            En vivo {liveAutomations.length > 0 && <Badge className="ml-1 bg-blue-500 text-white text-[10px] px-1.5">{liveAutomations.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="failed">
            Fallidas {stats.failed > 0 && <Badge className="ml-1 bg-red-500 text-white text-[10px] px-1.5">{stats.failed}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#33A19A]" />
            </div>
          ) : automations.length === 0 ? (
            <div className="text-center py-12 text-[#3E4C59]">
              <Info className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Sin automatizaciones aún</p>
              <p className="text-sm">Ejecuta manualmente una reunión para empezar</p>
            </div>
          ) : (
            automations.map(a => <AutomationCard key={a.id} automation={a} />)
          )}
        </TabsContent>

        <TabsContent value="live" className="mt-4 space-y-3">
          {liveAutomations.length === 0 ? (
            <p className="text-center py-8 text-sm text-[#3E4C59]">No hay automatizaciones en curso</p>
          ) : (
            liveAutomations.map(a => <AutomationCard key={a.id} automation={a} />)
          )}
        </TabsContent>

        <TabsContent value="failed" className="mt-4 space-y-3">
          {automations.filter(a => a.status === "failed").length === 0 ? (
            <p className="text-center py-8 text-sm text-[#3E4C59]">Sin fallos registrados ✅</p>
          ) : (
            automations.filter(a => a.status === "failed").map(a => <AutomationCard key={a.id} automation={a} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}