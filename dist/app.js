#!/usr/bin/env node

// app.tsx
import React, { useState, useEffect, useRef } from "react";
import { render, Box, Text, Static, useInput, useApp } from "ink";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
function renderInline(text) {
  const parts = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    const codeMatch = remaining.match(/`([^`]+)`/);
    const matches = [
      boldMatch && { type: "bold", match: boldMatch, index: boldMatch.index },
      italicMatch && { type: "italic", match: italicMatch, index: italicMatch.index },
      codeMatch && { type: "code", match: codeMatch, index: codeMatch.index }
    ].filter(Boolean);
    if (matches.length === 0) {
      parts.push(/* @__PURE__ */ jsx(Text, { children: remaining }, key++));
      break;
    }
    matches.sort((a, b) => a.index - b.index);
    const first = matches[0];
    if (first.index > 0) {
      parts.push(/* @__PURE__ */ jsx(Text, { children: remaining.slice(0, first.index) }, key++));
    }
    const inner = first.match[1];
    if (first.type === "bold") {
      parts.push(/* @__PURE__ */ jsx(Text, { bold: true, children: inner }, key++));
    } else if (first.type === "italic") {
      parts.push(/* @__PURE__ */ jsx(Text, { italic: true, children: inner }, key++));
    } else {
      parts.push(/* @__PURE__ */ jsx(Text, { color: "cyan", children: inner }, key++));
    }
    remaining = remaining.slice(first.index + first.match[0].length);
  }
  return parts;
}
function renderMd(source, maxWidth) {
  const lines = source.split("\n");
  const blocks = [];
  let i = 0;
  let key = 0;
  const COLS = maxWidth ?? Math.min((process.stdout.columns || 80) - 4, 60);
  while (i < lines.length) {
    const line = lines[i];
    const codeStart = line.match(/^```\s*(.*)?$/);
    if (codeStart) {
      const lang = codeStart[1]?.trim() || "";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      const maxCodeLen = Math.max(lang.length, ...codeLines.map((l) => l.length));
      const codeWidth = Math.min(maxCodeLen + 2, COLS);
      const border = "\u2500".repeat(codeWidth);
      blocks.push(
        /* @__PURE__ */ jsxs(Box, { flexDirection: "column", marginY: 1, children: [
          /* @__PURE__ */ jsxs(Text, { color: "gray", children: [
            "\u250C",
            border,
            "\u2510"
          ] }),
          lang && /* @__PURE__ */ jsxs(Box, { flexDirection: "row", children: [
            /* @__PURE__ */ jsx(Text, { color: "gray", children: "\u2502" }),
            /* @__PURE__ */ jsxs(Text, { color: "gray", dimColor: true, children: [
              " ",
              lang,
              " ".repeat(Math.max(0, codeWidth - lang.length - 1))
            ] }),
            /* @__PURE__ */ jsx(Text, { color: "gray", children: "\u2502" })
          ] }),
          codeLines.map((cl, ci) => /* @__PURE__ */ jsxs(Box, { flexDirection: "row", children: [
            /* @__PURE__ */ jsx(Text, { color: "gray", children: "\u2502" }),
            /* @__PURE__ */ jsxs(Text, { color: "cyan", children: [
              " ",
              cl,
              " ".repeat(Math.max(0, codeWidth - cl.length - 1))
            ] }),
            /* @__PURE__ */ jsx(Text, { color: "gray", children: "\u2502" })
          ] }, ci)),
          /* @__PURE__ */ jsxs(Text, { color: "gray", children: [
            "\u2514",
            border,
            "\u2518"
          ] })
        ] }, key++)
      );
      continue;
    }
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const color = level === 1 ? "yellow" : level === 2 ? "green" : void 0;
      blocks.push(
        /* @__PURE__ */ jsx(Text, { bold: true, color, children: renderInline(headerMatch[2]) }, key++)
      );
      i++;
      continue;
    }
    if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      blocks.push(/* @__PURE__ */ jsx(Text, { color: "gray", children: "\u2500".repeat(Math.min(40, COLS)) }, key++));
      i++;
      continue;
    }
    if (line.startsWith("> ")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        /* @__PURE__ */ jsx(Box, { flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingLeft: 1, children: quoteLines.map((ql, qi) => /* @__PURE__ */ jsx(Text, { color: "gray", italic: true, children: renderInline(ql) }, qi)) }, key++)
      );
      continue;
    }
    if (line.match(/^[-*]\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        /* @__PURE__ */ jsx(Box, { flexDirection: "column", children: items.map((item, li) => /* @__PURE__ */ jsxs(Text, { children: [
          "  \u2022 ",
          renderInline(item)
        ] }, li)) }, key++)
      );
      continue;
    }
    if (line.match(/^\d+\.\s+/)) {
      const items = [];
      const nums = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const numMatch = lines[i].match(/^(\d+)\.\s+/);
        nums.push(parseInt(numMatch[1]));
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        /* @__PURE__ */ jsx(Box, { flexDirection: "column", children: items.map((item, li) => {
          const prefix = `${nums[li]}. `;
          return /* @__PURE__ */ jsxs(Text, { children: [
            "  ",
            prefix,
            renderInline(item)
          ] }, li);
        }) }, key++)
      );
      continue;
    }
    if (line.match(/^\|/)) {
      const tableLines = [];
      while (i < lines.length && lines[i].match(/^\|/)) {
        tableLines.push(lines[i]);
        i++;
      }
      const parseRow = (row) => row.split("|").slice(1, -1).map((cell) => cell.trim());
      const isSep = (row) => row.replace(/[|\-:\s]/g, "") === "";
      const headerRow = parseRow(tableLines[0]);
      const dataRows = tableLines.slice(1).filter((r) => !isSep(r)).map(parseRow);
      const numCols = headerRow.length;
      const idealWidths = headerRow.map((h) => h.length);
      for (const row of dataRows) {
        for (let c = 0; c < numCols; c++) {
          idealWidths[c] = Math.max(idealWidths[c], (row[c] || "").length);
        }
      }
      const overhead = (numCols - 1) * 3 + 4;
      let totalWidth = idealWidths.reduce((a, b) => a + b, 0) + overhead;
      const colWidths = [...idealWidths];
      if (totalWidth > COLS) {
        const available = COLS - overhead;
        const totalIdeal = idealWidths.reduce((a, b) => a + b, 0);
        for (let c = 0; c < numCols; c++) {
          colWidths[c] = Math.max(6, Math.floor(idealWidths[c] * available / totalIdeal));
        }
        totalWidth = colWidths.reduce((a, b) => a + b, 0) + overhead;
      }
      const pad = (s, w) => s.length > w ? s.slice(0, w - 1) + "\u2026" : s + " ".repeat(w - s.length);
      const border = "\u2500".repeat(totalWidth);
      const renderRow = (cells, isHeader) => /* @__PURE__ */ jsxs(Box, { flexDirection: "row", children: [
        /* @__PURE__ */ jsx(Text, { color: "gray", children: "\u2502 " }),
        cells.map((cell, ci) => /* @__PURE__ */ jsxs(React.Fragment, { children: [
          ci > 0 && /* @__PURE__ */ jsx(Text, { color: "gray", children: " \u2502 " }),
          isHeader ? /* @__PURE__ */ jsx(Text, { bold: true, children: renderInline(pad(cell, colWidths[ci])) }) : /* @__PURE__ */ jsx(Text, { children: renderInline(pad(cell, colWidths[ci])) })
        ] }, ci)),
        /* @__PURE__ */ jsx(Text, { color: "gray", children: " \u2502" })
      ] }, key++);
      blocks.push(
        /* @__PURE__ */ jsxs(Box, { flexDirection: "column", marginY: 1, children: [
          /* @__PURE__ */ jsxs(Text, { color: "gray", children: [
            "\u250C",
            border,
            "\u2510"
          ] }),
          renderRow(headerRow, true),
          /* @__PURE__ */ jsxs(Text, { color: "gray", children: [
            "\u251C",
            border,
            "\u2524"
          ] }),
          dataRows.map((row, ri) => renderRow(row, false)),
          /* @__PURE__ */ jsxs(Text, { color: "gray", children: [
            "\u2514",
            border,
            "\u2518"
          ] })
        ] }, key++)
      );
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].match(/^```/) && !lines[i].match(/^#{1,6}\s/) && !lines[i].match(/^(-{3,}|\*{3,}|_{3,})$/) && !lines[i].startsWith("> ") && !lines[i].match(/^[-*]\s+/) && !lines[i].match(/^\d+\.\s+/) && !lines[i].match(/^\|/)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(
        /* @__PURE__ */ jsx(Text, { children: renderInline(paraLines.join(" ")) }, key++)
      );
    }
  }
  return /* @__PURE__ */ jsx(Box, { flexDirection: "column", children: blocks });
}
var SPINNER_FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading
}) {
  const [cursorPos, setCursorPos] = useState(value.length);
  const [showCursor, setShowCursor] = useState(true);
  const prevValue = useRef(value);
  if (value !== prevValue.current) {
    prevValue.current = value;
    if (cursorPos !== value.length) {
      setCursorPos(value.length);
    }
  }
  useEffect(() => {
    const timer = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setShowCursor(true);
  }, [value, cursorPos]);
  useInput((input, key) => {
    if (isLoading) return;
    if (key.return) {
      onSubmit(value);
      return;
    }
    if (key.ctrl && input === "c") {
      process.exit(0);
    }
    if (key.ctrl && input === "a") {
      setCursorPos(0);
      return;
    }
    if (key.ctrl && input === "e") {
      setCursorPos(value.length);
      return;
    }
    if (key.ctrl && input === "u") {
      const newValue = value.slice(cursorPos);
      onChange(newValue);
      setCursorPos(0);
      return;
    }
    if (key.ctrl && input === "k") {
      const newValue = value.slice(0, cursorPos);
      onChange(newValue);
      return;
    }
    if (key.ctrl && input === "w") {
      const before2 = value.slice(0, cursorPos);
      const trimmed = before2.trimEnd();
      const lastSpace = trimmed.lastIndexOf(" ");
      const newBefore = lastSpace >= 0 ? before2.slice(0, lastSpace + 1) : "";
      const newValue = newBefore + value.slice(cursorPos);
      onChange(newValue);
      setCursorPos(newBefore.length);
      return;
    }
    if (key.leftArrow) {
      setCursorPos(Math.max(0, cursorPos - 1));
      return;
    }
    if (key.rightArrow) {
      setCursorPos(Math.min(value.length, cursorPos + 1));
      return;
    }
    if (key.home) {
      setCursorPos(0);
      return;
    }
    if (key.end) {
      setCursorPos(value.length);
      return;
    }
    if (key.backspace) {
      if (cursorPos > 0) {
        const newValue = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
        onChange(newValue);
        setCursorPos(cursorPos - 1);
      }
      return;
    }
    if (input === "\x1B[3~") {
      if (cursorPos < value.length) {
        const newValue = value.slice(0, cursorPos) + value.slice(cursorPos + 1);
        onChange(newValue);
      }
      return;
    }
    if (input && !key.ctrl && !key.meta && input.length === 1 && input >= " ") {
      const newValue = value.slice(0, cursorPos) + input + value.slice(cursorPos);
      onChange(newValue);
      setCursorPos(cursorPos + 1);
    }
  });
  const before = value.slice(0, cursorPos);
  const atCursor = value[cursorPos] ?? " ";
  const after = value.slice(cursorPos + 1);
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", children: [
    /* @__PURE__ */ jsxs(Box, { flexDirection: "row", children: [
      before.length > 0 && /* @__PURE__ */ jsx(Text, { children: before }),
      showCursor ? /* @__PURE__ */ jsx(Text, { inverse: true, children: atCursor }) : /* @__PURE__ */ jsx(Text, { children: atCursor }),
      after.length > 0 && /* @__PURE__ */ jsx(Text, { children: after })
    ] }),
    isLoading && /* @__PURE__ */ jsx(Text, { color: "yellow", dimColor: true, children: "  Processing..." })
  ] });
}
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
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const msgWidth = Math.floor((process.stdout.columns || 80) * 0.75) - 2;
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [isLoading]);
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
  const API_TIMEOUT = 3e4;
  const send = async (val) => {
    if (!val.trim() || isLoading || !chatSession) return;
    if (val.trim() === "/clear" || val.trim() === "/clean" || val.trim() === "/cls") {
      console.clear();
      setDisplayHistory([]);
      setCurrentResponse("");
      setInput("");
      setClearKey((prev) => prev + 1);
      return;
    }
    if (val.trim() === "/exit" || val.trim() === "/quit") {
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
      const timeout = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Request timed out after 30s")), API_TIMEOUT)
      );
      const result = await Promise.race([
        chatSession.sendMessageStream(val),
        timeout
      ]);
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
      const msg = e.message || "";
      const isRateLimit = /429|rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(msg);
      const isTimeout = /timed?\s*out/i.test(msg);
      const isNetwork = /network|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg);
      let errorText;
      if (isRateLimit) {
        errorText = "Rate limited \u2014 wait a moment and try again.";
      } else if (isTimeout) {
        errorText = "Request timed out after 30s. Check your connection.";
      } else if (isNetwork) {
        errorText = "Network error \u2014 check your internet connection.";
      } else {
        errorText = `Error: ${msg || "Unknown error"}`;
      }
      const errorHistory = [
        ...history,
        {
          id: Date.now().toString(),
          role: "model",
          text: errorText,
          isError: true
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
              color: msg.isError ? "red" : msg.role === "user" ? "magenta" : "green",
              bold: true,
              children: [
                msg.isError ? "\u26A0 Error" : msg.role === "user" ? config.username : config.aiNickname,
                ":"
              ]
            }
          ),
          msg.isError ? /* @__PURE__ */ jsx(Text, { color: "red", children: msg.text }) : msg.role === "model" ? renderMd(msg.text, msgWidth) : /* @__PURE__ */ jsx(Text, { children: msg.text })
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
          currentResponse ? renderMd(currentResponse, msgWidth) : /* @__PURE__ */ jsxs(Text, { color: "yellow", children: [
            SPINNER_FRAMES[spinnerFrame],
            " Thinking..."
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsxs(Box, { borderStyle: "round", borderColor: isLoading ? "yellow" : "gray", children: [
      /* @__PURE__ */ jsx(Box, { marginRight: 1, children: /* @__PURE__ */ jsx(Text, { color: "blue", children: ">" }) }),
      /* @__PURE__ */ jsx(
        ChatInput,
        {
          value: input,
          onChange: setInput,
          onSubmit: send,
          isLoading
        }
      )
    ] })
  ] });
};
render(/* @__PURE__ */ jsx(App, {}));
