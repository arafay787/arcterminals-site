"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const PROJECT_NAME = process.env.NEXT_PUBLIC_PROJECT_NAME ?? "ARC TERMINALS";

type LineKind = "output" | "input-echo" | "error" | "success" | "dim" | "prompt" | "widget";
interface Line {
  id: number;
  text: string;
  kind: LineKind;
  node?: React.ReactNode;
}

type Stage =
  | "booting"
  | "welcome"
  | "auth_menu"
  | "reg_username"
  | "reg_email"
  | "reg_email_code"
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
  twitterUsername?: string | null;
}

interface ReferralContext {
  username: string;
  referrals: number;
}

const MENU_ITEMS: { key: string; label: string; cmd: string }[] = [
  { key: "profile", label: "PROFILE", cmd: "profile" },
  { key: "referral", label: "REFERRAL", cmd: "referral" },
  { key: "points", label: "POINTS", cmd: "points" },
  { key: "tasks", label: "TASKS", cmd: "tasks" },
  { key: "leaderboard", label: "LEADERBOARD", cmd: "leaderboard" },
  { key: "share", label: "SHARE", cmd: "share" },
  { key: "help", label: "HELP", cmd: "help" },
  { key: "clear", label: "CLEAR", cmd: "clear" },
  { key: "logout", label: "LOGOUT", cmd: "logout" },
];

let idCounter = 0;
const nextId = () => ++idCounter;

const URL_REGEX = /(https?:\/\/[^\s)]+)/g;

/** Turns any http(s) URL inside a line's text into a real clickable link,
 *  opened in a new tab, while leaving the rest of the line as plain text. */
function linkify(text: string, keyPrefix: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  const regex = new RegExp(URL_REGEX);
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const url = match[0];
    nodes.push(
      <a
        key={`${keyPrefix}-${i++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-dotted hover:text-phosphor-amber"
      >
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// ---------------------------------------------------------------------------
// TASKS PANEL — real buttons, proof inputs, live green "DONE" state
// ---------------------------------------------------------------------------

interface TaskRow {
  id: string;
  title: string;
  description: string;
  reward: number;
  url: string | null;
  requiresProof: boolean;
  proofLabel: string | null;
  status: "PENDING" | "COMPLETE";
  proof: string | null;
}

function TasksPanel({ onPointsChange }: { onPointsChange: () => Promise<Me | null> }) {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [proofDrafts, setProofDrafts] = useState<Record<string, string>>({});
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (!res.ok) return;
    const data = await res.json();
    setTasks(data.tasks ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function complete(task: TaskRow) {
    setErrors((e) => ({ ...e, [task.id]: "" }));
    const proof = proofDrafts[task.id]?.trim();
    if (task.requiresProof && !proof) {
      setErrors((e) => ({ ...e, [task.id]: `${task.proofLabel ?? "Proof"} is required.` }));
      return;
    }
    setCompletingId(task.id);
    try {
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, proof }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({
          ...e,
          [task.id]: data.error === "already_completed" ? "Already completed." : "Could not complete — try again.",
        }));
      } else {
        await load();
        await onPointsChange();
      }
    } finally {
      setCompletingId(null);
    }
  }

  if (tasks === null) {
    return <div className="text-phosphor/50 text-sm">Loading tasks...</div>;
  }
  if (tasks.length === 0) {
    return <div className="text-phosphor/50 text-sm">No tasks available.</div>;
  }

  return (
    <div className="flex flex-col gap-3 my-1 max-w-xl">
      {tasks.map((t, i) => {
        const done = t.status === "COMPLETE";
        return (
          <div
            key={t.id}
            className={`border rounded-md p-3 transition-colors ${
              done ? "border-phosphor bg-phosphor/10" : "border-phosphor/25 bg-black/20"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-sm">
                  [{String(i + 1).padStart(2, "0")}] {t.title}
                  {t.url && (
                    <>
                      {" \u2014 "}
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-dotted hover:text-phosphor-amber"
                      >
                        CLICK
                      </a>
                    </>
                  )}
                </div>
                <div className="text-phosphor/50 text-xs mt-1">{t.description}</div>
                <div className="text-phosphor/60 text-xs mt-1">REWARD: +{t.reward} POINTS</div>
              </div>
              {done ? (
                <span className="shrink-0 px-3 py-1 rounded bg-phosphor text-term-bg text-xs font-bold">
                  DONE
                </span>
              ) : (
                <button
                  onClick={() => complete(t)}
                  disabled={completingId === t.id}
                  className="shrink-0 px-3 py-1 rounded border border-phosphor/40 text-xs font-bold hover:border-phosphor hover:bg-phosphor/10 disabled:opacity-50 transition-colors"
                >
                  {completingId === t.id ? "..." : "DONE"}
                </button>
              )}
            </div>

            {t.requiresProof && !done && (
              <input
                value={proofDrafts[t.id] ?? ""}
                onChange={(e) => setProofDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                placeholder={t.proofLabel ?? "Proof"}
                className="mt-2 w-full bg-term-bg border border-phosphor/25 rounded px-2 py-1.5 text-xs outline-none focus:border-phosphor text-phosphor placeholder:text-phosphor/30"
              />
            )}
            {t.requiresProof && done && t.proof && (
              <div className="text-phosphor/40 text-xs mt-1.5 truncate">Submitted: {t.proof}</div>
            )}
            {errors[t.id] && <div className="text-phosphor-red text-xs mt-1.5">{errors[t.id]}</div>}
          </div>
        );
      })}
    </div>
  );
}

