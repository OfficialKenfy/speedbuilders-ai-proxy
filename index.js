import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: "*" }));

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SHARED_SECRET = process.env.AUDIT_SHARED_SECRET;

// Only requests with your secret can use the audit
app.use((req, res, next) => {
  if (req.path === "/audit") {
    if (req.headers["x-auth-token"] !== SHARED_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  next();
});

// Main audit endpoint
app.post("/audit", async (req, res) => {
  const { scripts } = req.body;
  if (!Array.isArray(scripts)) {
    return res.status(400).json({ error: "Missing scripts array" });
  }

  const messages = [
    {
      role: "system",
      content: "You are a senior Roblox Luau code auditor. Return only JSON with issues and suggested fixes."
    },
    {
      role: "user",
      content: JSON.stringify({ scripts }, null, 2)
    }
  ];

  try {
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
    res.json(data.choices?.[0]?.message?.content || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get("/", (req, res) => res.send("AI audit proxy is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

