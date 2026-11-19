import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { BACKEND_URL } from "../lib/config";

const R = 70;
const C = 2 * Math.PI * R; // length of the ring

function look(score: number) {
  if (score >= 9) return { color: "#16a34a", label: "Excellent" };
  if (score >= 7) return { color: "#16a34a", label: "Good job" };
  if (score >= 5) return { color: "#eab308", label: "Getting there" };
  return { color: "#ea580c", label: "Needs practice" };
}

// same page frame as the other pages
function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#fdf9e8] font-['Source_Serif_4'] text-[#12260f]">
      <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />

      <nav className="relative mx-auto mt-5 flex max-w-4xl items-center justify-between rounded-2xl bg-white/70 px-5 py-3 shadow-sm backdrop-blur">
        <button onClick={() => navigate("/")} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-300 font-['Bricolage_Grotesque'] text-xl font-extrabold">
            I
          </div>
          <span className="font-['Bricolage_Grotesque'] text-xl font-extrabold">InterviewIQ</span>
        </button>
        <span className="rounded-full bg-[#f3efdc] px-3 py-1 text-sm">Interview result</span>
      </nav>

      <main className="relative mx-auto max-w-4xl px-6 pb-12 pt-8">{children}</main>
    </div>
  );
}

export function Result() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [shown, setShown] = useState(0); // the number that counts up

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/v1/interview/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setData(d);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [id]);

  // count the score up from 0
  useEffect(() => {
    if (state !== "ready" || data?.status !== "Done") return;
    const target = data.score ?? 0;
    if (target <= 0) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= target) clearInterval(t);
    }, 90);
    return () => clearInterval(t);
  }, [state, data]);

  if (state === "loading") {
    return (
      <Shell>
        <p className="pt-20 text-center text-[#12260f]/60">Loading your result...</p>
      </Shell>
    );
  }

  if (state === "error") {
    return (
      <Shell>
        <div className="pt-16 text-center">
          <p className="font-['Bricolage_Grotesque'] text-2xl font-bold">We could not find this result.</p>
          <p className="mt-2 text-sm text-[#12260f]/60">The link may be wrong, or the server is not running.</p>
          <Button onClick={() => navigate("/")} className="mt-6 h-11 rounded-full bg-[#12260f] px-6 text-[#fdf9e8] hover:bg-[#1d3a16]">
            Back to home
          </Button>
        </div>
      </Shell>
    );
  }

  if (data.status !== "Done") {
    return (
      <Shell>
        <div className="pt-16 text-center">
          <p className="font-['Bricolage_Grotesque'] text-2xl font-bold">This interview has not been scored yet.</p>
          <p className="mt-2 text-sm text-[#12260f]/60">Finish the interview first, then your result will show up here.</p>
          <Button
            onClick={() => navigate(`/interview/${id}`)}
            className="mt-6 h-11 rounded-full bg-[#12260f] px-6 text-[#fdf9e8] hover:bg-[#1d3a16]"
          >
            Go to the interview
          </Button>
        </div>
      </Shell>
    );
  }

  const score: number = data.score ?? 0;
  const { color, label } = look(score);
  const strengths: string[] = data.strengths ?? [];
  const weaknesses: string[] = data.weaknesses ?? [];
  const repos: any[] = Array.isArray(data.githubMetadata) ? data.githubMetadata.slice(0, 8) : [];

  return (
    <Shell>
      <div className="text-center">
        <h1 className="font-['Bricolage_Grotesque'] text-3xl font-extrabold sm:text-4xl">
          Your <span className="rounded-lg bg-emerald-200 px-3">Result</span>
        </h1>
        <p className="mt-2 text-sm text-[#12260f]/60">Here is how your interview went.</p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-5">
        {/* score ring */}
        <div className="flex flex-col items-center justify-center rounded-3xl bg-white/80 p-6 shadow-md md:col-span-2">
          <div className="relative h-48 w-48">
            <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
              <circle cx="90" cy="90" r={R} fill="none" stroke="#12260f14" strokeWidth="14" />
              <circle
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={color}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - shown / 10)}
                style={{ transition: "stroke-dashoffset 0.1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-['Bricolage_Grotesque'] text-5xl font-extrabold">{shown}</span>
              <span className="text-sm text-[#12260f]/60">out of 10</span>
            </div>
          </div>
          <span className="mt-4 rounded-full px-4 py-1 text-sm font-semibold text-white" style={{ background: color }}>
            {label}
          </span>
        </div>

        {/* summary */}
        <div className="rounded-3xl bg-white/80 p-6 shadow-md md:col-span-3">
          <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold">Summary</h2>
          <p className="mt-3 leading-relaxed text-[#12260f]/80">{data.summary ?? "No summary available."}</p>

          {repos.length > 0 && (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-wide text-[#12260f]/50">Based on your GitHub projects</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {repos.map((r, i) => (
                  <span key={i} className="rounded-full bg-yellow-200 px-3 py-1 text-xs font-medium">
                    {r.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* strengths */}
        <div className="rounded-3xl bg-emerald-50 p-6 shadow-md md:col-span-3">
          <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-emerald-900">What went well</h2>
          <ul className="mt-3 space-y-2">
            {strengths.length === 0 && <li className="text-sm text-emerald-900/60">Nothing listed.</li>}
            {strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-emerald-950">
                <span className="mt-0.5 text-emerald-600">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* weaknesses */}
        <div className="rounded-3xl bg-orange-50 p-6 shadow-md md:col-span-2">
          <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-orange-900">Needs work</h2>
          <ul className="mt-3 space-y-2">
            {weaknesses.length === 0 && <li className="text-sm text-orange-900/60">Nothing listed.</li>}
            {weaknesses.map((w, i) => (
              <li key={i} className="flex gap-2 text-orange-950">
                <span className="mt-0.5 text-orange-600">!</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => navigate("/")}
          className="h-12 rounded-full bg-[#12260f] px-8 font-semibold text-[#fdf9e8] hover:bg-[#1d3a16]"
        >
          Try another interview
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast("Link copied");
          }}
          className="h-12 rounded-full border-2 border-[#12260f] bg-transparent px-8 font-semibold text-[#12260f] hover:bg-white/60"
        >
          Copy link
        </Button>
      </div>
    </Shell>
  );
}