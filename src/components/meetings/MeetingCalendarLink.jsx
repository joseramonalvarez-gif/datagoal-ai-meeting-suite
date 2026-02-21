import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarPlus, ExternalLink, Copy, Check } from "lucide-react";
import { format } from "date-fns";

function buildGoogleCalendarUrl(meeting, participants) {
  const base = "https://www.google.com/calendar/render?action=TEMPLATE";
  const title = encodeURIComponent(meeting.title || "Reunión");
  const startDate = meeting.date ? new Date(meeting.date) : new Date();
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1h default
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dates = `${fmt(startDate)}/${fmt(endDate)}`;
  const details = encodeURIComponent(
    [meeting.objective && `Objetivo: ${meeting.objective}`, meeting.notes && `Notas: ${meeting.notes}`]
      .filter(Boolean).join("\n") || "Reunión agendada desde DATA GOAL"
  );
  const guests = (participants || []).map(p => p.email).filter(Boolean).join(",");

  return `${base}&text=${title}&dates=${dates}&details=${details}${guests ? `&add=${encodeURIComponent(guests)}` : ""}`;
}

export default function MeetingCalendarLink({ meeting }) {
  const [copied, setCopied] = useState(false);

  const gcalUrl = buildGoogleCalendarUrl(meeting, meeting.participants);

  const copyLink = () => {
    navigator.clipboard.writeText(gcalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <a href={gcalUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs border-[#33A19A]/30 text-[#33A19A] hover:bg-[#E8F5F4]">
          <CalendarPlus className="w-3.5 h-3.5" />
          Añadir a Google Calendar
          <ExternalLink className="w-3 h-3" />
        </Button>
      </a>
      <Button variant="ghost" size="sm" onClick={copyLink} className="gap-1.5 text-xs text-[#3E4C59]">
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "¡Copiado!" : "Copiar link"}
      </Button>
    </div>
  );
}