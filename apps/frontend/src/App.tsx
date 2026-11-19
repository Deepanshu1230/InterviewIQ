import "./index.css";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Form } from "./components/form";
import { BrowserRouter, Routes, Route } from "react-router";
import { Interview } from "./components/Interview";
import { Toaster } from "./components/ui/sonner"
import { Result } from "./components/Result";



export function App() {
  
  return (
    <BrowserRouter>

    <Routes>
      <Route path="/" element={<Form/>}/>
      <Route path="/interview/:id" element={<Interview/>}/>
      <Route path="/result/:id" element={<Result/>}/>
    </Routes>
    <Toaster position="top-center"/>
    </BrowserRouter>
    
     );
}

export default App;
