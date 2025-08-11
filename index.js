const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: "*" }));

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SHARED_SECRET = process.env.AUDIT_SHARED_SECRET;

if (!OPENAI_KEY) console.error("OPENAI_API_KEY is missing");
if (!SHARED_SECRET) console.error("AUDIT_SHARED_SECRET is missing");

// Auth gate for audit calls
app.use((req, res, next) => {
  if (req.path === "/audit") {
    if (req.headers["x-auth-token"] !== SHARED_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  next();
});

// Health
app.get("/", (_req, res) => res.send("AI audit proxy is running"));

// Audit endpoint
app.post("/audit", async (req, res) => {
  try {
    const { scripts } = req.body || {};
    if (!Array.isArray(scripts)) {
      return res.status(400).json({ error: "Missing scripts array" });
    }

    const messages = [
      { role: "system", content: "You are a senior Roblox Luau code auditor. Return only JSON with issues and suggested fixes." },
      { role: "user", content: JSON.stringify({ scripts }, null, 2) }
    ];

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        messages,
        response_format: { type: "json_object" }
      })
    });

    const data = await r.json();
    const out = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
      ? data.choices[0].message.content
      : "{}";

    // Return parsed JSON if possible
    try {
      return res.json(JSON.parse(out));
    } catch {
      // If the model returned a string, return it as-is
      return res.send(out);
    }
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
