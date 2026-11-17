import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {useState} from "react";
import { toast } from "sonner";
import axios from "axios";
import { BACKEND_URL } from "../lib/config";

export function Form(){
const [github,setgithub]=useState("");

 async function onSubmit(){
    if(!github){
        toast("Input first");
        return ;
    }
    await axios.post(`${BACKEND_URL}/api/v1/pre-interview`,{
            github
        });

}
    return  <div className="h-screen w-screen bg-white flex items-center justify-center">
      
      
      <div className="flex-col items-center justify-center space-y-3">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
        AI interview Platform
        </h1>
        <Input placeholder="Github" className="px-4 py-4 " onChange={e => setgithub(e.target.value)}></Input>
        <div className="flex justify-center">
          <Button onClick={onSubmit}>Start Interview</Button>
        </div>
        
      </div>
        
    </div>

}