"use client";

import {
  Bot,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { useLang } from "@/components/providers";
import { fetchWithTimeout } from "@/lib/api";
import { loadChatbotIndex } from "@/lib/utils";
import type { ChatResponse, ChatbotChunk } from "@/types";

interface Msg {
  role: "user" | "bot";
  text: string;
  sources?: ChatbotChunk[];
  fallback?: boolean;
}

const SUGGESTIONS: Record<"en" | "hi", string[]> = {
  en: ["What is NPK?", "Crops for sandy soil", "How to manage weeds?"],
  hi: ["NPK क्या है?", "रेतीली मिट्टी की फसलें", "खरपतवार कैसे प्रबंधित करें?"],
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Offline keyword search over cached chunks. */
function localSearch(query: string, chunks: ChatbotChunk[]): ChatbotChunk[] {
  const qTokens = tokenize(query);
  const scored = chunks
    .filter((c) => qTokens.some((t) => c.text.toLowerCase().includes(t)))
    .map((c) => {
      const text = c.text.toLowerCase();
      const hits = qTokens.reduce((sum, t) => sum + (text.includes(t) ? 1 : 0), 0);
      const title = c.section.toLowerCase();
      const titleBonus = qTokens.reduce((sum, t) => sum + (title.includes(t) ? 2 : 0), 0);
      return { c, score: hits * 3 + titleBonus };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.map((s) => s.c);
}

export default function Chatbot() {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<ChatbotChunk[]>([]);

  useEffect(() => {
    loadChatbotIndex().then((idx) => (indexRef.current = idx));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function handleSend(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: message }]);
    setBusy(true);

    let existing = sessionId;
    try {
      const res = await fetchWithTimeout<ChatResponse>(
        "/api/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            language: lang,
            session_id: existing ?? "",
          }),
        },
        60000
      );
      existing = res.session_id ?? existing;
      setSessionId(existing);
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: res.reply,
          fallback: res.fallback,
          sources: res.sources as unknown as ChatbotChunk[],
        },
      ]);
    } catch (err) {
      // Offline/slow path → local keyword-search fallback on cached chunks.
      setOffline(true);
      const cause = (err as Error & { timedOut?: boolean; status?: number }).timedOut
        ? "timeout"
        : (err as { status?: number }).status === 504
          ? "timeout"
          : err instanceof Error && /timeouts?/i.test(err.message)
            ? "timeout"
            : "offline";
      const hits = localSearch(message, indexRef.current);
      if (hits.length > 0) {
        setMessages((m) => [
          ...m,
          {
            role: "bot",
            fallback: true,
            text:
              cause === "timeout"
                ? lang === "hi"
                  ? "सहायक को जवाब देने में समय लग रहा है — नीचे निकटतम नोट्स हैं।"
                  : "The assistant is taking longer than usual — here are the closest notes."
                : lang === "hi"
                  ? "सहायक सेवा अभी उपलब्ध नहीं है — नीचे कैश्ड नोट्स हैं।"
                  : "The assistant service is unreachable right now — showing the closest cached notes.",
            sources: hits,
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "bot",
            fallback: true,
            text:
              cause === "timeout"
                ? lang === "hi"
                  ? "सहायक को जवाब देने में समय लगा, और इस प्रश्न के लिए कोई कैश्ड नोट भी नहीं मिला। थोड़ी देर में फिर से पूछें।"
                  : "The assistant took too long, and no cached note matches this question. Please retry in a moment."
                : lang === "hi"
                  ? "इस प्रश्न के लिए कोई कैश्ड नोट नहीं मिला, और सहायक सेवा अभी उपलब्ध नहीं है। कुछ मिनट बाद फिर से पूछें।"
                  : "No cached note matches this question and the assistant service is unreachable right now. Please retry in a few minutes.",
          },
        ]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chatbot" : "Open chatbot"}
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-xl shadow-emerald-900/40 transition hover:scale-105"
      >
        {open ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* panel */}
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-emerald-800/20 bg-white shadow-2xl dark:border-emerald-400/15 dark:bg-[#0d140c]">
          {/* header */}
          <div className="flex items-center gap-3 border-b border-emerald-800/10 bg-gradient-to-r from-emerald-600 to-green-700 px-4 py-3 dark:border-emerald-400/10">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
              <Bot size={18} />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{t("chatbot_title")}</p>
              <p className="text-xs text-emerald-100/80">{t("chatbot_subtitle")}</p>
            </div>
            <Sparkles size={18} className="text-emerald-100" />
          </div>

          {/* messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm leading-relaxed text-emerald-950/70 dark:text-emerald-100/70">
                  {lang === "hi"
                    ? "नमस्ते! मैं मित्रा हूं — आपका कृषि सहायक। फसल, मिट्टी, कीट, बीमारियों के बारे में पूछें।"
                    : "Hi! I'm Mitra — your agriculture assistant. Ask me about crops, soil, pests and diseases."}
                </p>
                {SUGGESTIONS[lang].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSend(s)}
                    className="block rounded-lg border border-emerald-700/25 bg-emerald-50 px-3 py-1.5 text-left text-xs text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "rounded-br-sm bg-emerald-600 text-white"
                      : "rounded-bl-sm bg-emerald-100/70 text-emerald-950 dark:bg-emerald-500/15 dark:text-emerald-50"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                  {m.fallback && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      ⚠ {lang === "hi" ? "अस्थायी उत्तर" : "fallback response"}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-emerald-100/70 px-3 py-2 text-sm text-emerald-950/60 dark:bg-emerald-500/15 dark:text-emerald-50/60">
                  <Loader2 size={14} className="animate-spin" />
                  {lang === "hi" ? "सोच रहा हूं…" : "Thinking…"}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {offline && (
            <p className="px-4 pb-1 text-[11px] text-amber-600 dark:text-amber-400">
              {t("chatbot_offline")}
            </p>
          )}

          {/* input */}
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-emerald-800/10 p-3 dark:border-emerald-400/10"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("chatbot_input")}
              className="flex-1 rounded-lg border border-emerald-800/20 bg-emerald-50/50 px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-950/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-emerald-400/20 dark:bg-emerald-500/5 dark:text-emerald-50 dark:placeholder:text-emerald-100/40"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:opacity-40"
              aria-label={t("chatbot_send")}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}