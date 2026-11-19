import { useEffect, useState } from "react";
import { useParams } from "react-router";

export function Result() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`http://localhost:3001/api/v1/interview/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  if (!data) return <p>Loading...</p>;

  return (
    <div>
      <h1>{data.score} / 10</h1>
      <p>{data.summary}</p>

      <h3>Strengths</h3>
      <ul>{data.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>

      <h3>Needs work</h3>
      <ul>{data.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
    </div>
  );
}