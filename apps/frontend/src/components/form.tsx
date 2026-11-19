import { useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { BACKEND_URL } from "../lib/config";

const steps = [
  { n: "01", title: "Paste your GitHub", text: "The AI reads your public repos and picks the projects to talk about." },
  { n: "02", title: "Talk out loud", text: "A real voice interview. Answer the questions, and interrupt like a real conversation." },
  { n: "03", title: "Get your score", text: "A rating out of 10 with a summary, your strengths, and what to improve." },
];

const bars = [10, 22, 14, 30, 18, 36, 24, 12, 28, 16, 34, 20, 26, 12, 32, 18, 24, 10];

function Paper({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 100"
      className={className}
      fill="none"
      stroke="#12260f"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 6 L62 4 L68 92 L12 96 Z" fill="#fffdf4" />
      <path d="M18 24 q6 -6 12 0 t12 0 t12 0" />
      <path d="M18 40 q6 -6 12 0 t12 0 t12 0" />
      <path d="M18 56 q6 -6 12 0 t12 0" />
      <circle cx="18" cy="74" r="1.5" fill="#12260f" />
      <path d="M26 74 h30" />
    </svg>
  );
}

export function Form() {
  const [github, setgithub] = useState("");
  const [loading, setloading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit() {
    if (!github.trim()) {
      toast("Paste your GitHub link first");
      inputRef.current?.focus();
      return;
    }
    setloading(true);
    try {
      const Response = await axios.post(`${BACKEND_URL}/api/v1/pre-interview`, {
        github,
      });
      navigate(`/interview/${Response.data.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? "Something went wrong, try again");
      setloading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#fdf9e8] font-['Source_Serif_4'] text-[#12260f]">
      {/* faint grid */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#12260f0a_1px,transparent_1px),linear-gradient(to_bottom,#12260f0a_1px,transparent_1px)] bg-[size:56px_56px]" />

      {/* navbar */}
      <nav className="relative mx-auto mt-5 flex max-w-5xl items-center justify-between rounded-xl border border-dashed border-[#12260f]/40 bg-white/50 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-300 font-['Bricolage_Grotesque'] text-xl font-extrabold">
            I
          </div>
          <span className="font-['Bricolage_Grotesque'] text-xl font-extrabold">InterviewIQ</span>
        </div>
        <div className="hidden gap-8 text-sm md:flex">
          <a href="#how" className="hover:underline">How it works</a>
          <a href="#preview" className="hover:underline">Sample interview</a>
        </div>
        <Button
          onClick={() => inputRef.current?.focus()}
          className="h-9 rounded-md bg-[#12260f] px-4 text-xs font-semibold text-[#fdf9e8] hover:bg-[#1d3a16]"
        >
          It's Free, Try Now!
        </Button>
      </nav>

      {/* hero */}
      <section className="relative mx-auto max-w-5xl px-6 pb-10 pt-16 text-center">
        <Paper className="absolute left-2 top-24 hidden w-20 -rotate-12 lg:block" />
        <Paper className="absolute left-24 top-64 hidden w-24 rotate-6 lg:block" />
        <Paper className="absolute right-4 top-40 hidden w-20 rotate-12 lg:block" />

        <span className="inline-flex items-center gap-2 rounded bg-yellow-300 px-2 py-1 text-xs font-medium">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-[#12260f] text-[10px] text-yellow-300">✦</span>
          Voice AI Interviews
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl font-['Bricolage_Grotesque'] text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
          AI Interviewer that asks about your own{" "}
          <span className="inline-block rounded-sm bg-yellow-300 px-3">projects.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base text-[#12260f]/80 sm:text-lg">
          Paste your GitHub link. The AI reads your repos, asks you real questions
          out loud, and gives you a score out of 10 with honest feedback.
        </p>

        {/* input */}
        <div className="mx-auto mt-8 flex w-full max-w-xl items-center gap-2 rounded-full border-2 border-[#12260f] bg-white p-1.5">
          <Input
            ref={inputRef}
            value={github}
            placeholder="github.com/your-username"
            className="h-11 border-0 bg-transparent px-4 text-base text-[#12260f] shadow-none placeholder:text-[#12260f]/40 focus-visible:ring-0"
            onChange={(e) => setgithub(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && onSubmit()}
          />
          <Button
            disabled={loading}
            onClick={onSubmit}
            className="h-11 rounded-full bg-[#12260f] px-6 font-semibold text-[#fdf9e8] hover:bg-[#1d3a16]"
          >
            {loading ? "Starting..." : "Start Interview"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-[#12260f]/50">
          You need a microphone. The interview takes about 5 minutes.
        </p>

        {/* built with */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <span className="text-xs text-[#12260f]/60">Built with:</span>
          {["React", "Bun", "Prisma", "PostgreSQL", "Deepgram"].map((t) => (
            <span key={t} className="font-['Bricolage_Grotesque'] text-base font-bold text-[#12260f]/70">
              {t}
            </span>
          ))}
        </div>
        <div className="mx-auto mt-3 h-px w-72 bg-[#12260f]/60" />
      </section>

      {/* preview */}
      <section id="preview" className="relative mx-auto max-w-4xl px-6 pb-16">
        <div className="rounded-[2rem] bg-[#d9531e] p-3 sm:p-4">
          <div className="rounded-3xl bg-[#1b1410] p-5 text-left text-[#f4f1e8] sm:p-8">
            <div className="mb-5 flex items-center justify-between text-xs text-white/60">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                Sample interview
              </span>
              <span>02:14</span>
            </div>

            <div className="max-w-md rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3 text-sm sm:text-base">
              I saw your weather-app project. Why did you choose that API?
            </div>
            <div className="ml-auto mt-3 max-w-md rounded-2xl rounded-tr-sm bg-yellow-300 px-4 py-3 text-sm text-black sm:text-base">
              I wanted live data, so I used a free open API and cached the results.
            </div>

            <div className="mt-6 flex h-10 items-center justify-center gap-1">
              {bars.map((h, i) => (
                <span
                  key={i}
                  className="w-1 animate-pulse rounded-full bg-yellow-300"
                  style={{ height: h, animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-white/50">AI is listening...</p>
          </div>
        </div>

        <div className="absolute -bottom-2 right-10 rotate-3 rounded-xl border-2 border-[#12260f] bg-yellow-300 px-4 py-2 text-center shadow-md">
          <div className="font-['Bricolage_Grotesque'] text-2xl font-extrabold leading-none">8 / 10</div>
          <div className="text-[10px]">sample score</div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="relative mx-auto max-w-5xl px-6 pb-20">
        <h2 className="mb-8 text-center font-['Bricolage_Grotesque'] text-3xl font-extrabold">
          How it works
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-dashed border-[#12260f]/40 bg-white/60 p-6">
              <div className="font-['Bricolage_Grotesque'] text-3xl font-extrabold text-[#d9531e]">{s.n}</div>
              <h3 className="mt-2 font-['Bricolage_Grotesque'] text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-[#12260f]/70">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}