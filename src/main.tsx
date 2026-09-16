import { createRoot } from "react-dom/client";
import App from "./app/App";
import "@netapp/blueprint/css";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);
