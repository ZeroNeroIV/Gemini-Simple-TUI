#!/usr/bin/env node

// app.tsx
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";
import { useState, useEffect } from "react";
import { render, Box, Text, Static } from "ink";
import TextInput from "ink-text-input";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { jsx, jsxs } from "react/jsx-runtime";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "./.env") });
console.log("Current Dir:", process.cwd());
console.log("Key Status:", process.env.GEMINI_KEY ? "Loaded \u2705" : "Missing \u274C");
var genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || "");
var model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
var USERNAME = "ZeroNeroIV";
var AI_NICKNAME = "Jimmy";
var App = () => {
  const [history, setHistory] = useState([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState(null);
  useEffect(() => {
    const initChat = model.startChat({ history: [] });
    setChatSession(initChat);
  }, []);
  const send = async (val) => {
    if (!val.trim() || isLoading || !chatSession) return;
    const userMsg = {
      id: Date.now().toString(),
      role: "user",
      text: val
    };
    setHistory((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    try {
      const result = await chatSession.sendMessageStream(val);
      let fullText = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        setCurrentResponse(fullText);
      }
      setHistory((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "model", text: fullText }
      ]);
      setCurrentResponse("");
    } catch (e) {
      console.error("DEBUG ERROR:", JSON.stringify(e, null, 2));
      setHistory((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "model",
          // Show the actual error message in the chat UI
          text: `Error: ${e.message || "Unknown error"}`
        }
      ]);
    }
    setIsLoading(false);
  };
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", padding: 1, children: [
    /* @__PURE__ */ jsx(Static, { items: history, children: (msg, index) => /* @__PURE__ */ jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs(Text, { color: msg.role === "user" ? "magenta" : "green", bold: true, children: [
        msg.role === "user" ? USERNAME : AI_NICKNAME,
        ":"
      ] }),
      /* @__PURE__ */ jsx(Text, { children: msg.text })
    ] }, index) }),
    isLoading && /* @__PURE__ */ jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs(Text, { color: "green", bold: true, children: [
        AI_NICKNAME,
        ":"
      ] }),
      /* @__PURE__ */ jsx(Text, { children: currentResponse })
    ] }),
    /* @__PURE__ */ jsxs(Box, { borderStyle: "round", borderColor: isLoading ? "yellow" : "gray", children: [
      /* @__PURE__ */ jsx(Box, { marginRight: 1, children: /* @__PURE__ */ jsx(Text, { color: "blue", children: ">" }) }),
      /* @__PURE__ */ jsx(
        TextInput,
        {
          value: input,
          onChange: setInput,
          onSubmit: send
        }
      )
    ] })
  ] });
};
render(/* @__PURE__ */ jsx(App, {}));
