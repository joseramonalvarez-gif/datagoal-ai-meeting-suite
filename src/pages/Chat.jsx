import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Hash, Paperclip, Upload } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CHANNELS = ["general", "reuniones", "tareas", "documentos", "interno"];

export default function Chat({ selectedClient, user }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [channel, setChannel] = useState("general");
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { loadProjects(); }, [selectedClient]);
  useEffect(() => { if (selectedProject) loadMessages(); }, [selectedProject, channel]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Real-time subscription
  useEffect(() => {
    if (!selectedProject) return;
    const unsubscribe = base44.entities.ChatMessage.subscribe((event) => {
      if (event.data?.project_id === selectedProject.id && event.data?.channel === channel) {
        if (event.type === "create") setMessages(prev => [...prev, event.data]);
      }
    });
    return unsubscribe;
  }, [selectedProject, channel]);

  const loadProjects = async () => {
    const p = selectedClient
      ? await base44.entities.Project.filter({ client_id: selectedClient.id })
      : await base44.entities.Project.list();
    setProjects(p);
    if (p.length > 0) setSelectedProject(p[0]);
    setLoading(false);
  };

  const loadMessages = async () => {
    setLoading(true);
    const msgs = await base44.entities.ChatMessage.filter(
      { project_id: selectedProject.id, channel },
      "created_date", 100
    );
    setMessages(msgs);
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedProject || !user) return;
    setSending(true);
    await base44.entities.ChatMessage.create({
      client_id: selectedClient?.id || selectedProject.client_id || "",
      project_id: selectedProject.id,
      channel,
      content: newMsg.trim(),
      author_email: user.email,
      author_name: user.full_name || user.email,
      mentions: [],
    });
    setNewMsg("");
    setSending(false);
    loadMessages();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-0 bg-white rounded-xl border border-[#B7CAC9]/20 overflow-hidden">
      {/* Sidebar: projects + channels */}
      <div className="w-60 flex-shrink-0 border-r border-[#B7CAC9]/20 bg-[#1B2731] text-white flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-heading font-semibold text-sm">Chat</h2>
        </div>
        {/* Projects */}
        <div className="px-3 py-2">
          <p className="text-[10px] text-[#B7CAC9] uppercase tracking-widest mb-2 font-semibold">Proyectos</p>
          {projects.map(p => (
            <button key={p.id} onClick={() => setSelectedProject(p)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors
                ${selectedProject?.id === p.id ? 'bg-[#33A19A] text-white' : 'text-[#B7CAC9] hover:bg-white/8'}`}>
              {p.name}
            </button>
          ))}
        </div>
        {/* Channels */}
        {selectedProject && (
          <div className="px-3 py-2 mt-2">
            <p className="text-[10px] text-[#B7CAC9] uppercase tracking-widest mb-2 font-semibold">Canales</p>
            {CHANNELS.map(c => (
              <button key={c} onClick={() => setChannel(c)}
                className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm mb-0.5 transition-colors
                  ${channel === c ? 'bg-white/15 text-white' : 'text-[#B7CAC9] hover:bg-white/8'}`}>
                <Hash className="w-3 h-3" /> {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#B7CAC9]/20 flex items-center gap-2">
          <Hash className="w-4 h-4 text-[#33A19A]" />
          <span className="font-heading font-semibold text-[#1B2731]">{channel}</span>
          {selectedProject && <span className="text-xs text-[#3E4C59]">— {selectedProject.name}</span>}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#B7CAC9]">
              <MessageSquare className="w-12 h-12 mb-3" />
              <p className="text-sm">Sin mensajes en #{channel}</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isOwn = msg.author_email === user?.email;
              return (
                <div key={msg.id || i} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-[#33A19A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {msg.author_name?.[0] || "?"}
                  </div>
                  <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#3E4C59]">{isOwn ? "Tú" : msg.author_name}</span>
                      <span className="text-[10px] text-[#B7CAC9]">
                        {msg.created_date ? format(new Date(msg.created_date), "HH:mm", { locale: es }) : ""}
                      </span>
                    </div>
                    <div className={`px-3 py-2 rounded-xl text-sm ${isOwn ? 'bg-[#33A19A] text-white rounded-tr-none' : 'bg-[#FFFAF3] text-[#1B2731] border border-[#B7CAC9]/20 rounded-tl-none'}`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#B7CAC9]/20">
          {!selectedProject ? (
            <p className="text-sm text-[#B7CAC9] text-center">Selecciona un proyecto para chatear</p>
          ) : (
            <div className="flex gap-2">
              <Input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Mensaje en #${channel}...`}
                className="flex-1 bg-[#FFFAF3] border-[#B7CAC9]/30"
              />
              <Button onClick={sendMessage} disabled={!newMsg.trim() || sending} className="bg-[#33A19A] hover:bg-[#2A857F] text-white px-4">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}