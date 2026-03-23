#!/usr/bin/env node

// app.tsx
import React, { useState, useEffect } from "react";
import { render, Box, Text, Static, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

// config.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";
import yaml from "js-yaml";
var DEFAULT_CONFIG = {
  apiKey: "YOUR_GEMINI_API_KEY_HERE",
  username: "You",
  aiNickname: "Jimmy",
  model: "gemini-2.5-flash",
  systemPrompt: 'You are a direct, no-nonsense assistant. Answer immediately \u2014 no preamble, no filler, no "Sure! Let me help with that." Just give the answer. Be concise. Use code blocks when relevant. Skip the pleasantries.'
};
var CONFIG_DIR = resolve(homedir(), ".config");
var CONFIG_PATH = resolve(CONFIG_DIR, "jimmy.config.yml");
function writeDefaultConfig() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const yamlStr = yaml.dump(DEFAULT_CONFIG, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });
  writeFileSync(CONFIG_PATH, yamlStr, "utf-8");
}
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    writeDefaultConfig();
    console.log(`Config created at: ${CONFIG_PATH}`);
    console.log("Edit it to add your Gemini API key before first use.\n");
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
      apiKey: parsed.apiKey ?? DEFAULT_CONFIG.apiKey,
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
var config = loadConfig();
if (config.apiKey === "YOUR_GEMINI_API_KEY_HERE") {
  console.error("Error: No API key set. Edit ~/.config/jimmy.config.yml and add your Gemini API key.");
  process.exit(1);
}
console.log(`Jimmy | model=${config.model} user=${config.username} ai=${config.aiNickname}`);
var genAI = new GoogleGenerativeAI(config.apiKey);
var model = genAI.getGenerativeModel({ model: config.model });
function wrapText(children) {
  return React.Children.map(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      const s = String(child);
      if (!s.trim()) return null;
      return /* @__PURE__ */ jsx(Text, { children: s });
    }
    if (React.isValidElement(child) && child.props?.children) {
      return React.cloneElement(child, {
        children: wrapText(child.props.children)
      });
    }
    return child;
  });
}
var md = {
  p: ({ children }) => /* @__PURE__ */ jsx(Text, { children: wrapText(children) }),
  h1: ({ children }) => /* @__PURE__ */ jsx(Text, { bold: true, children: wrapText(children) }),
  h2: ({ children }) => /* @__PURE__ */ jsx(Text, { bold: true, children: wrapText(children) }),
  h3: ({ children }) => /* @__PURE__ */ jsx(Text, { bold: true, children: wrapText(children) }),
  h4: ({ children }) => /* @__PURE__ */ jsx(Text, { bold: true, children: wrapText(children) }),
  h5: ({ children }) => /* @__PURE__ */ jsx(Text, { bold: true, children: wrapText(children) }),
  h6: ({ children }) => /* @__PURE__ */ jsx(Text, { bold: true, children: wrapText(children) }),
  li: ({ children }) => /* @__PURE__ */ jsx(Text, { children: wrapText(children) }),
  span: ({ children }) => /* @__PURE__ */ jsx(Text, { children: wrapText(children) }),
  strong: ({ children }) => /* @__PURE__ */ jsx(Text, { bold: true, children: wrapText(children) }),
  em: ({ children }) => /* @__PURE__ */ jsx(Text, { italic: true, children: wrapText(children) }),
  code: ({ children }) => /* @__PURE__ */ jsx(Text, { color: "cyan", children: wrapText(children) }),
  pre: ({ children }) => /* @__PURE__ */ jsx(Box, { flexDirection: "column", children: wrapText(children) }),
  blockquote: ({ children }) => /* @__PURE__ */ jsx(Text, { color: "gray", children: wrapText(children) }),
  a: ({ children }) => /* @__PURE__ */ jsx(Text, { color: "blue", underline: true, children: wrapText(children) }),
  ul: ({ children }) => /* @__PURE__ */ jsx(Box, { flexDirection: "column", children: wrapText(children) }),
  ol: ({ children }) => /* @__PURE__ */ jsx(Box, { flexDirection: "column", children: wrapText(children) }),
  table: ({ children }) => /* @__PURE__ */ jsx(Box, { flexDirection: "column", children: wrapText(children) }),
  thead: ({ children }) => /* @__PURE__ */ jsx(Box, { flexDirection: "column", children: wrapText(children) }),
  tbody: ({ children }) => /* @__PURE__ */ jsx(Box, { flexDirection: "column", children: wrapText(children) }),
  tr: ({ children }) => /* @__PURE__ */ jsx(Text, { children: wrapText(children) }),
  th: ({ children }) => /* @__PURE__ */ jsx(Text, { bold: true, children: wrapText(children) }),
  td: ({ children }) => /* @__PURE__ */ jsx(Text, { children: wrapText(children) }),
  img: ({ alt }) => /* @__PURE__ */ jsxs(Text, { color: "gray", children: [
    "[Image: ",
    alt || "no alt",
    "]"
  ] }),
  hr: () => /* @__PURE__ */ jsx(Text, { color: "gray", children: "\u2500".repeat(40) })
};
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
        parts: [{ text: "Got it. Direct answers only." }]
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
    /* @__PURE__ */ jsx(Static, { items: displayHistory, children: (msg, index) => /* @__PURE__ */ jsx(
      Box,
      {
        flexDirection: "row",
        justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
        marginBottom: 1,
        children: /* @__PURE__ */ jsxs(Box, { flexDirection: "column", width: "75%", children: [
          /* @__PURE__ */ jsxs(
            Text,
            {
              color: msg.role === "user" ? "magenta" : "green",
              bold: true,
              children: [
                msg.role === "user" ? config.username : config.aiNickname,
                ":"
              ]
            }
          ),
          msg.role === "model" ? /* @__PURE__ */ jsx(ReactMarkdown, { components: md, remarkPlugins: [remarkGfm], rehypePlugins: [rehypeHighlight], children: msg.text }) : /* @__PURE__ */ jsx(Text, { children: msg.text })
        ] })
      },
      msg.id
    ) }, clearKey),
    isLoading && /* @__PURE__ */ jsx(
      Box,
      {
        flexDirection: "row",
        justifyContent: "flex-start",
        marginBottom: 1,
        children: /* @__PURE__ */ jsxs(Box, { flexDirection: "column", width: "75%", children: [
          /* @__PURE__ */ jsxs(Text, { color: "green", bold: true, children: [
            config.aiNickname,
            ":"
          ] }),
          /* @__PURE__ */ jsx(ReactMarkdown, { components: md, remarkPlugins: [remarkGfm], rehypePlugins: [rehypeHighlight], children: currentResponse })
        ] })
      }
    ),
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
