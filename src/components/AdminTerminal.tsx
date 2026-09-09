"use client";

import { useEffect, useRef, useState } from "react";

interface Line {
  id: number;
  text: string;
  kind: "output" | "error" | "success" | "dim" | "input-echo";
}
let idc = 0;
const nid = () => ++idc;

export default function AdminTerminal({ adminUsername }: { adminUsername: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const push = (text: string, kind: Line["kind"] = "output") =>
    setLines((p) => [...p, { id: nid(), text, kind }]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    push(`ADMIN SESSION — ${adminUsername.toUpperCase()}`, "success");
    push("");
    push('TYPE "HELP" FOR AVAILABLE COMMANDS.', "dim");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(cmdRaw: string) {
    const cmd = cmdRaw.trim();
    const [head, ...rest] = cmd.split(" ");
    const lower = head.toLowerCase();
    push("");

    if (lower === "help") {
      push("ADMIN COMMANDS");
      push("");
      push("USERS [query]                 List / search users");
      push("ADJUST <userId> <amt> <why>   Adjust a user's points (amt can be negative)");
      push("TASKS                         List all tasks");
      push("CREATETASK                    Create a task (interactive-free form below)");
      push("  usage: createtask \"Title\" \"Description\" reward type [url]");
      push("TOGGLETASK <taskId>           Enable/disable a task");
      push("CONFIG                        View referral reward config");
      push("SETREWARD <amount>            Set REFERRAL_REWARD");
      push("CLEAR                         Clear screen");
      return;
    }

    if (lower === "clear") {
      setLines([]);
      return;
    }

    if (lower === "users") {
      setBusy(true);
      const q = rest.join(" ");
      const res = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const data = await res.json();
      if (!res.ok) {
        push(data.error?.toUpperCase() ?? "ERROR", "error");
      } else {
        push(`${data.users.length} USER(S)`);
        push("");
        push("ID              USERNAME             POINTS    REFERRALS");
        data.users.forEach((u: any) => {
          push(
            `${u.id.slice(0, 12).padEnd(16)}${u.username.padEnd(21)}${String(u.points).padEnd(10)}${u.referrals}`
          );
        });
      }
      setBusy(false);
      return;
    }

    if (lower === "adjust") {
      const [userId, amtStr, ...reasonParts] = rest;
      const amount = parseInt(amtStr, 10);
      if (!userId || Number.isNaN(amount) || reasonParts.length === 0) {
        push("USAGE: ADJUST <userId> <amount> <reason>", "error");
        return;
      }
      setBusy(true);
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount, reason: reasonParts.join(" ") }),
      });
      const data = await res.json();
      if (!res.ok) push(data.error?.toUpperCase() ?? "ERROR", "error");
      else push(`OK. NEW BALANCE: ${data.newBalance}`, "success");
      setBusy(false);
      return;
    }

    if (lower === "tasks") {
      setBusy(true);
      const res = await fetch("/api/admin/tasks");
      const data = await res.json();
      push(`${data.tasks.length} TASK(S)`);
      push("");
      data.tasks.forEach((t: any) => {
        push(`[${t.active ? "ACTIVE " : "DISABLED"}] ${t.id.slice(0, 10)}  ${t.title}  (+${t.reward})`);
      });
      setBusy(false);
      return;
    }

    if (lower === "createtask") {
      const matches = cmd.match(/"([^"]*)"/g);
      const parts = cmd.split(" ").filter(Boolean);
      if (!matches || matches.length < 2) {
        push('USAGE: createtask "Title" "Description" reward type [url]', "error");
        return;
      }
      const title = matches[0].replace(/"/g, "");
      const description = matches[1].replace(/"/g, "");
      const afterQuotes = cmd.split(matches[1] + '"')[1]?.trim().split(" ") ?? [];
      const reward = parseInt(afterQuotes[0], 10);
      const type = afterQuotes[1] || "custom";
      const url = afterQuotes[2];
      if (!title || !description || Number.isNaN(reward)) {
        push("INVALID ARGUMENTS.", "error");
        return;
      }
      setBusy(true);
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, reward, type, url: url || undefined }),
      });
      const data = await res.json();
      if (!res.ok) push(data.error?.toUpperCase() ?? "ERROR", "error");
      else push(`TASK CREATED: ${data.id}`, "success");
      setBusy(false);
      return;
    }

    if (lower === "toggletask") {
      const taskId = rest[0];
      if (!taskId) {
        push("USAGE: TOGGLETASK <taskId>", "error");
        return;
      }
      setBusy(true);
      const listRes = await fetch("/api/admin/tasks");
      const listData = await listRes.json();
      const task = listData.tasks.find((t: any) => t.id === taskId || t.id.startsWith(taskId));
      if (!task) {
        push("TASK NOT FOUND.", "error");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/admin/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, active: !task.active }),
      });
      if (res.ok) push(`TASK ${task.active ? "DISABLED" : "ENABLED"}.`, "success");
      else push("ERROR.", "error");
      setBusy(false);
      return;
    }

    if (lower === "config") {
      setBusy(true);
      const res = await fetch("/api/admin/config");
      const data = await res.json();
      push(`REFERRAL_REWARD = ${data.REFERRAL_REWARD}`);
      setBusy(false);
      return;
    }

    if (lower === "setreward") {
      const amt = rest[0];
      if (!amt || Number.isNaN(parseInt(amt, 10))) {
        push("USAGE: SETREWARD <amount>", "error");
        return;
      }
      setBusy(true);
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "REFERRAL_REWARD", value: amt }),
      });
      if (res.ok) push(`REFERRAL_REWARD SET TO ${amt}.`, "success");
      else push("ERROR.", "error");
      setBusy(false);
      return;
    }

    push("COMMAND NOT FOUND.", "error");
    push('TYPE "HELP".', "dim");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const v = input;
    setInput("");
    push(v, "input-echo");
    await run(v);
  }

  const kindClass: Record<Line["kind"], string> = {
    output: "text-phosphor/90",
    "input-echo": "text-phosphor/60",
    error: "text-phosphor-red",
    success: "text-phosphor text-glow",
    dim: "text-phosphor/45",
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-term-bg p-3 sm:p-6">
      <div className="crt w-full max-w-5xl h-[85vh] bg-term-panel border border-phosphor-amber/25 rounded-md flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-phosphor-amber/15 text-xs text-phosphor-amber/60">
          <span className="w-2 h-2 rounded-full bg-phosphor-amber/50" />
          <span>ADMIN CONSOLE</span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto px-4 sm:px-6 py-4 text-sm leading-relaxed">
          {lines.map((l) => (
            <div key={l.id} className={`${kindClass[l.kind]} whitespace-pre`}>
              {l.kind === "input-echo" ? (
                <span>
                  <span className="text-phosphor-amber/50">{"admin> "}</span>
                  {l.text}
                </span>
              ) : (
                l.text || "\u00A0"
              )}
            </div>
          ))}
          <form onSubmit={onSubmit} className="flex items-center gap-2 mt-1">
            <span className="text-phosphor-amber/60 shrink-0">admin&gt;</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="flex-1 bg-transparent outline-none text-phosphor caret-phosphor disabled:opacity-50"
            />
            <span className="cursor-block text-phosphor-amber" />
          </form>
        </div>
      </div>
    </div>
  );
}
