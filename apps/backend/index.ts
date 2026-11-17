import express from "express";
import { PrevinterviewBody } from "./types";

const app=express();
app.use(express.json());

app.listen(3001);

app.post("/api/v1/pre-interview",(req,res)=> {
    const {success,data}= PrevinterviewBody.safeParse(req.body);

    if(!success){
        res.status(411).json({
            message:"Enter the valid link in string "
        })

        return;
    }

    const githubUrl=data.github.endsWith("/") ? data.github.slice(0,-1) : data.github;


    const gitUser=githubUrl.split("/").pop();


})
