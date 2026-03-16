"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Footer from "@/components/Footer";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Ban,
  Bot,
  Globe,
  Loader2,
  Shield,
  Siren,
  UserRound,
} from "lucide-react";

function severityClasses(severity) {
  if (severity === "critical") return "border-red-500/40 bg-red-500/10 text-red-300";
  if (severity === "high") return "border-orange-500/40 bg-orange-500/10 text-orange-300";
  if (severity === "medium") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/security/summary", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load security summary");
        }

        setSummary(data);
      } catch (loadError) {
        setError(loadError.message || "Failed to load security summary");
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, []);

  const statCards = useMemo(() => {
    if (!summary) return [];
    return [
        { label: "Total Requests Scored", value: summary.totals.total, icon: Bot },
        { label: "Blocked Requests", value: summary.totals.blocked, icon: Ban },
        { label: "Warned Requests", value: summary.totals.warned, icon: AlertTriangle },
        { label: "Critical Severity Events", value: summary.totals.critical, icon: Siren },
    ];
  }, [summary]);

  return (
    <div className="min-h-screen w-full px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mt-3 text-4xl font-bold text-foreground ivy-font">Prompt Injection Monitoring Dashboard</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground ivy-font">
              Professional monitoring view of suspicious prompts, enforcement actions, and attribution details across the chatbot platform.
            </p>
          </div>
        </div>

        {loading ? (
          <Card className="border-border/40 bg-card/50 backdrop-blur-xl shadow-xl">
            <CardContent className="flex items-center gap-3 p-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading prompt-injection summary...
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-red-500/30 bg-red-500/10 backdrop-blur-xl shadow-xl">
            <CardContent className="p-8 text-red-300">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <Card key={card.label} className="border-border/40 bg-card/50 backdrop-blur-xl shadow-xl">
                  <CardContent className="flex items-center justify-between p-6">
                    <div>
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <p className="mt-2 text-3xl font-semibold text-foreground">{card.value}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-400">
                      <card.icon className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border/40 bg-card/50 backdrop-blur-xl shadow-xl">
                <CardHeader>
                  <CardTitle className="ivy-font">Seven-Day Detection Trend</CardTitle>
                  <CardDescription className="ivy-font">Blocked and warned attempts over the last seven days.</CardDescription>
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(15, 23, 42, 0.95)",
                          border: "1px solid rgba(148, 163, 184, 0.2)",
                          borderRadius: "16px",
                        }}
                      />
                      <Bar dataKey="blocked" fill="#f97316" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="warned" fill="#fbbf24" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/40 bg-card/50 backdrop-blur-xl shadow-xl">
                <CardHeader>
                  <CardTitle className="ivy-font">Detector Hotspots</CardTitle>
                  <CardDescription className="ivy-font">Most frequent categories and matched signals.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Top Categories</p>
                    <div className="mt-3 space-y-3">
                      {summary.topCategories.map((item) => (
                        <div key={item.label} className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/40 px-4 py-3">
                          <span className="text-sm text-foreground">{item.label.replace(/_/g, " ")}</span>
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{item.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Top Signals</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {summary.topSignals.map((item) => (
                        <Badge key={item.label} variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-300">
                          {item.label.replace(/_/g, " ")} · {item.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Top Suspicious IPs</p>
                    <div className="mt-3 space-y-3">
                      {summary.topIps?.length ? summary.topIps.map((item) => (
                        <div key={item.label} className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/40 px-4 py-3">
                          <span className="text-sm text-foreground font-mono">{item.label}</span>
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{item.count}</Badge>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground">No suspicious IP activity in this sample window.</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6">
              <Card className="border-border/40 bg-card/50 backdrop-blur-xl shadow-xl">
                <CardHeader>
                  <CardTitle className="ivy-font">Recent Security Incidents</CardTitle>
                  <CardDescription className="ivy-font">Recent flagged user prompts with risk scoring, network attribution, and detector reasoning.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {summary.recentEvents.map((event) => (
                    <div key={event.id} className="rounded-3xl border border-border/40 bg-background/40 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={severityClasses(event.severity)}>{event.severity}</Badge>
                            <Badge variant="outline" className="border-border/40">score {event.riskScore}</Badge>
                            <Badge variant="outline" className="border-border/40">{event.action}</Badge>
                            <Badge variant="outline" className="border-border/40">{(event.category || "unknown").replace(/_/g, " ")}</Badge>
                            <Badge variant="outline" className="border-border/40">{event.source || "private-chat"}</Badge>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{event.messageText}</p>
                        </div>
                        <div className="min-w-[180px] space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2"><UserRound className="h-4 w-4" />{event.ownerName}</div>
                          <p>{event.ownerEmail}</p>
                          <div className="flex items-center gap-2"><Globe className="h-4 w-4" /><span className="font-mono">{event.clientIp || "unknown"}</span></div>
                          {event.forwardedFor ? <p className="font-mono text-[11px] break-all">xff: {event.forwardedFor}</p> : null}
                          {event.userAgent ? <p className="text-[11px] break-all">ua: {event.userAgent}</p> : null}
                          <p>{formatDateTime(event.createdAt)}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {event.matchedSignals.map((signal) => (
                          <Badge key={signal} variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-300">
                            {signal.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                        {event.detectorReasons.map((reason) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
