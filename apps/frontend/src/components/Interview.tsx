import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { AgentSession, AgentMicrophone, AgentPlayer } from "@deepgram/agents";

export default function Interview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lines, setLines] = useState<string[]>([]);
  const [live, setLive] = useState(false);
  const [scoring, setScoring] = useState(false);
  const stopRef = useRef<() => void>(() => {});

  async function start() {
    const res = await fetch(`http://localhost:3001/api/v1/interview/${id}/start`, {
      method: "POST",
    });
    const { prompt, greeting } = await res.json();

    const session = new AgentSession({
      auth: {
        tokenFactory: async () => {
          const r = await fetch("http://localhost:3001/api/v1/deepgram-token");
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

    session.on("audio", (chunk) => player.queue(chunk));
    session.on("user-started-speaking", () => player.interrupt());
    session.on("conversation-text", (msg) => {
      setLines((old) => [...old, `${msg.role}: ${msg.content}`]);

      fetch(`http://localhost:3001/api/v1/interview/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: msg.role, content: msg.content }),
      });
    });
    session.on("error", (e) => console.log("agent error", e));
    session.on("sdk-error", (e) => console.log("sdk error", e));

    await session.connect();
    await mic.start();
    setLive(true);

    stopRef.current = async () => {
      mic.stop();
      session.disconnect();
      player.dispose();
      setLive(false);
      setScoring(true);

      // wait a second so the last messages get saved
      await new Promise((r) => setTimeout(r, 1000));

      await fetch(`http://localhost:3001/api/v1/interview/${id}/finish`, {
        method: "POST",
      });
      navigate(`/result/${id}`);
    };
  }

  return (
    <div>
      <button disabled={scoring} onClick={live ? () => stopRef.current() : start}>
        {scoring ? "Scoring your interview..." : live ? "End interview" : "Start"}
      </button>
      {lines.map((l, i) => <p key={i}>{l}</p>)}
    </div>
  );
}