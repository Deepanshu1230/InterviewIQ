import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { AgentSession, AgentMicrophone, AgentPlayer } from "@deepgram/agents";
import { Button } from "../components/ui/button";
import { BACKEND_URL } from "../lib/config";

const MAX_SECONDS = 300; // 5 minute limit
const N = 28; // number of bars
const GAIN = 5; // raise this if bars barely move, lower it if they are always full

type Mode = "idle" | "listening" | "you" | "thinking" | "speaking";

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

export default function Interview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [starting, setStarting] = useState(false);
  const [live, setLive] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [mode, setMode] = useState<Mode>("idle");

  const stopRef = useRef<() => void>(() => {});
  const cleanupRef = useRef<() => void>(() => {});
  const intervalRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);
  const endedRef = useRef(false);

  // voice objects used by the animation
  const micRef = useRef<AgentMicrophone | null>(null);
  const playerRef = useRef<AgentPlayer | null>(null);
  const thinkingRef = useRef(false);
  const modeRef = useRef<Mode>("idle");
  const lastAgentRef = useRef(0);
  const lastUserRef = useRef(0);

  // elements the animation moves
  const aBars = useRef<(HTMLSpanElement | null)[]>([]);
  const uBars = useRef<(HTMLSpanElement | null)[]>([]);
  const mouthRef = useRef<SVGEllipseElement>(null);
  const charRef = useRef<HTMLDivElement>(null);
  const ring1 = useRef<HTMLDivElement>(null);
  const ring2 = useRef<HTMLDivElement>(null);

  // leaving the page turns off the mic and the connection
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
      cleanupRef.current();
    };
  }, []);

  // the animation loop: runs only while the interview is live
  useEffect(() => {
    function reset() {
      aBars.current.forEach((el) => el && (el.style.height = "6px"));
      uBars.current.forEach((el) => el && (el.style.height = "6px"));
      mouthRef.current?.setAttribute("ry", "3");
      if (charRef.current) charRef.current.style.transform = "";
      if (ring1.current) ring1.current.style.transform = "";
      if (ring2.current) ring2.current.style.transform = "";
    }

    if (!live) {
      reset();
      modeRef.current = "idle";
      setMode("idle");
      return;
    }

    modeRef.current = "listening";
    setMode("listening");
    let raf = 0;

    const loop = () => {
      const now = performance.now();
      const a = Math.min(1, (playerRef.current?.getOutputVolume() ?? 0) * GAIN);
      const u = Math.min(1, (micRef.current?.getInputVolume() ?? 0) * GAIN);

      if (a > 0.05) lastAgentRef.current = now;
      if (u > 0.08) lastUserRef.current = now;

      // sound bars (taller in the middle, with a little wobble)
      for (let i = 0; i < N; i++) {
        const env = 0.45 + 0.55 * Math.sin((i / (N - 1)) * Math.PI);
        const wob = 0.55 + 0.45 * Math.sin(now / 90 + i * 0.9);
        const ea = aBars.current[i];
        const eu = uBars.current[i];
        if (ea) ea.style.height = `${6 + a * 52 * env * wob}px`;
        if (eu) eu.style.height = `${6 + u * 52 * env * wob}px`;
      }

      // cartoon: mouth opens and the body bounces with the voice
      mouthRef.current?.setAttribute("ry", String(3 + a * 15));
      if (charRef.current) {
        charRef.current.style.transform = `translateY(${-a * 8}px) scale(${1 + a * 0.05})`;
      }

      // mic rings pulse with your voice
      if (ring1.current) {
        ring1.current.style.transform = `scale(${1 + u * 0.6})`;
        ring1.current.style.opacity = String(0.4 + u * 0.5);
      }
      if (ring2.current) {
        ring2.current.style.transform = `scale(${1 + u * 0.3})`;
      }

      // who is talking right now
      let m: Mode = "listening";
      if (now - lastAgentRef.current < 350) m = "speaking";
      else if (now - lastUserRef.current < 350) m = "you";
      else if (thinkingRef.current) m = "thinking";
      if (m !== modeRef.current) {
        modeRef.current = m;
        setMode(m);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  async function start() {
    if (starting || live) return;
    setStarting(true);
    endedRef.current = false;

    let prompt = "";
    let greeting = "";
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/interview/${id}/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      prompt = data.prompt;
      greeting = data.greeting;
    } catch (e: any) {
      toast.error(e.message ?? "Could not start the interview");
      setStarting(false);
      return;
    }

    const session = new AgentSession({
      auth: {
        tokenFactory: async () => {
          const r = await fetch(`${BACKEND_URL}/api/v1/deepgram-token`);
          if (!r.ok) throw new Error("token failed: " + (await r.text()));
          return r.text();
        },
      },
      agent: {
        listen: { provider: { type: "deepgram", version: "v1", model: "nova-3" } },
        think: {
          provider: { type: "open_ai", model: "gpt-4o-mini" },
          prompt: prompt,
        },
        speak: { provider: { type: "deepgram", version: "v2", model: "flux-kit-en" } },
        greeting: greeting,
      },
    });

    const player = new AgentPlayer();
    const mic = new AgentMicrophone((data) => session.sendAudio(data));
    micRef.current = mic;
    playerRef.current = player;

    cleanupRef.current = () => {
      cleanupRef.current = () => {};
      try {
        mic.stop();
        session.disconnect();
        player.dispose();
      } catch {}
      micRef.current = null;
      playerRef.current = null;
    };

    session.on("audio", (chunk) => player.queue(chunk));
    session.on("user-started-speaking", () => {
      thinkingRef.current = false;
      player.interrupt();
    });
    session.on("agent-thinking", () => {
      thinkingRef.current = true;
    });
    session.on("agent-started-speaking", () => {
      thinkingRef.current = false;
    });

    // the text is not shown, but it is still saved for the scoring
    session.on("conversation-text", (msg) => {
      fetch(`${BACKEND_URL}/api/v1/interview/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: msg.role, content: msg.content }),
      });
    });
    session.on("error", (e) => console.log("agent error", e));
    session.on("sdk-error", (e) => console.log("sdk error", e));

    try {
      await session.connect();
      await mic.start();
    } catch (e) {
      console.log(e);
      toast.error("Could not start. Allow the microphone and try again.");
      cleanupRef.current();
      setStarting(false);
      return;
    }

    setStarting(false);
    setLive(true);
    setSeconds(0);
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    timeoutRef.current = setTimeout(() => stopRef.current(), MAX_SECONDS * 1000);

    stopRef.current = async () => {
      if (endedRef.current) return;
      endedRef.current = true;

      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
      cleanupRef.current();
      setLive(false);
      setScoring(true);

      // wait a second so the last messages get saved
      await new Promise((r) => setTimeout(r, 1000));

      try {
        const r = await fetch(`${BACKEND_URL}/api/v1/interview/${id}/finish`, {
          method: "POST",
        });
        const data = await r.json();
        if (!r.ok) {
          toast.error(data.message ?? "Could not score the interview");
          setScoring(false);
          endedRef.current = false;
          return;
        }
        navigate(`/result/${id}`);
      } catch {
        toast.error("Could not score the interview");
        setScoring(false);
        endedRef.current = false;
      }
    };
  }

  const subtitle = scoring
    ? "Scoring your interview..."
    : starting
    ? "Connecting..."
    : live
    ? "Interview in progress"
    : "Ready when you are";

  const leftStatus =
    mode === "speaking" ? "Speaking..." : mode === "thinking" ? "Thinking..." : live ? "Listening to you" : "Ready to start";

  const rightStatus =
    mode === "you"
      ? "You're speaking"
      : mode === "speaking"
      ? "Interviewer is speaking"
      : mode === "thinking"
      ? "Thinking..."
      : live
      ? "Listening..."
      : "Microphone is off";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#fdf9e8] font-['Source_Serif_4'] text-[#12260f]">
      <style>{`
        @keyframes iq-blink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
        .iq-eye { animation: iq-blink 4s infinite; transform-box: fill-box; transform-origin: center; }
      `}</style>

      {/* soft green shapes in the background */}
      <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />

      {/* navbar */}
      <nav className="relative mx-auto mt-5 flex max-w-5xl items-center justify-between rounded-2xl bg-white/70 px-5 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-300 font-['Bricolage_Grotesque'] text-xl font-extrabold">
            I
          </div>
          <span className="font-['Bricolage_Grotesque'] text-xl font-extrabold">InterviewIQ</span>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-[#f3efdc] px-3 py-1 text-sm tabular-nums">
          <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-stone-400"}`} />
          {fmt(seconds)} / {fmt(MAX_SECONDS)}
        </span>
      </nav>

      <main className="relative mx-auto max-w-5xl px-6 pb-10 pt-8">
        <div className="text-center">
          <h1 className="font-['Bricolage_Grotesque'] text-3xl font-extrabold sm:text-4xl">
            Your <span className="rounded-lg bg-emerald-200 px-3">Interview</span>
          </h1>
          <p className="mt-2 text-sm text-[#12260f]/60">{subtitle}</p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-5">
          {/* LEFT: the interviewer */}
          <div className="relative overflow-hidden rounded-3xl bg-[#eaf8ff] bg-[radial-gradient(#9ad7f7_1px,transparent_1px)] bg-[size:14px_14px] p-5 shadow-md md:col-span-3">
            <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-400" : "bg-white/50"}`} />
              Interviewer
            </span>

            <div className="flex h-[380px] flex-col items-center justify-end">
              {/* thinking dots */}
              <div className="mb-2 flex h-6 items-end gap-1.5">
                {mode === "thinking" &&
                  [0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#12260f]/60"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
              </div>

              {/* the cartoon */}
              <div ref={charRef} className="w-56 sm:w-64">
                <svg viewBox="0 0 200 200" className="w-full">
                  {/* ear tufts */}
                  <ellipse cx="62" cy="42" rx="10" ry="22" fill="#fde047" transform="rotate(-28 62 42)" />
                  <ellipse cx="146" cy="44" rx="10" ry="22" fill="#fde047" transform="rotate(28 146 44)" />
                  {/* body */}
                  <path
                    d="M28 122 C28 62 68 34 104 36 C150 38 176 76 172 126 C170 166 136 188 100 188 C60 188 28 166 28 122 Z"
                    fill="#fde047"
                  />
                  {/* cheeks */}
                  <circle cx="62" cy="128" r="11" fill="#fb923c" opacity="0.35" />
                  <circle cx="140" cy="128" r="11" fill="#fb923c" opacity="0.35" />
                  {/* eyes */}
                  <g className="iq-eye">
                    <line x1="78" y1="92" x2="76" y2="110" stroke="#1b1410" strokeWidth="8" strokeLinecap="round" />
                  </g>
                  <g className="iq-eye">
                    <line x1="122" y1="92" x2="124" y2="110" stroke="#1b1410" strokeWidth="8" strokeLinecap="round" />
                  </g>
                  {/* mouth (opens when it talks) */}
                  <ellipse ref={mouthRef} cx="100" cy="140" rx="15" ry="3" fill="#1b1410" />
                </svg>
              </div>

              {/* its sound bars */}
              <div className="mt-3 flex h-16 items-center justify-center gap-1">
                {Array.from({ length: N }).map((_, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      aBars.current[i] = el;
                    }}
                    className="h-1.5 w-1 rounded-full bg-sky-500"
                  />
                ))}
              </div>
              <p className="mt-1 text-sm font-medium text-[#12260f]/70">{leftStatus}</p>
            </div>
          </div>

          {/* RIGHT: your microphone */}
          <div className="flex flex-col rounded-3xl bg-white/80 p-5 shadow-md md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <path d="M12 18v4" />
                </svg>
              </div>
              <span className="font-['Bricolage_Grotesque'] text-lg font-bold">Your Microphone</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${live ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-500"}`}>
                {live ? "Active" : "Off"}
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center py-4">
              <div className="relative flex h-44 w-44 items-center justify-center">
                <div ref={ring1} className="absolute h-40 w-40 rounded-full bg-emerald-200/60" />
                <div ref={ring2} className="absolute h-28 w-28 rounded-full bg-emerald-300/70" />
                <div
                  className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg ${
                    live ? "bg-emerald-600" : "bg-stone-400"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0" />
                    <path d="M12 18v4" />
                  </svg>
                </div>
              </div>

              <p className="mt-3 font-['Bricolage_Grotesque'] text-lg font-bold">{rightStatus}</p>

              {/* your sound bars */}
              <div className="mt-2 flex h-16 items-center justify-center gap-1">
                {Array.from({ length: N }).map((_, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      uBars.current[i] = el;
                    }}
                    className="h-1.5 w-1 rounded-full bg-emerald-500"
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <b>Tip:</b> Use headphones so the AI does not hear itself.
            </div>
          </div>
        </div>

        {/* buttons */}
        <div className="mt-8 flex justify-center">
          {live ? (
            <Button
              onClick={() => stopRef.current()}
              className="h-12 rounded-full bg-red-600 px-8 font-semibold text-white hover:bg-red-700"
            >
              End interview
            </Button>
          ) : (
            <Button
              onClick={start}
              disabled={starting || scoring}
              className="h-12 rounded-full bg-[#12260f] px-8 font-semibold text-[#fdf9e8] hover:bg-[#1d3a16]"
            >
              {scoring ? "Scoring your interview..." : starting ? "Connecting..." : "▶  Start Interview"}
            </Button>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-[#12260f]/50">
          The interview ends by itself after 5 minutes.
        </p>
      </main>
    </div>
  );
}