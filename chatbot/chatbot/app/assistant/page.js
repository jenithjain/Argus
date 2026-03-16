"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Footer from "@/components/Footer";
import {
  AlertTriangle,
  Bot,
  Globe,
  Loader2,
  Plus,
  Send,
  Shield,
  Sparkles,
  User,
  Users,
} from "lucide-react";

const PRIVATE_PROMPTS = [
  "What is prompt injection in simple words?",
  "Why is 'ignore previous instructions' suspicious?",
  "How do LLM apps block jailbreak prompts?",
  "Explain phishing awareness for students.",
];

const PUBLIC_PROMPTS = [
  "Show a harmless example of a suspicious jailbreak prompt.",
  "Teach the room how a PI detector assigns risk scores.",
  "Compare safe prompts and suspicious prompts.",
  "Explain why hidden prompt exfiltration is dangerous.",
];

const STARTER = {
  id: "starter-assistant",
  role: "assistant",
  content:
    "I am the ARGUS Assistant. How can I help you today?",
  timestamp: new Date(0).toISOString(),
  riskScore: 0,
  riskSeverity: "low",
  riskAction: "allow",
  category: "benign",
  matchedSignals: [],
  detectorReasons: [],
  blocked: false,
};

function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityClasses(severity) {
  if (severity === "critical") return "border-red-500/40 bg-red-500/10 text-red-300";
  if (severity === "high") return "border-orange-500/40 bg-orange-500/10 text-orange-300";
  if (severity === "medium") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function PromptChips({ prompts, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          className="rounded-full border border-border/50 bg-background/60 px-3 py-2 text-xs text-muted-foreground transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-foreground"
          onClick={() => onSelect(prompt)}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}

export default function Assistant() {
  const [mode, setMode] = useState("private");
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [privateStarter, setPrivateStarter] = useState(STARTER);
  const [privateAnalysis, setPrivateAnalysis] = useState(null);
  const [publicRoom, setPublicRoom] = useState(null);
  const [publicAnalysis, setPublicAnalysis] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const activeMessages = useMemo(() => {
    if (mode === "public") {
      return publicRoom?.messages || [];
    }

    return privateMessages.length ? privateMessages : [privateStarter];
  }, [mode, privateMessages, privateStarter, publicRoom]);

  const activeAnalysis = mode === "public" ? publicAnalysis : privateAnalysis;

  useEffect(() => {
    loadPrivate();
    loadPublic();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, sending]);

  async function loadPrivate(sessionId) {
    try {
      setLoading(true);
      const query = sessionId ? `?sessionId=${sessionId}` : "";
      const response = await fetch(`/api/chat${query}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load private chat");
      }

      setPrivateStarter(data.starterMessage || STARTER);
      setSessions(data.sessions || []);

      if (data.activeSession) {
        setActiveSessionId(data.activeSession.id);
        setPrivateMessages(data.activeSession.messages || []);
      } else {
        setActiveSessionId(null);
        setPrivateMessages([]);
      }
    } catch (loadError) {
      setError(loadError.message || "Failed to load private chat");
    } finally {
      setLoading(false);
    }
  }

  async function loadPublic() {
    try {
      const response = await fetch("/api/chat/public-room", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load shared room");
      }

      setPublicRoom(data.room);
      setCurrentUserEmail(data.currentUserEmail || "");
    } catch (loadError) {
      setError(loadError.message || "Failed to load shared room");
    }
  }

  async function handleNewSession() {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createSession: true }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create session");
      }

      setMode("private");
      setActiveSessionId(data.session.id);
      setPrivateMessages([]);
      setSessions((previous) => [data.session, ...previous.filter((session) => session.id !== data.session.id)]);
      setPrivateAnalysis(null);
      setInput("");
      textareaRef.current?.focus();
    } catch (sessionError) {
      setError(sessionError.message || "Failed to create session");
    }
  }

  async function handleSend() {
    if (!input.trim() || sending) {
      return;
    }

    const message = input.trim();
    setInput("");
    setSending(true);
    setError("");

    try {
      const endpoint = mode === "public" ? "/api/chat/public-room" : "/api/chat";
      const payload = mode === "public"
        ? { message }
        : { sessionId: activeSessionId, message };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      if (mode === "public") {
        setPublicRoom(data.room);
        setPublicAnalysis(data.analysis || null);
      } else {
        setActiveSessionId(data.session.id);
        setPrivateMessages(data.session.messages || []);
        setPrivateAnalysis(data.analysis || null);
        setSessions(data.sessions || []);
      }
    } catch (sendError) {
      setError(sendError.message || "Failed to send message");
      setInput(message);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function selectPrompt(prompt) {
    setInput(prompt);
    textareaRef.current?.focus();
  }

  return (
    <>
      <div className="min-h-screen w-full px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card className="border-border/40 bg-card/50 backdrop-blur-xl shadow-xl">
              <CardContent className="space-y-4 p-4">
                <Button className="w-full justify-start bg-emerald-500 text-white hover:bg-emerald-600" onClick={handleNewSession}>
                  <Plus className="mr-2 h-4 w-4" />
                  New chat
                </Button>
                
                <div className="space-y-2">
                  <p className="px-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Private history</p>
                  {sessions.length ? sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${activeSessionId === session.id && mode === "private"
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-border/40 bg-background/40 hover:border-emerald-500/20 hover:bg-background/60"
                      }`}
                      onClick={() => {
                        setMode("private");
                        loadPrivate(session.id);
                      }}
                    >
                      <p className="line-clamp-2 text-sm font-medium text-foreground">{session.title}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{session.messageCount} msgs</span>
                        <span>{session.suspiciousCount} flagged</span>
                      </div>
                    </button>
                  )) : (
                    <p className="rounded-2xl border border-dashed border-border/40 px-4 py-6 text-sm text-muted-foreground">
                      No private conversations yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>

          <main className="space-y-4">
            <Card className="overflow-hidden border-border/40 bg-card/55 backdrop-blur-xl shadow-2xl">
              <CardContent className="p-0">
                <div className="border-b border-border/40 px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-teal-500 text-white shadow-lg">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <h1 className="text-2xl font-semibold text-foreground">ARGUS Assistant</h1>
                          <p className="text-sm text-muted-foreground">General-purpose AI assistant</p>
                        </div>
                      </div>
                    </div>
                    <Tabs value={mode} onValueChange={setMode}>
                      <TabsList className="bg-background/70">
                        <TabsTrigger value="private" className="gap-2">
                          <Bot className="h-4 w-4" />
                          Private chat
                        </TabsTrigger>
                        <TabsTrigger value="public" className="gap-2">
                          <Globe className="h-4 w-4" />
                          Shared classroom
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                <div className="grid min-h-[720px] lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="flex min-h-0 flex-col">
                    <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
                      {loading && mode === "private" ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading conversations...
                        </div>
                      ) : activeMessages.map((message) => {
                        const isOwnPublicMessage = mode === "public" && message.role === "user" && message.authorEmail === currentUserEmail;
                        const isUser = mode === "private"
                          ? message.role === "user"
                          : isOwnPublicMessage;

                        return (
                          <div key={message.id} className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}>
                            {!isUser && (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-teal-500 text-white shadow-lg">
                                {message.role === "assistant" ? <Sparkles className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                              </div>
                            )}
                            <div className={`max-w-[88%] space-y-2 ${isUser ? "items-end" : "items-start"}`}>
                              {mode === "public" && (
                                <p className={`px-1 text-xs ${isUser ? "text-right" : "text-left"} text-muted-foreground`}>
                                  {message.role === "assistant" ? message.authorName : `${message.authorName}${message.authorEmail ? ` • ${message.authorEmail}` : ""}`}
                                </p>
                              )}
                              <div className={`rounded-[28px] border px-4 py-3 shadow-sm ${isUser
                                ? "border-emerald-500/30 bg-emerald-500 text-white"
                                : "border-border/40 bg-background/70 text-foreground"
                              }`}>
                                <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                              </div>
                              <div className={`flex flex-wrap gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                                <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
                              </div>
                            </div>
                            {isUser && (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground shadow-sm">
                                <User className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {sending && (
                        <div className="flex gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-teal-500 text-white shadow-lg">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div className="rounded-[28px] border border-border/40 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Thinking...
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border/40 bg-background/60 px-4 py-4 sm:px-6">
                      <div className="space-y-3 rounded-[28px] border border-border/50 bg-background/80 p-3 shadow-sm">
                        <Textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(event) => setInput(event.target.value)}
                          onKeyDown={onKeyDown}
                          rows={3}
                          placeholder={mode === "public"
                            ? "Ask in the shared room. Everyone can see the chat."
                            : "Message ARGUS Assistant..."
                          }
                          className="min-h-[96px] resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <PromptChips prompts={mode === "public" ? PUBLIC_PROMPTS : PRIVATE_PROMPTS} onSelect={selectPrompt} />
                          <Button onClick={handleSend} disabled={sending || !input.trim()} className="rounded-full bg-emerald-500 px-5 text-white hover:bg-emerald-600">
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
                    </div>
                  </div>

                  <div className="border-t border-border/40 bg-background/35 p-4 lg:border-l lg:border-t-0">
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-border/40 bg-background/50 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          {mode === "public" ? <Users className="h-4 w-4 text-cyan-400" /> : <Shield className="h-4 w-4 text-emerald-400" />}
                          {mode === "public" ? "Shared classroom mode" : "Private monitoring mode"}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {mode === "public"
                            ? "All signed-in users can see the same room. Every user prompt is still logged separately for prompt-injection analysis."
                            : "Your private chat history is stored and scored. This is the safest place to demonstrate first-party PI monitoring."
                          }
                        </p>
                        {mode === "public" && publicRoom && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                              {publicRoom.participantCount} participants
                            </Badge>
                            <span>{publicRoom.title}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
      <Footer />
    </>
  );
}