function PriorityAccessBanner({ me }: { me: Me }) {
  return (
    <div className="border border-phosphor-amber/50 rounded-md p-3 my-1 max-w-xl bg-phosphor-amber/5">
      <div className="font-bold text-sm text-phosphor-amber">&#9888; PRIORITY ACCESS</div>
      <div className="text-xs mt-1">
        TOP 500 MEMBERS BY POINTS GET PRIORITY ACCESS WHEN MAINNET LAUNCHES.
      </div>
      <div className="text-xs mt-1.5">
        YOUR RANK: <span className="text-phosphor-amber font-bold">#{me.rank > 0 ? String(me.rank).padStart(3, "0") : "---"}</span>
        {" \u2014 complete tasks below to climb."}
      </div>
    </div>
  );
}

function ReferralInfoBlock({ me }: { me: Me }) {
  const [rate, setRate] = useState<string>("10");
  useEffect(() => {
    fetch("/api/config/referral-reward")
      .then((r) => r.json())
      .then((d) => setRate(d.value ?? "10"))
      .catch(() => {});
  }, []);

  return (
    <div className="border border-phosphor-blue/40 rounded-md p-3 my-1 max-w-xl bg-phosphor-blue/5">
      <div className="font-bold text-sm text-phosphor-blue">REFERRAL PROGRAM</div>
      <div className="text-xs mt-1">
        +{rate} POINTS for every valid referral {"\u2014"} automatic, no task to claim.
      </div>
      <div className="text-xs mt-1.5">
        Your referrals so far: <span className="text-phosphor font-bold">{me.referrals}</span>
      </div>
      <div className="text-xs mt-1 truncate">
        Your link:{" "}
        <a
          href={me.referralLink}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted hover:text-phosphor-amber"
        >
          {me.referralLink}
        </a>
      </div>
    </div>
  );
}

function ShareWidget({ me }: { me: Me }) {
  const shareText = `Just logged into the ${PROJECT_NAME} network \u2014 booting up early, earning points, and climbing the leaderboard ahead of mainnet. Join in and start stacking your own:`;
  // X aggressively caches link-card previews per exact URL, so a link that
  // was ever tested/pasted before (even without a working image at the
  // time) can get stuck showing no card. Appending a changing query param
  // makes every share a "new" URL to X's crawler, forcing a fresh fetch of
  // the OG image every time - the /r/[code] route ignores query params, so
  // referral attribution still works identically.
  const cacheBustedLink = `${me.referralLink}?v=${Date.now()}`;
  const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(
    cacheBustedLink
  )}`;
  const cardText = `+${"-".repeat(35)}
