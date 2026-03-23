#!/usr/bin/env node

// app.tsx
import { fileURLToPath } from "url";
import { dirname, resolve as resolve2 } from "path";
import dotenv from "dotenv";
import { useState, useEffect } from "react";
import { render, Box, Text, Static, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

// config.ts
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";
import yaml from "js-yaml";
var DEFAULT_CONFIG = {
  username: "You",
  aiNickname: "Jimmy",
  model: "gemini-2.5-flash-lite",
  systemPrompt: "You are a helpful AI assistant. Always provide short, concise, and accurate answers. Be direct and to the point. Avoid unnecessary elaboration unless specifically asked for more detail."
};
var CONFIG_PATH = resolve(homedir(), ".config", "jimmy.config.yml");
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = yaml.load(raw);
    if (!parsed || typeof parsed !== "object") {
      console.warn("Warning: config file is empty or invalid, using defaults.");
      return DEFAULT_CONFIG;
    }
    return {
      username: parsed.username ?? DEFAULT_CONFIG.username,
      aiNickname: parsed.aiNickname ?? DEFAULT_CONFIG.aiNickname,
      model: parsed.model ?? DEFAULT_CONFIG.model,
      systemPrompt: parsed.systemPrompt ?? DEFAULT_CONFIG.systemPrompt
    };
  } catch (err) {
    console.warn(`Warning: failed to parse config file: ${err.message}. Using defaults.`);
    return DEFAULT_CONFIG;
  }
}

// app.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
dotenv.config({ path: resolve2(__dirname, "./.env") });
console.log("Current Dir:", process.cwd());
console.log("Key Status:", process.env.GEMINI_KEY ? "Loaded \u2705" : "Missing \u274C");
var config = loadConfig();
console.log("Config:", `model=${config.model}`, `user=${config.username}`, `ai=${config.aiNickname}`);
var genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || "");
var model = genAI.getGenerativeModel({ model: config.model });
var App = () => {
  const { exit } = useApp();
  const [history, setHistory] = useState([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState(null);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [displayHistory, setDisplayHistory] = useState([]);
  const [clearKey, setClearKey] = useState(0);
  useEffect(() => {
    const initChat = model.startChat({
      history: [{
        role: "user",
        parts: [{ text: config.systemPrompt }]
      }, {
        role: "model",
        parts: [{ text: "Understood. I will provide short, concise, and accurate answers." }]
      }]
    });
    setChatSession(initChat);
  }, []);
  const userHistory = displayHistory.filter((h) => h.role === "user").map((h) => h.text);
  useInput((input2, key) => {
    if (key.upArrow) {
      const newIndex = Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(userHistory[newIndex] || "");
    }
    if (key.downArrow) {
      const newIndex = Math.min(userHistory.length, historyIndex + 1);
      setHistoryIndex(newIndex);
      if (newIndex === userHistory.length) {
        setInput("");
      } else {
        setInput(userHistory[newIndex] || "");
      }
    }
  });
  const send = async (val) => {
    console.log("send called with:", JSON.stringify(val));
    if (!val.trim() || isLoading || !chatSession) return;
    if (val.trim() === "/clear" || val.trim() === "/clean" || val.trim() === "/cls") {
      console.log("Clear command detected!");
      console.clear();
      setDisplayHistory([]);
      setCurrentResponse("");
      setInput("");
      setClearKey((prev) => prev + 1);
      return;
    }
    if (val.trim() === "/exit" || val.trim() === "/quit") {
      console.log("Goodbye!");
      exit();
      return;
    }
    const userMsg = {
      id: Date.now().toString(),
      role: "user",
      text: val
    };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setDisplayHistory(newHistory);
    setInput("");
    setIsLoading(true);
    setHistoryIndex(newHistory.filter((h) => h.role === "user").length);
    try {
      const result = await chatSession.sendMessageStream(val);
      let fullText = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        setCurrentResponse(fullText);
      }
      const updatedHistory = [
        ...history,
        userMsg,
        { id: (Date.now() + 1).toString(), role: "model", text: fullText }
      ];
      setHistory(updatedHistory);
      setDisplayHistory(updatedHistory);
      setCurrentResponse("");
    } catch (e) {
      console.error("DEBUG ERROR:", JSON.stringify(e, null, 2));
      const errorHistory = [
        ...history,
        {
          id: Date.now().toString(),
          role: "model",
          text: `Error: ${e.message || "Unknown error"}`
        }
      ];
      setHistory(errorHistory);
      setDisplayHistory(errorHistory);
    }
    setIsLoading(false);
  };
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", padding: 1, children: [
    /* @__PURE__ */ jsx(Static, { items: displayHistory, children: (msg, index) => /* @__PURE__ */ jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs(Text, { color: msg.role === "user" ? "magenta" : "green", bold: true, children: [
        msg.role === "user" ? config.username : config.aiNickname,
        ":"
      ] }),
      msg.role === "model" ? /* @__PURE__ */ jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeHighlight], children: msg.text }) : /* @__PURE__ */ jsx(Text, { children: msg.text })
    ] }, msg.id) }, clearKey),
    isLoading && /* @__PURE__ */ jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs(Text, { color: "green", bold: true, children: [
        config.aiNickname,
        ":"
      ] }),
      /* @__PURE__ */ jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeHighlight], children: currentResponse })
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
