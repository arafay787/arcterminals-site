"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const PROJECT_NAME = process.env.NEXT_PUBLIC_PROJECT_NAME ?? "ARC TERMINALS";

type LineKind = "output" | "input-echo" | "error" | "success" | "dim" | "prompt";
interface Line {
  id: number;
  text: string;
  kind: LineKind;
}

type Stage =
  | "booting"
  | "welcome"
  | "auth_menu"
  | "reg_username"
  | "reg_email"
  | "reg_password"
  | "reg_confirm"
  | "reg_submit"
  | "login_username"
  | "login_password"
  | "login_submit"
  | "main"
  | "view_tasks"
  | "view_leaderboard"
  | "view_share";

interface Me {
  userId: string;
  username: string;
  points: number;
  referrals: number;
  rank: number;
  referralCode: string;
  referralLink: string;
}

interface ReferralContext {
  username: string;
  points: number;
  referrals: number;
}

let idCounter = 0;
const nextId = () => ++idCounter;

export default function Terminal({
  referralContext,
  referralCode,
}: {
  referralContext?: ReferralContext | null;
  referralCode?: string;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [stage, setStage] = useState<Stage>("booting");
  const [input, setInput] = useState("");
  const [inputMasked, setInputMasked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [regDraft, setRegDraft] = useState({ username: "", email: "", password: "" });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bootedRef = useRef(false);

  const push = useCallback((text: string, kind: LineKind = "output") => {
    setLines((prev) => [...prev, { id: nextId(), text, kind }]);
  }, []);

  const pushMany = useCallback(
    (arr: string[], kind: LineKind = "output", delayMs = 90) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const step = () => {
          if (i >= arr.length) return resolve();
          push(arr[i], kind);
          i++;
          setTimeout(step, delayMs);
        };
        step();
      }),
    [push]
  );

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    if (stage !== "main" && stage !== "booting") inputRef.current?.focus();
  }, [stage, busy]);

  // ---- BOOT SEQUENCE -------------------------------------------------
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    (async () => {
      // Set referral attribution cookie server-side BEFORE registration can
      // happen, so it survives the whole multi-step boot -> auth flow even
      // if the tab is closed and reopened before signing up.
      if (referralCode) {
        await fetch("/api/referral/attribute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: referralCode }),
        }).catch(() => null);
      }

      await pushMany(
        [
          "SYSTEM POWER ON",
          "MEMORY TEST.................. OK",
          "DISPLAY INITIALIZED.......... OK",
          "NETWORK INTERFACE............ ONLINE",
          "SECURITY MODULE.............. READY",
          "DATABASE CONNECTION.......... ESTABLISHED",
          "TERMINAL CORE................ LOADED",
        ],
        "dim",
        110
      );
      await sleep(200);
      push("", "output");
      await pushMany([`${PROJECT_NAME} SYSTEM v1.0`, "COPYRIGHT 1989\u20132026"], "output", 140);
      await sleep(150);
      push("", "output");
      push("INITIALIZING USER ENVIRONMENT...", "dim");
      await sleep(500);

      // Check for existing session
      const res = await fetch("/api/me").catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        setMe(data);
        push("", "output");
        push("CONNECTION ESTABLISHED.", "success");
        push("", "output");
        push(`WELCOME BACK, ${data.username.toUpperCase()}.`, "success");
        await sleep(200);
        push("", "output");
        printProfileSummary(data);
        setStage("main");
        return;
      }

      push("", "output");
      push("CONNECTION ESTABLISHED.", "success");
      push("", "output");

      if (referralContext) {
        push("INCOMING CONNECTION...", "output");
        await sleep(300);
        push("", "output");
        push("REFERRAL NODE DETECTED.", "success");
        push("", "output");
        push(`SOURCE USER:`);
        push(`@${referralContext.username}`, "success");
        push("", "output");
        push(`USER POINTS:`);
        push(`${referralContext.points.toLocaleString()}`, "success");
        push("", "output");
        push(`REFERRAL STATUS:`);
        push(`ACTIVE`, "success");
        push("", "output");
        push("CONNECTION ACCEPTED.", "success");
        push("", "output");
        push("NEW USER REGISTRATION REQUIRED.", "output");
        push("", "output");
        push(`WELCOME TO ${PROJECT_NAME}`, "success");
        push("", "output");
        push('TYPE "JOIN" TO INITIALIZE ACCOUNT, OR "LOGIN" IF YOU ALREADY HAVE ONE.', "dim");
      } else {
        push(`WELCOME TO ${PROJECT_NAME}`, "success");
        push("", "output");
        push('TYPE "REGISTER" TO CREATE AN ACCOUNT, OR "LOGIN" IF YOU ALREADY HAVE ONE.', "dim");
      }

      setStage("auth_menu");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function printProfileSummary(data: Me) {
    push("\u250c" + "\u2500".repeat(46) + "\u2510", "dim");
    push(`TERMINAL://USER/PROFILE`);
    push("\u2514" + "\u2500".repeat(46) + "\u2518", "dim");
    push("");
    push(`USER............. ${data.username}`);
    push(`STATUS............ ACTIVE`, "success");
    push(`POINTS............ ${data.points.toLocaleString()}`);
    push(`REFERRALS......... ${data.referrals}`);
    push(`RANK.............. #${data.rank > 0 ? String(data.rank).padStart(3, "0") : "---"}`);
    push("");
    push(`REFERRAL NODE:`);
    push(`${data.referralLink}`, "success");
    push("");
    push("COMMANDS: HELP · PROFILE · REFERRAL · POINTS · TASKS · LEADERBOARD · SHARE · CLEAR · LOGOUT");
  }

  // ---- INPUT SUBMIT HANDLER ------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const value = input.trim();
    setInput("");

    if (stage !== "booting") {
      push(inputMasked ? "*".repeat(value.length || 1) : value || " ", "input-echo");
    }

    switch (stage) {
      case "auth_menu": {
        const cmd = value.toLowerCase();
        if (cmd === "register" || cmd === "join" || cmd === "y") {
          push("");
          push("TERMINAL://IDENTITY_SETUP");
          push("");
          push("NEW USER DETECTED.");
          push("");
          push("ENTER USERNAME:");
          setStage("reg_username");
        } else if (cmd === "login") {
          push("");
          push("TERMINAL://AUTH");
          push("");
          push("EXISTING USER DETECTED.");
          push("");
          push("ENTER USERNAME:");
          setStage("login_username");
        } else if (cmd === "help") {
          push("");
          push('COMMANDS AVAILABLE HERE: REGISTER · LOGIN · HELP');
        } else {
          push("COMMAND NOT FOUND.", "error");
          push('TYPE "REGISTER" OR "LOGIN".', "dim");
        }
        break;
      }

      case "reg_username": {
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
          push("INVALID USERNAME. 3-20 CHARACTERS, LETTERS/NUMBERS/UNDERSCORE ONLY.", "error");
          push("ENTER USERNAME:");
          break;
        }
        setRegDraft((d) => ({ ...d, username: value }));
        push("");
        push("ENTER EMAIL:");
        setStage("reg_email");
        break;
      }

      case "reg_email": {
        if (!/^\S+@\S+\.\S+$/.test(value)) {
          push("INVALID EMAIL FORMAT.", "error");
          push("ENTER EMAIL:");
          break;
        }
        setRegDraft((d) => ({ ...d, email: value }));
        push("");
        push("CREATE PASSWORD:");
        setInputMasked(true);
        setStage("reg_password");
        break;
      }

      case "reg_password": {
        if (value.length < 8) {
          push("PASSWORD TOO SHORT. MINIMUM 8 CHARACTERS.", "error");
          push("CREATE PASSWORD:");
          break;
        }
        setRegDraft((d) => ({ ...d, password: value }));
        push("");
        push("CONFIRM PASSWORD:");
        setStage("reg_confirm");
        break;
      }

      case "reg_confirm": {
        setInputMasked(false);
        if (value !== regDraft.password) {
          push("PASSWORDS DO NOT MATCH.", "error");
          push("CREATE PASSWORD:");
          setInputMasked(true);
          setStage("reg_password");
          break;
        }
        setStage("reg_submit");
        setBusy(true);
        push("");
        push("VERIFYING CREDENTIALS...", "dim");
        await sleep(500);
        try {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(regDraft),
          });
          const data = await res.json();
          if (!res.ok) {
            push(data.error?.toUpperCase() ?? "REGISTRATION FAILED.", "error");
            push("");
            push("ENTER USERNAME:");
            setStage("reg_username");
            setBusy(false);
            break;
          }
          push("ACCOUNT CREATED.", "success");
          push("");
          push("GENERATING USER IDENTIFIER...", "dim");
          await sleep(400);
          push("COMPLETE.", "success");
          push("");
          push("GENERATING REFERRAL NODE...", "dim");
          await sleep(400);
          push("COMPLETE.", "success");
          push("");
          push("\u2588".repeat(29), "success");
          push("ACCOUNT INITIALIZATION COMPLETE", "success");
          push("\u2588".repeat(29), "success");
          push("");
          push(`USER ID: ${data.userId.slice(0, 8).toUpperCase()}`);
          push(`STATUS: ACTIVE`, "success");
          push(`POINTS: 0`);
          push(`REFERRALS: 0`);
          push("");
          push("PERSONAL REFERRAL NODE CREATED.", "success");
          push("");
          push("YOUR REFERRAL LINK:");
          push(data.referralLink, "success");
          push("");
          push('TYPE "CONTINUE" TO ENTER YOUR TERMINAL.', "dim");
          setStage("reg_submit"); // stays here until they type CONTINUE
          setBusy(false);
        } catch {
          push("CONNECTION ERROR. REMOTE DATABASE UNAVAILABLE.", "error");
          push("RETRYING NOT AVAILABLE IN DEMO MODE. TYPE REGISTER TO TRY AGAIN.", "dim");
          setStage("auth_menu");
          setBusy(false);
        }
        break;
      }

      case "reg_submit": {
        if (value.toLowerCase() === "continue") {
          const res = await fetch("/api/me");
          if (res.ok) {
            const data = await res.json();
            setMe(data);
            push("");
            printProfileSummary(data);
            setStage("main");
          }
        } else {
          push('TYPE "CONTINUE" TO PROCEED.', "dim");
        }
        break;
      }

      case "login_username": {
        setRegDraft((d) => ({ ...d, username: value }));
        push("");
        push("ENTER PASSWORD:");
        setInputMasked(true);
        setStage("login_password");
        break;
      }

      case "login_password": {
        setInputMasked(false);
        setBusy(true);
        push("");
        push("AUTHENTICATING...", "dim");
        await sleep(400);
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: regDraft.username, password: value }),
          });
          if (!res.ok) {
            push("ERROR: INVALID CREDENTIALS.", "error");
            push("");
            push("AUTHENTICATION FAILED.", "error");
            push("");
            push("ENTER USERNAME:");
            setStage("login_username");
            setBusy(false);
            break;
          }
          push("VERIFYING USER...", "dim");
          await sleep(300);
          push("COMPLETE.", "success");
          const meRes = await fetch("/api/me");
          const data = await meRes.json();
          setMe(data);
          push("");
          push(`WELCOME BACK, ${data.username.toUpperCase()}.`, "success");
          push("");
          printProfileSummary(data);
          setStage("main");
        } catch {
          push("CONNECTION ERROR.", "error");
          setStage("auth_menu");
        }
        setBusy(false);
        break;
      }

      case "main":
      case "view_tasks":
      case "view_leaderboard":
      case "view_share": {
        await handleCommand(value.toLowerCase());
        break;
      }

      default:
        break;
    }
  }

  async function refreshMe(): Promise<Me | null> {
    const res = await fetch("/api/me");
    if (!res.ok) return null;
    const data = await res.json();
    setMe(data);
    return data;
  }

  async function handleCommand(cmdRaw: string) {
    const cmd = cmdRaw.trim();
    push("");

    if (cmd === "help" || cmd === "7") {
      push("AVAILABLE COMMANDS");
      push("");
      push("PROFILE       View account information");
      push("REFERRAL      View referral link");
      push("POINTS        View points");
      push("TASKS         View available tasks");
      push("LEADERBOARD   View ranking");
      push("SHARE         Generate X share card");
      push("STATUS        View system status");
      push("CLEAR         Clear terminal");
      push("LOGOUT        End session");
      return;
    }

    if (cmd === "profile" || cmd === "1") {
      const data = (await refreshMe()) ?? me;
      if (data) printProfileSummary(data);
      return;
    }

    if (cmd === "referral" || cmd === "2") {
      const data = (await refreshMe()) ?? me;
      if (!data) return;
      push(`REFERRALS......... ${data.referrals}`);
      push("");
      push("REFERRAL NODE:");
      push(data.referralLink, "success");
      return;
    }

    if (cmd === "points" || cmd === "3") {
      const data = (await refreshMe()) ?? me;
      if (!data) return;
      push(`TOTAL POINTS: ${data.points.toLocaleString()}`, "success");
      return;
    }

    if (cmd === "tasks" || cmd === "4") {
      setBusy(true);
      push("TERMINAL://TASKS");
      push("");
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (!data.tasks?.length) {
        push("NO TASKS AVAILABLE.", "dim");
      } else {
        push("AVAILABLE TASKS");
        push("");
        data.tasks.forEach((t: any, i: number) => {
          push(`[${String(i + 1).padStart(2, "0")}] ${t.title}`);
          push(`REWARD: +${t.reward} POINTS`);
          push(`STATUS: ${t.status}`, t.status === "COMPLETE" ? "success" : "dim");
          push("");
        });
        push('TYPE "COMPLETE <NUMBER>" TO CLAIM A TASK, e.g. COMPLETE 1', "dim");
      }
      setStage("view_tasks");
      setBusy(false);
      return;
    }

    if (cmd.startsWith("complete ")) {
      const idx = parseInt(cmd.replace("complete ", "").trim(), 10);
      setBusy(true);
      const res = await fetch("/api/tasks");
      const data = await res.json();
      const task = data.tasks?.[idx - 1];
      if (!task) {
        push("TASK NOT FOUND.", "error");
        setBusy(false);
        return;
      }
      push("VERIFYING TASK...", "dim");
      await sleep(400);
      const completeRes = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        push(
          completeData.error === "already_completed" ? "TASK ALREADY CLAIMED." : "TASK VERIFICATION FAILED.",
          "error"
        );
      } else {
        push("TASK VERIFIED.", "success");
        push("");
        push(`+${completeData.reward} POINTS`, "success");
        const fresh = await refreshMe();
        if (fresh) push(`TOTAL POINTS: ${fresh.points.toLocaleString()}`);
      }
      setBusy(false);
      return;
    }

    if (cmd === "leaderboard" || cmd === "5") {
      setBusy(true);
      push("TERMINAL://LEADERBOARD");
      push("");
      push("RANK   USER                  POINTS      REFERRALS");
      const res = await fetch("/api/leaderboard");
      const data = await res.json();
      data.leaderboard.forEach((row: any, i: number) => {
        const rank = `#${String(i + 1).padStart(3, "0")}`;
        const uname = row.username.padEnd(20, " ").slice(0, 20);
        const pts = String(row.points.toLocaleString()).padStart(8, " ");
        const refs = String(row.referrals).padStart(9, " ");
        push(`${rank}  ${uname}  ${pts}   ${refs}`, me && row.username === me.username ? "success" : "output");
      });
      push("");
      push("SYSTEM STATUS: LIVE", "dim");
      setStage("view_leaderboard");
      setBusy(false);
      return;
    }

    if (cmd === "share" || cmd === "6") {
      const data = (await refreshMe()) ?? me;
      if (!data) return;
      push("\u250c" + "\u2500".repeat(35));
      push(`${PROJECT_NAME}`);
      push("");
      push(`USER: @${data.username}`);
      push(`STATUS: ACTIVE`, "success");
      push(`POINTS: ${data.points.toLocaleString()}`);
      push(`REFERRALS: ${data.referrals}`);
      push(`RANK: #${data.rank > 0 ? String(data.rank).padStart(3, "0") : "---"}`);
      push("");
      push("JOIN THE NETWORK");
      push(data.referralLink, "success");
      push("\u2514" + "\u2500".repeat(35));
      push("");
      push("SHARE CARD READY. POST YOUR REFERRAL LINK ON X \u2014");
      push("THE CARD ABOVE RENDERS AUTOMATICALLY AS YOUR LINK PREVIEW.", "dim");
      setStage("view_share");
      return;
    }

    if (cmd === "status") {
      push("SYSTEM STATUS: LIVE", "success");
      push(`SESSION: ACTIVE`);
      push(`SERVER TIME: ${new Date().toISOString()}`);
      return;
    }

    if (cmd === "clear") {
      setLines([]);
      return;
    }

    if (cmd === "logout" || cmd === "8" || cmd === "exit") {
      await fetch("/api/auth/logout", { method: "POST" });
      setMe(null);
      push("SESSION TERMINATED.", "dim");
      push("");
      await sleep(300);
      window.location.reload();
      return;
    }

    push("COMMAND NOT FOUND.", "error");
    push('TYPE "HELP" FOR AVAILABLE COMMANDS.', "dim");
  }

  const kindClass: Record<LineKind, string> = {
    output: "text-phosphor/90",
    "input-echo": "text-phosphor/60",
    error: "text-phosphor-red",
    success: "text-phosphor text-glow",
    dim: "text-phosphor/45",
    prompt: "text-phosphor",
  };

  const promptLabel =
    stage === "reg_password" || stage === "reg_confirm" || stage === "login_password"
      ? ""
      : me
      ? `${me.username}@arcterm:~$`
      : "guest@arcterm:~$";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-term-bg p-3 sm:p-6">
      <div className="crt w-full max-w-4xl h-[85vh] sm:h-[80vh] bg-term-panel border border-phosphor/25 rounded-md shadow-[0_0_60px_rgba(57,255,106,0.08)] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-phosphor/15 text-xs text-phosphor/50">
          <span className="w-2 h-2 rounded-full bg-phosphor/40" />
          <span>{PROJECT_NAME} TERMINAL v1.0</span>
        </div>

        <div
          ref={scrollRef}
          className="term-scrollback flex-1 overflow-y-auto overflow-x-auto px-4 sm:px-6 py-4 text-sm sm:text-[15px] leading-relaxed"
        >
          {lines.map((l) => (
            <div key={l.id} className={`${kindClass[l.kind]} whitespace-pre`}>
              {l.kind === "input-echo" ? (
                <span>
                  <span className="text-phosphor/40">{"> "}</span>
                  {l.text}
                </span>
              ) : (
                l.text || "\u00A0"
              )}
            </div>
          ))}

          {stage !== "booting" && (
            <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
              {promptLabel && <span className="text-phosphor/60 shrink-0">{promptLabel}</span>}
              <input
                ref={inputRef}
                type={inputMasked ? "password" : "text"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className="flex-1 bg-transparent outline-none text-phosphor caret-phosphor disabled:opacity-50"
              />
              <span className="cursor-block text-phosphor" />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
