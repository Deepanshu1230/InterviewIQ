import "./index.css";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Form } from "./components/form";
import { BrowserRouter, Routes, Route } from "react-router";
import { Interview } from "./components/Interview";
import { Toaster } from "./components/ui/sonner"



export function App() {
  
  return (
    <BrowserRouter>

    <Routes>
      <Route path="/form" element={<Form/>}/>
      <Route path="/interview" element={<Interview/>}/>
    </Routes>
    <Toaster position="top-center"/>
    </BrowserRouter>
    
     );
}

export default App;
