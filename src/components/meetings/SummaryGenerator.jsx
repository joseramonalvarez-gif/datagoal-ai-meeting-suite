import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Copy, Download, Zap } from "lucide-react";
import { toast } from "sonner";

const MASTER_PROMPT = `Actúa como un consultor senior de Nevada & Amurai. Tienes ante ti una transcripción completa de una reunión. Analízala y construye un informe profesional, exhaustivo y accionable siguiendo la estructura proporcionada.

ESTRUCTURA DEL INFORME:
1. INFORMACIÓN GENERAL
2. OBJETIVO Y CONTEXTO DE LA SESIÓN
3. TEMAS PRINCIPALES ABORDADOS
4. ANÁLISIS DE LOS ELEMENTOS CLAVE
5. ACUERDOS Y DECISIONES TOMADAS
6. ACCIONES COMPROMETIDAS Y PROPIETARIOS
7. ELEMENTOS ABIERTOS O PENDIENTES
8. PROPUESTA DE PRÓXIMOS PASOS
9. OBSERVACIONES DEL CONSULTOR`;

export default function SummaryGenerator({ meeting, transcript }) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(null);
  const [summaries, setSummaries] = useState({
    short: null,
    medium: null,
    detailed: null,
    keypoints: null,
  });
  const [loading, setLoading] = useState(false);

  if (!transcript?.full_text) return null;

  const generateSummary = async (type) => {
    setGenerating(type);
    try {
      let prompt = "";
      let schema = {};

      if (type === "short") {
        prompt = `${MASTER_PROMPT}

TRANSCRIPCIÓN:
${transcript.full_text}

Genera un RESUMEN EJECUTIVO muy conciso (máx 150 palabras). Incluye solo:
- Objetivo principal
- 3 decisiones clave
- 3 acciones inmediatas

Tono: ejecutivo, directo, accionable.`;
        schema = {
          type: "object",
          properties: {
            summary: { type: "string" },
          },
        };
      } else if (type === "medium") {
        prompt = `${MASTER_PROMPT}

TRANSCRIPCIÓN:
${transcript.full_text}

Genera un RESUMEN MEDIO (300-400 palabras) con:
- Contexto y objetivo
- Temas principales (5-7)
- Decisiones tomadas
- Acciones comprometidas
- Próximos pasos

Tono: profesional, estratégico.`;
        schema = {
          type: "object",
          properties: {
            summary: { type: "string" },
          },
        };
      } else if (type === "detailed") {
        prompt = `${MASTER_PROMPT}

TRANSCRIPCIÓN:
${transcript.full_text}

Genera el INFORME COMPLETO siguiendo todas las 9 secciones de la estructura maestro. Sé exhaustivo, analítico y accionable. Este informe se entregará al cliente.`;
        schema = {
          type: "object",
          properties: {
            summary: { type: "string" },
          },
        };
      } else if (type === "keypoints") {
        prompt = `Analiza esta transcripción y extrae TODOS los puntos clave, decisiones, acciones y elementos abiertos.

TRANSCRIPCIÓN:
${transcript.full_text}

Devuelve un JSON con:
- key_decisions: array de decisiones principales
- key_actions: array de acciones con responsable
- key_topics: array de temas tratados
- open_items: array de elementos pendientes
- main_risks: array de riesgos identificados`;
        schema = {
          type: "object",
          properties: {
            key_decisions: {
              type: "array",
              items: { type: "string" },
            },
            key_actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  owner: { type: "string" },
                },
              },
            },
            key_topics: {
              type: "array",
              items: { type: "string" },
            },
            open_items: {
              type: "array",
              items: { type: "string" },
            },
            main_risks: {
              type: "array",
              items: { type: "string" },
            },
          },
        };
      }

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema,
      });

      setSummaries({ ...summaries, [type]: result });
      toast.success(`✅ ${type === "keypoints" ? "Puntos clave" : "Resumen"} generado`);
    } catch (error) {
      toast.error(`Error generando resumen: ${error.message}`);
    } finally {
      setGenerating(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  const downloadAsText = (text, filename) => {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(text)
    );
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        className="gap-2 text-xs"
        title="Generar resúmenes y puntos clave con IA"
      >
        <Zap className="w-4 h-4" /> Resumir
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" /> Generador de Resúmenes
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="short">
            <TabsList className="bg-[#F8FAFB] grid w-full grid-cols-4 border border-[#B7CAC9]/20 h-8">
              <TabsTrigger value="short" className="text-xs h-7 data-[state=active]:bg-white">
                Corto
              </TabsTrigger>
              <TabsTrigger value="medium" className="text-xs h-7 data-[state=active]:bg-white">
                Mediano
              </TabsTrigger>
              <TabsTrigger value="detailed" className="text-xs h-7 data-[state=active]:bg-white">
                Detallado
              </TabsTrigger>
              <TabsTrigger value="keypoints" className="text-xs h-7 data-[state=active]:bg-white">
                Puntos clave
              </TabsTrigger>
            </TabsList>

            <TabsContent value="short" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#3E4C59]">Resumen ejecutivo (≈150 palabras)</p>
                {summaries.short && (
                  <Badge className="bg-green-100 text-green-800 border-0">Generado</Badge>
                )}
              </div>
              {!summaries.short ? (
                <Button
                  onClick={() => generateSummary("short")}
                  disabled={generating !== null}
                  className="w-full bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2"
                >
                  {generating === "short" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generando…
                    </>
                  ) : (
                    "Generar resumen corto"
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-[#F8FAFB] rounded-lg border border-[#B7CAC9]/20 text-sm leading-relaxed text-[#1B2731]">
                    {summaries.short.summary}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => copyToClipboard(summaries.short.summary)}
                    >
                      <Copy className="w-3 h-3" /> Copiar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => downloadAsText(summaries.short.summary, "resumen-corto.txt")}
                    >
                      <Download className="w-3 h-3" /> Descargar
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="medium" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#3E4C59]">Resumen mediano (300-400 palabras)</p>
                {summaries.medium && (
                  <Badge className="bg-green-100 text-green-800 border-0">Generado</Badge>
                )}
              </div>
              {!summaries.medium ? (
                <Button
                  onClick={() => generateSummary("medium")}
                  disabled={generating !== null}
                  className="w-full bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2"
                >
                  {generating === "medium" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generando…
                    </>
                  ) : (
                    "Generar resumen mediano"
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-[#F8FAFB] rounded-lg border border-[#B7CAC9]/20 text-sm leading-relaxed text-[#1B2731] max-h-96 overflow-y-auto">
                    {summaries.medium.summary}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => copyToClipboard(summaries.medium.summary)}
                    >
                      <Copy className="w-3 h-3" /> Copiar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => downloadAsText(summaries.medium.summary, "resumen-mediano.txt")}
                    >
                      <Download className="w-3 h-3" /> Descargar
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="detailed" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#3E4C59]">Informe completo y profesional</p>
                {summaries.detailed && (
                  <Badge className="bg-green-100 text-green-800 border-0">Generado</Badge>
                )}
              </div>
              {!summaries.detailed ? (
                <Button
                  onClick={() => generateSummary("detailed")}
                  disabled={generating !== null}
                  className="w-full bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2"
                >
                  {generating === "detailed" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generando…
                    </>
                  ) : (
                    "Generar informe detallado"
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-[#F8FAFB] rounded-lg border border-[#B7CAC9]/20 text-sm leading-relaxed text-[#1B2731] max-h-96 overflow-y-auto whitespace-pre-wrap">
                    {summaries.detailed.summary}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => copyToClipboard(summaries.detailed.summary)}
                    >
                      <Copy className="w-3 h-3" /> Copiar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => downloadAsText(summaries.detailed.summary, "informe-completo.txt")}
                    >
                      <Download className="w-3 h-3" /> Descargar
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="keypoints" className="mt-4 space-y-3">
              <p className="text-sm text-[#3E4C59]">Puntos clave, decisiones y acciones</p>
              {!summaries.keypoints ? (
                <Button
                  onClick={() => generateSummary("keypoints")}
                  disabled={generating !== null}
                  className="w-full bg-[#33A19A] hover:bg-[#2A857F] text-white gap-2"
                >
                  {generating === "keypoints" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Extrayendo…
                    </>
                  ) : (
                    "Extraer puntos clave"
                  )}
                </Button>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {summaries.keypoints.key_decisions?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[#1B2731] mb-2 text-sm">🎯 Decisiones Clave</h4>
                      <ul className="space-y-1">
                        {summaries.keypoints.key_decisions.map((d, i) => (
                          <li key={i} className="text-sm text-[#3E4C59] flex gap-2">
                            <span className="text-[#33A19A]">•</span> {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summaries.keypoints.key_actions?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[#1B2731] mb-2 text-sm">✅ Acciones Comprometidas</h4>
                      <ul className="space-y-1">
                        {summaries.keypoints.key_actions.map((a, i) => (
                          <li key={i} className="text-sm text-[#3E4C59] flex gap-2">
                            <span className="text-[#33A19A]">→</span>
                            <span>
                              {a.action} <span className="text-[#B7CAC9]">({a.owner})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summaries.keypoints.key_topics?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[#1B2731] mb-2 text-sm">📋 Temas Tratados</h4>
                      <div className="flex flex-wrap gap-2">
                        {summaries.keypoints.key_topics.map((t, i) => (
                          <Badge key={i} className="bg-[#E8F5F4] text-[#33A19A] border-0">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {summaries.keypoints.open_items?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[#1B2731] mb-2 text-sm">🔓 Elementos Abiertos</h4>
                      <ul className="space-y-1">
                        {summaries.keypoints.open_items.map((o, i) => (
                          <li key={i} className="text-sm text-[#3E4C59] flex gap-2">
                            <span className="text-orange-500">⏳</span> {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summaries.keypoints.main_risks?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[#1B2731] mb-2 text-sm">⚠️ Riesgos Identificados</h4>
                      <ul className="space-y-1">
                        {summaries.keypoints.main_risks.map((r, i) => (
                          <li key={i} className="text-sm text-[#3E4C59] flex gap-2">
                            <span className="text-red-500">⚡</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}