${PROJECT_NAME}

USER: @${me.username}
STATUS: ACTIVE
POINTS: ${me.points.toLocaleString()}
REFERRALS: ${me.referrals}
RANK: #${me.rank > 0 ? String(me.rank).padStart(3, "0") : "---"}

JOIN THE NETWORK
${me.referralLink}
+${"-".repeat(35)}`;

  return (
    <div className="my-1 max-w-xl">
      <pre className="border border-phosphor/30 rounded-md p-4 bg-black/30 whitespace-pre-wrap text-xs sm:text-sm font-mono">
        {cardText}
      </pre>
      <a
        href={intentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-3 px-4 py-2 rounded border border-phosphor text-phosphor text-sm font-bold hover:bg-phosphor hover:text-term-bg transition-colors"
      >
        SHARE ON X &rarr;
      </a>
      <div className="text-phosphor/40 text-xs mt-2">
        Opens X with your card pre-written {"\u2014"} just click Post there.
      </div>
    </div>
  );
}

interface LeaderboardRow {
  username: string;
  points: number;
  referrals: number;
}

function LeaderboardWidget({ me }: { me: Me | null }) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => setRows(d.leaderboard ?? []))
      .catch(() => setRows([]));
  }, []);

  if (rows === null) return <div className="text-phosphor/50 text-sm">Loading leaderboard...</div>;

  const VISIBLE = 30;
  const visible = rows.slice(0, VISIBLE);
  const myIndex = me ? rows.findIndex((r) => r.username === me.username) : -1;
  const myShownAlready = myIndex > -1 && myIndex < VISIBLE;

  const Row = ({ row, idx }: { row: LeaderboardRow; idx: number }) => {
    const isMe = !!me && row.username === me.username;
    return (
      <div
        className={`flex items-center gap-2 py-0.5 ${
          isMe ? "text-phosphor font-bold bg-phosphor/10 rounded px-1 -mx-1" : "text-phosphor/80"
        }`}
      >
        <span className="w-3">{isMe ? <span className="inline-block w-2 h-2 rounded-full bg-phosphor-amber" /> : ""}</span>
        <span className="w-14 shrink-0">#{String(idx + 1).padStart(3, "0")}</span>
        <span className="flex-1 truncate">{row.username}</span>
        <span className="w-16 text-right shrink-0">{row.points.toLocaleString()}</span>
        <span className="w-10 text-right shrink-0 text-phosphor/50">{row.referrals}</span>
      </div>
    );
  };

  return (
    <div className="my-1 max-w-xl font-mono text-xs sm:text-sm">
      <div className="flex items-center gap-2 text-phosphor/40 mb-1">
        <span className="w-3" />
        <span className="w-14 shrink-0">RANK</span>
        <span className="flex-1">USER</span>
        <span className="w-16 text-right shrink-0">POINTS</span>
        <span className="w-10 text-right shrink-0">REFS</span>
      </div>
      {visible.map((row, i) => (
        <Row key={row.username} row={row} idx={i} />
      ))}
      {!myShownAlready && myIndex > -1 && (
        <>
          <div className="text-phosphor/30 py-0.5">&#8942;</div>
          <Row row={rows[myIndex]} idx={myIndex} />
        </>
      )}
      {!myShownAlready && myIndex === -1 && me && (
        <div className="text-phosphor/40 mt-2">
          You're outside the top {rows.length} {"\u2014"} keep earning points to appear here.
        </div>
      )}
      <div className="text-phosphor-amber inline-block mt-2 text-[10px]">
        &#9679; = your position
      </div>
    </div>
  );
}

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
  const [regDraft, setRegDraft] = useState({ username: "", email: "", password: "", verifyToken: "" });
  const [menuIndex, setMenuIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bootedRef = useRef(false);

  const push = useCallback((text: string, kind: LineKind = "output") => {
    setLines((prev) => [...prev, { id: nextId(), text, kind }]);
  }, []);

  const pushWidget = useCallback((node: React.ReactNode) => {
    setLines((prev) => [...prev, { id: nextId(), text: "", kind: "widget", node }]);
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
    if (data.twitterUsername) push(`X.................. @${data.twitterUsername}`);
    push("");
    push(`REFERRAL NODE:`);
    push(`${data.referralLink}`, "success");
    push("");
    push('USE THE MENU BELOW (\u2191\u2193 + ENTER, OR CLICK/TAP) TO NAVIGATE.', "dim");
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
          push('COMMANDS AVAILABLE HERE: REGISTER \u00b7 LOGIN \u00b7 HELP');
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
        setBusy(true);
        push("");
        push("SENDING VERIFICATION CODE...", "dim");
        try {
          const res = await fetch("/api/auth/send-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: value }),
          });
          const data = await res.json();
          if (!res.ok) {
            push(data.error?.toUpperCase() ?? "COULD NOT SEND CODE.", "error");
            push("");
            push("ENTER EMAIL:");
            setBusy(false);
            break;
          }
          push(`CODE SENT TO ${value}.`, "success");
          push("");
          push("ENTER VERIFICATION CODE (OR TYPE \"RESEND\"):");
          setStage("reg_email_code");
        } catch {
          push("CONNECTION ERROR. COULD NOT SEND CODE.", "error");
          push("ENTER EMAIL:");
        }
        setBusy(false);
        break;
      }

      case "reg_email_code": {
        if (value.toLowerCase() === "resend") {
          setBusy(true);
          push("");
          push("RESENDING CODE...", "dim");
          const res = await fetch("/api/auth/send-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: regDraft.email }),
          });
          const data = await res.json();
          if (res.ok) {
            push("NEW CODE SENT.", "success");
          } else {
            push(data.error?.toUpperCase() ?? "COULD NOT RESEND.", "error");
          }
          push("ENTER VERIFICATION CODE (OR TYPE \"RESEND\"):");
          setBusy(false);
          break;
        }
        if (!/^\d{6}$/.test(value)) {
          push("INVALID CODE. ENTER THE 6-DIGIT CODE FROM YOUR EMAIL.", "error");
          push("ENTER VERIFICATION CODE (OR TYPE \"RESEND\"):");
          break;
        }
        setBusy(true);
        push("");
        push("VERIFYING CODE...", "dim");
        try {
          const res = await fetch("/api/auth/verify-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: regDraft.email, code: value }),
          });
          const data = await res.json();
          if (!res.ok) {
            push(data.error?.toUpperCase() ?? "VERIFICATION FAILED.", "error");
            push("ENTER VERIFICATION CODE (OR TYPE \"RESEND\"):");
            setBusy(false);
            break;
          }
          setRegDraft((d) => ({ ...d, verifyToken: data.verifyToken }));
          push("EMAIL VERIFIED.", "success");
          push("");
          push("CREATE PASSWORD:");
          setInputMasked(true);
          setStage("reg_password");
        } catch {
          push("CONNECTION ERROR.", "error");
          push("ENTER VERIFICATION CODE (OR TYPE \"RESEND\"):");
        }
        setBusy(false);
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
          setStage("reg_submit");
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

    if (cmd === "help") {
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
      push("");
      push("Or use the menu below \u2014 \u2191\u2193 to move, ENTER to select, or click/tap.", "dim");
      return;
    }

    if (cmd === "profile") {
      const data = (await refreshMe()) ?? me;
      if (data) printProfileSummary(data);
      return;
    }

    if (cmd === "referral") {
      const data = (await refreshMe()) ?? me;
      if (!data) return;
      pushWidget(<ReferralInfoBlock key={`ref-${Date.now()}`} me={data} />);
      return;
    }

    if (cmd === "points") {
      const data = (await refreshMe()) ?? me;
      if (!data) return;
      push(`TOTAL POINTS: ${data.points.toLocaleString()}`, "success");
      return;
    }

    if (cmd === "tasks") {
      setBusy(true);
      push("TERMINAL://TASKS");
      push("");
      const data = (await refreshMe()) ?? me;
      if (data) pushWidget(<PriorityAccessBanner key={`prio-${Date.now()}`} me={data} />);
      if (data) pushWidget(<ReferralInfoBlock key={`ref-${Date.now()}`} me={data} />);
      push("AVAILABLE TASKS");
      pushWidget(<TasksPanel key={`tasks-${Date.now()}`} onPointsChange={refreshMe} />);
      setStage("view_tasks");
      setBusy(false);
      return;
    }

    if (cmd === "leaderboard") {
      setBusy(true);
      push("TERMINAL://LEADERBOARD");
      push("");
      pushWidget(<LeaderboardWidget key={`lb-${Date.now()}`} me={me} />);
      push("");
      push("SYSTEM STATUS: LIVE", "dim");
      setStage("view_leaderboard");
      setBusy(false);
      return;
    }

    if (cmd === "share") {
      const data = (await refreshMe()) ?? me;
      if (!data) return;
      push("TERMINAL://SHARE");
      push("");
      pushWidget(<ShareWidget key={`share-${Date.now()}`} me={data} />);
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

    if (cmd === "logout") {
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

  const menuVisible = stage === "main" || stage.startsWith("view_");

  async function runMenuItem(cmd: string) {
    if (busy) return;
    push(cmd, "input-echo");
    await handleCommand(cmd);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!menuVisible || input.length > 0 || busy) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMenuIndex((i) => (i + 1) % MENU_ITEMS.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMenuIndex((i) => (i - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      runMenuItem(MENU_ITEMS[menuIndex].cmd);
    }
  }

  const kindClass: Record<LineKind, string> = {
    output: "text-phosphor/90",
    "input-echo": "text-phosphor/60",
    error: "text-phosphor-red",
    success: "text-phosphor text-glow",
    dim: "text-phosphor/45",
    prompt: "text-phosphor",
    widget: "",
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
        <div className="flex items-center gap-2 px-4 py-2 border-b border-phosphor/15 text-xs text-phosphor/50 shrink-0">
          <span className="w-2 h-2 rounded-full bg-phosphor/40" />
          <span>{PROJECT_NAME} TERMINAL v1.0</span>
        </div>

        {menuVisible && (
          <div className="shrink-0 border-b border-phosphor/15 px-4 sm:px-6 py-2 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
            {MENU_ITEMS.map((item, i) => (
              <button
                key={item.key}
                onClick={() => runMenuItem(item.cmd)}
                onMouseEnter={() => setMenuIndex(i)}
                className={`text-left px-2 py-1 rounded text-xs sm:text-sm transition-colors ${
                  i === menuIndex
                    ? "bg-phosphor/15 text-phosphor border border-phosphor/40"
                    : "text-phosphor/50 border border-transparent hover:text-phosphor/80"
                }`}
              >
                {i === menuIndex ? "\u203a " : "  "}
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div
          ref={scrollRef}
          className="term-scrollback flex-1 overflow-y-auto overflow-x-auto px-4 sm:px-6 py-4 text-sm sm:text-[15px] leading-relaxed"
        >
          {lines.map((l) =>
            l.kind === "widget" ? (
              <div key={l.id}>{l.node}</div>
            ) : (
              <div key={l.id} className={`${kindClass[l.kind]} whitespace-pre`}>
                {l.kind === "input-echo" ? (
                  <span>
                    <span className="text-phosphor/40">{"> "}</span>
                    {l.text}
                  </span>
                ) : (
                  linkify(l.text || "\u00A0", `line-${l.id}`)
                )}
              </div>
            )
          )}

          {stage !== "booting" && (
            <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
              {promptLabel && <span className="text-phosphor/60 shrink-0">{promptLabel}</span>}
              <input
                ref={inputRef}
                type={inputMasked ? "password" : "text"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
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
