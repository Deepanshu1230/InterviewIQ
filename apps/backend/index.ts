import express from "express";
import { PrevinterviewBody } from "./types";
import axios from "axios";
import cors from "cors";
import { prisma } from "./db";

const app=express();
app.use(express.json());
app.use(cors());

app.listen(3001);

app.post("/api/v1/pre-interview",async (req,res)=> {
    const {success,data}= PrevinterviewBody.safeParse(req.body);

    if(!success){
        res.status(411).json({
            message:"Enter the valid link in string "
        })

        return;
    }

    const githubUrl=data.github.endsWith("/") ? data.github.slice(0,-1) : data.github;


    const gitUser=githubUrl.split("/").pop();


    //call the data scraping for the github 
    const gitResult=await axios.get(`https://api.github.com/users/Deepanshu1230/repos`);

    const result=gitResult.data.map((x:any)=>({
        description:x.description,
        full_name:x.full_name,
        name:x.name 


    }))

    const interview=await prisma.interview.create({
        data:{
            githubMetadata:JSON.stringify(result),
            status:"Pre"
        }

    })

    console.log(result);
    res.json({id:interview.id});




})
