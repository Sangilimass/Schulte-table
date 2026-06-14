/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GameDifficulty, GameMode, GameTheme, GameThemeMode, GameSession, UserSettings, UserProfile } from "./src/types.js";

// Make sure output/data folders exist
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, "db.json");

// Structure of our file-based Database
interface DbUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

interface DbSettings {
  userId: string;
  gridSize: GameDifficulty;
  mode: GameMode;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  theme: GameTheme;
  themeMode: GameThemeMode;
  timerCountUp: boolean;
}

interface DatabaseRoot {
  users: DbUser[];
  settings: DbSettings[];
  sessions: GameSession[];
  tokens: Record<string, string>; // token -> userId
}

// Read database or initialize
function getDb(): DatabaseRoot {
  if (!fs.existsSync(DB_FILE)) {
    const fresh: DatabaseRoot = { users: [], settings: [], sessions: [], tokens: {} };
    saveDb(fresh);
    return fresh;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Database read error, recreating fresh DB", err);
    const fresh: DatabaseRoot = { users: [], settings: [], sessions: [], tokens: {} };
    saveDb(fresh);
    return fresh;
  }
}

function saveDb(data: DatabaseRoot) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Database save error", err);
  }
}

// Crypto password helper
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Seed admin/demo accounts or default setup
const DEFAULT_SETTINGS: Omit<DbSettings, 'userId'> = {
  gridSize: "5x5",
  mode: "number",
  soundEnabled: true,
  vibrationEnabled: true,
  theme: "slate",
  themeMode: "dark",
  timerCountUp: true
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS Headers
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Bearer Token Auth Middleware
  const authenticateUser = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized access. No valid session key provided." });
      return;
    }
    const token = authHeader.split(" ")[1];
    const db = getDb();
    const userId = db.tokens[token];
    if (!userId) {
      res.status(401).json({ error: "Session expired or invalid login." });
      return;
    }
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      res.status(401).json({ error: "User account no longer exists." });
      return;
    }
    // Attach details to request
    (req as any).user = user;
    (req as any).token = token;
    next();
  };

  // --- AUTH ENDPOINTS ---

  app.post("/api/auth/register", (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Please fulfill all inputs: name, email, and password." });
      return;
    }

    const db = getDb();
    const cleanEmail = email.trim().toLowerCase();
    
    if (db.users.some(u => u.email === cleanEmail)) {
      res.status(400).json({ error: "Account with this email already registered." });
      return;
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);
    const userId = crypto.randomUUID();

    const newUser: DbUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      salt,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);

    // Default settings for newly registered user
    const userSettings: DbSettings = {
      userId,
      ...DEFAULT_SETTINGS
    };
    db.settings.push(userSettings);

    const token = generateToken();
    db.tokens[token] = userId;

    saveDb(db);

    const profile: UserProfile = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      createdAt: newUser.createdAt
    };

    res.status(201).json({
      token,
      user: profile,
      settings: userSettings
    });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Missing login credentials." });
      return;
    }

    const db = getDb();
    const cleanEmail = email.trim().toLowerCase();
    const user = db.users.find(u => u.email === cleanEmail);

    if (!user) {
      res.status(401).json({ error: "Incorrect email or password combination." });
      return;
    }

    const calculatedHash = hashPassword(password, user.salt);
    if (calculatedHash !== user.passwordHash) {
      res.status(401).json({ error: "Incorrect email or password combination." });
      return;
    }

    const token = generateToken();
    db.tokens[token] = user.id;

    // Fetch user settings or generate default
    let settings = db.settings.find(s => s.userId === user.id);
    if (!settings) {
      settings = { userId: user.id, ...DEFAULT_SETTINGS };
      db.settings.push(settings);
    }

    saveDb(db);

    const profile: UserProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    };

    res.json({
      token,
      user: profile,
      settings
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const db = getDb();
      if (db.tokens[token]) {
        delete db.tokens[token];
        saveDb(db);
      }
    }
    res.json({ message: "Successfully logged out." });
  });

  app.get("/api/auth/me", authenticateUser, (req: any, res) => {
    const user = req.user as DbUser;
    const db = getDb();
    let settings = db.settings.find(s => s.userId === user.id);
    if (!settings) {
      settings = { userId: user.id, ...DEFAULT_SETTINGS };
      db.settings.push(settings);
      saveDb(db);
    }

    const profile: UserProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    };

    res.json({
      user: profile,
      settings
    });
  });

  // --- SETTINGS ENDPOINTS ---

  app.get("/api/settings", authenticateUser, (req: any, res) => {
    const user = req.user as DbUser;
    const db = getDb();
    let settings = db.settings.find(s => s.userId === user.id);
    if (!settings) {
      settings = { userId: user.id, ...DEFAULT_SETTINGS };
      db.settings.push(settings);
      saveDb(db);
    }
    res.json(settings);
  });

  app.post("/api/settings", authenticateUser, (req: any, res) => {
    const user = req.user as DbUser;
    const { gridSize, mode, soundEnabled, vibrationEnabled, theme, themeMode, timerCountUp } = req.body;

    const db = getDb();
    let idx = db.settings.findIndex(s => s.userId === user.id);

    const updatedSettings: DbSettings = {
      userId: user.id,
      gridSize: gridSize || "5x5",
      mode: mode || "number",
      soundEnabled: soundEnabled !== undefined ? soundEnabled : true,
      vibrationEnabled: vibrationEnabled !== undefined ? vibrationEnabled : true,
      theme: theme || "slate",
      themeMode: themeMode || "dark",
      timerCountUp: timerCountUp !== undefined ? timerCountUp : true
    };

    if (idx !== -1) {
      db.settings[idx] = updatedSettings;
    } else {
      db.settings.push(updatedSettings);
    }

    saveDb(db);
    res.json(updatedSettings);
  });

  // --- GAME SESSION ENDPOINTS ---

  app.post("/api/sessions", (req, res) => {
    const { difficulty, mode, startedAt, endedAt, totalTimeMs, mistakes, accuracy, completed, tapIntervals } = req.body;
    
    // Auth optional (supports guests playing locally and saving)
    const authHeader = req.headers.authorization;
    let userId: string | null = null;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const db = getDb();
      userId = db.tokens[token] || null;
    }

    const newSession: GameSession = {
      id: crypto.randomUUID(),
      userId,
      difficulty: difficulty || "5x5",
      mode: mode || "number",
      startedAt: startedAt || new Date().toISOString(),
      endedAt: endedAt || new Date().toISOString(),
      totalTimeMs: totalTimeMs || 0,
      mistakes: mistakes !== undefined ? mistakes : 0,
      accuracy: accuracy !== undefined ? accuracy : 100,
      completed: completed !== undefined ? completed : true,
      tapIntervals: tapIntervals || []
    };

    const db = getDb();
    db.sessions.push(newSession);
    saveDb(db);

    res.status(201).json(newSession);
  });

  app.get("/api/sessions", authenticateUser, (req: any, res) => {
    const user = req.user as DbUser;
    const db = getDb();
    
    // Sort reverse chronological
    const userSessions = db.sessions
      .filter(s => s.userId === user.id)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      
    res.json(userSessions);
  });

  // Sync endpoint so offline guest sessions can migrate to an account
  app.post("/api/sessions/sync", authenticateUser, (req: any, res) => {
    const user = req.user as DbUser;
    const { sessions } = req.body; // array of sessions
    
    if (!Array.isArray(sessions)) {
      res.status(400).json({ error: "Missing session list to synchronize." });
      return;
    }

    const db = getDb();
    let importedCount = 0;

    sessions.forEach((s: any) => {
      // Prevent duplicating existing sync records
      const exists = db.sessions.some(existing => existing.id === s.id);
      if (!exists) {
        db.sessions.push({
          id: s.id || crypto.randomUUID(),
          userId: user.id,
          difficulty: s.difficulty || "5x5",
          mode: s.mode || "number",
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          totalTimeMs: s.totalTimeMs,
          mistakes: s.mistakes,
          accuracy: s.accuracy,
          completed: s.completed,
          tapIntervals: s.tapIntervals || []
        });
        importedCount++;
      }
    });

    if (importedCount > 0) {
      saveDb(db);
    }

    // Return full consolidated user history
    const userSessions = db.sessions
      .filter(s => s.userId === user.id)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    res.json({ message: `Successfully synchronized ${importedCount} training rounds.`, sessions: userSessions });
  });

  // --- LEADERBOARD ENDPOINT ---
  app.get("/api/leaderboard", (req, res) => {
    const grid = (req.query.difficulty as GameDifficulty) || "5x5";
    const mode = (req.query.mode as GameMode) || "number";

    const db = getDb();
    // Gather all completed sessions matching grid size and mode, grouped by user
    // Display only the best response for each distinct user to make the board interactive
    const userScores: Record<string, { time: number; session: GameSession; userName: string }> = {};

    db.sessions
      .filter(s => s.completed && s.difficulty === grid && s.mode === mode)
      .forEach(s => {
        let name = "Anonymous Guest";
        const ownerId = s.userId;
        if (ownerId) {
          const matchedUser = db.users.find(u => u.id === ownerId);
          if (matchedUser) {
            name = matchedUser.name;
          }
        }

        const dictKey = ownerId || `guest_${s.id}`;
        const existing = userScores[dictKey];
        if (!existing || s.totalTimeMs < existing.time) {
          userScores[dictKey] = {
            time: s.totalTimeMs,
            session: s,
            userName: name
          };
        }
      });

    // Sort ascending by time
    const leaderboard = Object.values(userScores)
      .map(entry => ({
        userName: entry.userName,
        totalTimeMs: entry.session.totalTimeMs,
        accuracy: entry.session.accuracy,
        mistakes: entry.session.mistakes,
        date: entry.session.endedAt
      }))
      .sort((a, b) => a.totalTimeMs - b.totalTimeMs)
      .slice(0, 10); // top 10

    res.json(leaderboard);
  });

  // API Stats Endpoint
  app.get("/api/stats", authenticateUser, (req: any, res) => {
    const user = req.user as DbUser;
    const db = getDb();
    const userSessions = db.sessions.filter(s => s.userId === user.id && s.completed);

    // Compute stats
    const totalSessions = db.sessions.filter(s => s.userId === user.id).length;
    const completedSessions = userSessions.length;
    const averageTimeMs = completedSessions > 0 
      ? Math.round(userSessions.reduce((acc, s) => acc + s.totalTimeMs, 0) / completedSessions)
      : 0;

    const averageAccuracy = completedSessions > 0
      ? Math.round(userSessions.reduce((acc, s) => acc + s.accuracy, 0) / completedSessions)
      : 0;

    const totalMistakes = userSessions.reduce((acc, s) => acc + s.mistakes, 0);

    const bestTimeMs: Record<GameDifficulty, number> = {
      "3x3": 0,
      "4x4": 0,
      "5x5": 0,
      "6x6": 0
    };

    userSessions.forEach(s => {
      const currentBest = bestTimeMs[s.difficulty];
      if (currentBest === 0 || s.totalTimeMs < currentBest) {
        bestTimeMs[s.difficulty] = s.totalTimeMs;
      }
    });

    // Compute Streak (simplified consecutive days playing check)
    // Find unique days player entered a session sorted
    const activeDates = Array.from(new Set(
      db.sessions
        .filter(s => s.userId === user.id)
        .map(s => s.startedAt.split("T")[0])
    )).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streakDays = 0;
    if (activeDates.length > 0) {
      const todayStr = new Date().toISOString().split("T")[0];
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      
      // If played today or yesterday, check sequential chain
      if (activeDates[0] === todayStr || activeDates[0] === yesterdayStr) {
        streakDays = 1;
        let lastDate = new Date(activeDates[0]);
        for (let i = 1; i < activeDates.length; i++) {
          const currDate = new Date(activeDates[i]);
          const diffDays = (lastDate.getTime() - currDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 1.1) { // within ~1 day
            streakDays++;
            lastDate = currDate;
          } else {
            break;
          }
        }
      }
    }

    res.json({
      totalSessions,
      completedSessions,
      averageTimeMs,
      bestTimeMs,
      averageAccuracy,
      totalMistakes,
      streakDays
    });
  });


  // --- VITE AND SPA FALLBACK SETUP ---

  if (process.env.NODE_ENV !== "production") {
    // Vite Dev Server middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production build serves static files from /dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Schulte Table Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Backend failed to bootstrap:", err);
});
