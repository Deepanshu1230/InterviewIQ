import express from "express";
import { PrevinterviewBody } from "./types";
import axios from "axios";
import cors from "cors";
import { prisma } from "./db";
import { DeepgramClient } from "@deepgram/sdk";
import OpenAI from "openai";

const app=express();
app.use(express.json());
app.use(cors());

app.listen(3001);

const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! });

const client = new OpenAI({
    apiKey: process.env.GROQ_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

app.post("/api/v1/pre-interview",async (req,res)=> {
    const {success,data}= PrevinterviewBody.safeParse(req.body);

    if(!success){
        res.status(411).json({
            message:"Enter the valid link in string "
        })

        return;
    }

    const githubUrl = data.github.endsWith("/") ? data.github.slice(0, -1) : data.github;

    const gitUser = githubUrl.split("/").pop();


     try {
        const gitResult = await axios.get(`https://api.github.com/users/${gitUser}/repos`);

        const result = gitResult.data.map((x: any) => ({
            description: x.description,
            full_name: x.full_name,
            name: x.name,
            language: x.language
        }))

        if (result.length === 0) {
            res.status(404).json({
                message: "This user has no public repos"
            })
            return;
        }

        const interview = await prisma.interview.create({
            data: {
                githubMetadata: result,
                status: "Pre"
            }
        })

        res.json({ id: interview.id });
    } catch (e) {
        console.log(e);
        res.status(500).json({
            message: "Could not get the GitHub data, check the link and try again"
        })
    }



})


app.post("/api/v1/interview/:id/start", async (req, res) => {
    const interview = await prisma.interview.findUnique({
        where: { id: req.params.id }
    })

    if (!interview) {
        res.status(404).json({
            message: "Interview not found"
        })
        return;
    }

    const repos = (interview.githubMetadata as any[]).slice(0, 8);

    const repoText = repos
        .map((r) => `- ${r.name} (${r.language ?? "unknown language"}): ${r.description ?? "no description"}`)
        .join("\n");

    const prompt = `You are a friendly technical interviewer talking to a candidate by voice.
Here are the candidate's GitHub projects:
${repoText}

Rules:
- Ask only ONE question at a time.
- Keep every reply to 2 or 3 short sentences. This is spoken, so no lists and no code.
- Ask about real projects from the list above: why they built it, how it works, what was hard.
- If an answer is vague, ask a follow-up question about it.
- After about 6 questions, thank the candidate and say the interview is finished.`;

    const greeting = "Hi! I looked at your GitHub projects. Are you ready to start the interview?";

    await prisma.interview.update({
        where: { id: interview.id },
        data: { status: "InProgress" }
    })

    res.json({ prompt, greeting });
})

app.get("/api/v1/deepgram-token", async (req, res) => {
    try {
        const t = await deepgram.auth.v1.tokens.grant();
        res.send(t.access_token);
    } catch (e) {
        console.log(e);
        res.status(500).json({
            message: "Could not create the token"
        })
    }
})


app.post("/api/v1/interview/:id/message", async (req, res) => {
    const { role, content } = req.body;

    try {
        await prisma.message.create({
            data: {
                interviewId: req.params.id,
                message: content,
                type: role === "user" ? "User" : "Assistant"
            }
        })
        res.json({ ok: true });
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: "Could not save the message" })
    }
})


app.post("/api/v1/interview/:id/finish", async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: { interviewId: req.params.id },
            orderBy: { createdAt: "asc" }
        })

        if (messages.length < 2) {
            res.status(400).json({ message: "Not enough conversation to score" })
            return;
        }

        const transcript = messages.map((m) => `${m.type}: ${m.message}`).join("\n");

        const completion = await client.chat.completions.create({
            model: process.env.GROQ_MODEL!,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You evaluate a technical interview about a candidate's GitHub projects.
        Reply ONLY with JSON in exactly this shape:
        {
        "rating": a whole number from 1 to 10,
        "summary": "3 or 4 sentences about how the interview went",
        "strengths": ["...", "..."],
        "weaknesses": ["...", "..."]
        }
        Be honest. Do not give 9 or 10 unless the answers were truly strong.`
                        },
                        { role: "user", content: transcript }
                    ]
                })

        const parsed = JSON.parse(completion.choices[0]?.message.content ?? "{}");

        const interview = await prisma.interview.update({
            where: { id: req.params.id },
            data: {
                status: "Done",
                score: Math.min(10, Math.max(1, Math.round(parsed.rating))),
                summary: parsed.summary,
                strengths: parsed.strengths ?? [],
                weaknesses: parsed.weaknesses ?? []
            }
        })

        res.json(interview);
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: "Could not score the interview" })
    }
})

// the result page uses this to load the result
app.get("/api/v1/interview/:id", async (req, res) => {
    const interview = await prisma.interview.findUnique({
        where: { id: req.params.id }
    })

    if (!interview) {
        res.status(404).json({ message: "Interview not found" })
        return;
    }

    res.json(interview);
})
