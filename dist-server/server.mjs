// server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// server/routes.ts
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import mongoose3, { Types as Types2 } from "mongoose";

// server/models.ts
import mongoose, { Schema } from "mongoose";
var UserSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    area: { type: String, required: true, trim: true },
    boardRole: { type: String, default: "", trim: true },
    avatarUrl: { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },
    bio: { type: String, default: "", trim: true },
    role: { type: String, enum: ["associate", "president"], default: "associate", required: true },
    badges: { type: [String], default: [] },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);
var SeasonSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    status: { type: String, enum: ["active", "archived"], default: "active", required: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date },
    championUserId: { type: Schema.Types.ObjectId, ref: "User" },
    finalStandings: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        fullName: { type: String, required: true },
        area: { type: String, default: "" },
        avatarUrl: { type: String, default: "" },
        points: { type: Number, required: true },
        rank: { type: Number, required: true }
      }
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);
var ChallengeSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    coverImageUrl: { type: String, default: "" },
    coverPublicId: { type: String, default: "" },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season", required: true },
    participationMode: {
      type: String,
      enum: ["open", "registration", "selected"],
      default: "open",
      required: true
    },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    evaluationMode: {
      type: String,
      enum: ["vote", "president_pick", "direct_points"],
      default: "vote",
      required: true
    },
    voterScope: {
      type: String,
      enum: ["all", "participants", "non_participants"],
      default: "all"
    },
    pointsReward: { type: Number, required: true, min: 0, default: 50 },
    secondaryPointsReward: { type: Number, default: 0, min: 0 },
    hasTimer: { type: Boolean, default: false },
    deadline: { type: Date },
    votingDeadline: { type: Date },
    status: {
      type: String,
      enum: ["active", "evaluating", "voting", "completed"],
      default: "active",
      required: true
    },
    winnerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    winningPostId: { type: Schema.Types.ObjectId, ref: "Post" },
    pointsDistributed: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);
var ChallengeProposalSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    suggestedPoints: { type: Number, default: 50, min: 0 },
    suggestedParticipationMode: {
      type: String,
      enum: ["open", "registration", "selected"],
      default: "open"
    },
    suggestedEvaluationMode: {
      type: String,
      enum: ["vote", "president_pick", "direct_points"],
      default: "vote"
    },
    proposedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    presidentNote: { type: String, default: "", trim: true },
    linkedChallengeId: { type: Schema.Types.ObjectId, ref: "Challenge" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);
var PostSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    caption: { type: String, default: "", trim: true },
    mediaUrl: { type: String, default: "" },
    mediaPublicId: { type: String, default: "" },
    mediaType: { type: String, enum: ["none", "image", "video"], default: "none" },
    challengeId: { type: Schema.Types.ObjectId, ref: "Challenge" },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        text: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);
var VoteSchema = new Schema(
  {
    challengeId: { type: Schema.Types.ObjectId, ref: "Challenge", required: true },
    voterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetPostId: { type: Schema.Types.ObjectId, ref: "Post" }
  },
  { timestamps: true }
);
VoteSchema.index({ challengeId: 1, voterId: 1 }, { unique: true });
var PointTransactionSchema = new Schema(
  {
    seasonId: { type: Schema.Types.ObjectId, ref: "Season", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    awardedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    challengeId: { type: Schema.Types.ObjectId, ref: "Challenge" }
  },
  { timestamps: true }
);
var ActivityEventSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "member_joined",
        "challenge_created",
        "challenge_completed",
        "points_awarded",
        "voting_opened",
        "season_started"
      ],
      required: true
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User" },
    challengeId: { type: Schema.Types.ObjectId, ref: "Challenge" },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
    message: { type: String, required: true },
    pointsDelta: { type: Number }
  },
  { timestamps: true }
);
var NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "like",
        "comment",
        "new_challenge",
        "proposal_approved",
        "proposal_rejected",
        "challenge_ended",
        "points_awarded",
        "voting_started"
      ],
      required: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    linkTab: { type: String, default: "feed" },
    linkId: { type: String, default: "" },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);
var RegulationSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    title: { type: String, required: true, default: "Regolamento Ufficiale FantaJESic" },
    sections: [
      {
        id: { type: String, required: true },
        heading: { type: String, required: true },
        content: { type: String, required: true }
      }
    ],
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);
var User = mongoose.models.User || mongoose.model("User", UserSchema);
var Season = mongoose.models.Season || mongoose.model("Season", SeasonSchema);
var Challenge = mongoose.models.Challenge || mongoose.model("Challenge", ChallengeSchema);
var ChallengeProposal = mongoose.models.ChallengeProposal || mongoose.model("ChallengeProposal", ChallengeProposalSchema);
var Post = mongoose.models.Post || mongoose.model("Post", PostSchema);
var Vote = mongoose.models.Vote || mongoose.model("Vote", VoteSchema);
var PointTransaction = mongoose.models.PointTransaction || mongoose.model("PointTransaction", PointTransactionSchema);
var ActivityEvent = mongoose.models.ActivityEvent || mongoose.model("ActivityEvent", ActivityEventSchema);
var Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
var Regulation = mongoose.models.Regulation || mongoose.model("Regulation", RegulationSchema);

// server/db.ts
import mongoose2 from "mongoose";
import { v2 as cloudinary } from "cloudinary";
var connectionPromise = null;
var lastDbError = null;
function isMongoConfigured() {
  return Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.trim().length > 0);
}
function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
}
function configureCloudinary() {
  if (isCloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }
  return cloudinary;
}
async function connectMongo() {
  if (!isMongoConfigured()) {
    lastDbError = "MONGODB_URI non configurata nelle variabili d\u2019ambiente.";
    return false;
  }
  if (mongoose2.connection.readyState === 1) {
    lastDbError = null;
    return true;
  }
  try {
    if (!connectionPromise) {
      connectionPromise = mongoose2.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 8e3
      });
    }
    await connectionPromise;
    lastDbError = null;
    await ensureInitialDefaults();
    return true;
  } catch (err) {
    connectionPromise = null;
    lastDbError = err instanceof Error ? err.message : "Errore di connessione a MongoDB Atlas";
    console.error("MongoDB connection error:", lastDbError);
    return false;
  }
}
function getDbStatus() {
  return {
    configured: isMongoConfigured(),
    connected: mongoose2.connection.readyState === 1,
    error: lastDbError,
    cloudinaryConfigured: isCloudinaryConfigured()
  };
}
async function ensureInitialDefaults() {
  try {
    const activeSeasonCount = await Season.countDocuments({ status: "active" });
    if (activeSeasonCount === 0) {
      const anySeasonCount = await Season.countDocuments();
      if (anySeasonCount === 0) {
        await Season.create({
          name: "Stagione 2026/2027",
          description: "Stagione inaugurale ufficiale della community FantaJESic.",
          status: "active",
          startDate: /* @__PURE__ */ new Date()
        });
      }
    }
    const regulationExists = await Regulation.findOne({ key: "main" });
    if (!regulationExists) {
      await Regulation.create({
        key: "main",
        title: "Regolamento Ufficiale FantaJESic",
        sections: [
          {
            id: "intro",
            heading: "1. Spirito della Competizione",
            content: "FantaJESic trasforma la vita associativa di JESic in una competizione sana, creativa e collaborativa. Tutti gli associati partecipano alle sfide, condividono momenti nel feed social e accumulano punti per la classifica di stagione."
          },
          {
            id: "points",
            heading: "2. Assegnazione dei Punti",
            content: "I punti vengono assegnati esclusivamente dal Presidente al termine delle sfide o per meriti associativi speciali. Ogni operazione viene registrata nello storico pubblico con motivazione e data."
          },
          {
            id: "challenges",
            heading: "3. Sfide, Proposte e Votazioni",
            content: "Ogni associato pu\xF2 proporre nuove sfide al Presidente. Una volta approvate e pubblicate, le sfide possono prevedere una scadenza automatica e una fase di votazione con voto singolo per utente."
          },
          {
            id: "fairplay",
            heading: "4. Fair Play e Moderazione",
            content: "I contenuti pubblicati devono rispettare i valori di JESic. Il Presidente pu\xF2 moderare post o commenti non conformi e gestire il regolare svolgimento delle stagioni."
          }
        ]
      });
    }
  } catch (err) {
    console.error("Error seeding structural defaults:", err);
  }
}

// server/routes.ts
var router = Router();
var JWT_SECRET = process.env.JWT_SECRET || "fantajesic-jwt-secret-set-in-env";
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
  // 50MB for video/photo
});
function sanitizeUser(user) {
  return {
    _id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    area: user.area,
    boardRole: user.boardRole || "",
    avatarUrl: user.avatarUrl || "",
    bio: user.bio || "",
    role: user.role,
    badges: user.badges || [],
    isActive: user.isActive,
    createdAt: user.createdAt
  };
}
function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}
async function requireDb(_req, res, next) {
  const connected = await connectMongo();
  if (!connected) {
    res.status(503).json({
      error: "MongoDB Atlas non \xE8 ancora connesso. Configura la variabile MONGODB_URI nel pannello Secrets o su Render.",
      code: "DB_UNAVAILABLE",
      db: getDbStatus()
    });
    return;
  }
  next();
}
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      res.status(401).json({ error: "Autenticazione richiesta." });
      return;
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.userId) {
      res.status(401).json({ error: "Token non valido." });
      return;
    }
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Account non trovato o disattivato." });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Sessione scaduta o non valida. Effettua nuovamente il login." });
  }
}
function requirePresident(req, res, next) {
  if (!req.user || req.user.role !== "president") {
    res.status(403).json({
      error: "Accesso negato: questa operazione \xE8 riservata al Presidente."
    });
    return;
  }
  next();
}
async function getActiveSeason() {
  let active = await Season.findOne({ status: "active" }).sort({ startDate: -1 });
  if (!active) {
    active = await Season.create({
      name: "Stagione 2026/2027",
      description: "Stagione ufficiale FantaJESic",
      status: "active",
      startDate: /* @__PURE__ */ new Date()
    });
  }
  return active;
}
async function syncExpiredChallenges() {
  const now = /* @__PURE__ */ new Date();
  const expired = await Challenge.find({
    status: "active",
    hasTimer: true,
    deadline: { $lte: now }
  });
  for (const ch of expired) {
    ch.status = "evaluating";
    await ch.save();
    await ActivityEvent.create({
      type: "challenge_completed",
      challengeId: ch._id,
      seasonId: ch.seasonId,
      message: `La sfida "${ch.title}" ha raggiunto la scadenza ed \xE8 ora in valutazione.`
    });
    const participantIds = ch.participants.map((p) => String(p));
    if (participantIds.length > 0) {
      await Notification.insertMany(
        participantIds.map((uid) => ({
          userId: uid,
          type: "challenge_ended",
          title: "Sfida terminata",
          body: `Il tempo per "${ch.title}" \xE8 scaduto. Inizia la fase di valutazione!`,
          linkTab: "challenges",
          linkId: String(ch._id)
        }))
      );
    }
  }
}
async function computeSeasonLeaderboard(seasonId) {
  const sid = typeof seasonId === "string" ? new Types2.ObjectId(seasonId) : seasonId;
  const [users, sums] = await Promise.all([
    User.find({ isActive: true }).sort({ createdAt: 1 }).lean(),
    PointTransaction.aggregate([
      { $match: { seasonId: sid } },
      { $group: { _id: "$recipientId", totalPoints: { $sum: "$amount" } } }
    ])
  ]);
  const pointsMap = /* @__PURE__ */ new Map();
  for (const row of sums) {
    pointsMap.set(String(row._id), Number(row.totalPoints) || 0);
  }
  const entries = users.map((u) => ({
    userId: String(u._id),
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`.trim(),
    area: u.area,
    boardRole: u.boardRole || "",
    avatarUrl: u.avatarUrl || "",
    role: u.role,
    badges: u.badges || [],
    points: pointsMap.get(String(u._id)) ?? 0
  }));
  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.fullName.localeCompare(b.fullName, "it");
  });
  return entries.map((entry, idx) => ({
    ...entry,
    rank: idx + 1
  }));
}
async function uploadBufferToCloudinary(buffer, folder, resourceType = "auto") {
  const cld = configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType
      },
      (err, result) => {
        if (err || !result) {
          reject(err || new Error("Upload Cloudinary fallito."));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type === "video" ? "video" : "image"
        });
      }
    );
    stream.end(buffer);
  });
}
router.get("/health", async (_req, res) => {
  await connectMongo();
  res.json({
    ok: true,
    service: "FantaJESic API",
    db: getDbStatus()
  });
});
router.post("/upload/avatar", upload.single("file"), async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({
        error: "Cloudinary non configurato. Imposta CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.",
        code: "CLOUDINARY_UNAVAILABLE"
      });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Nessun file selezionato." });
      return;
    }
    if (!req.file.mimetype.startsWith("image/")) {
      res.status(400).json({ error: "La foto profilo deve essere un immagine." });
      return;
    }
    const result = await uploadBufferToCloudinary(req.file.buffer, "fantajesic/avatars", "image");
    res.json(result);
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ error: "Errore durante il caricamento su Cloudinary." });
  }
});
router.use(requireDb);
router.post(
  "/upload",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!isCloudinaryConfigured()) {
        res.status(503).json({
          error: "Cloudinary non configurato. Imposta CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.",
          code: "CLOUDINARY_UNAVAILABLE"
        });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Nessun file allegato." });
        return;
      }
      const isImage = req.file.mimetype.startsWith("image/");
      const isVideo = req.file.mimetype.startsWith("video/");
      if (!isImage && !isVideo) {
        res.status(400).json({ error: "Sono supportate solo immagini e video." });
        return;
      }
      const result = await uploadBufferToCloudinary(
        req.file.buffer,
        "fantajesic/media",
        isVideo ? "video" : "image"
      );
      res.json(result);
    } catch (err) {
      console.error("Media upload error:", err);
      res.status(500).json({ error: "Errore durante il caricamento media su Cloudinary." });
    }
  }
);
router.post("/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, area, boardRole, avatarUrl, avatarPublicId } = req.body || {};
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password || !area?.trim()) {
      res.status(400).json({
        error: "Compila tutti i campi obbligatori: nome, cognome, email, password e area."
      });
      return;
    }
    if (String(password).length < 6) {
      res.status(400).json({ error: "La password deve contenere almeno 6 caratteri." });
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: "Esiste gi\xE0 un account associato a questa email." });
      return;
    }
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: normalizedEmail,
      passwordHash,
      area: String(area).trim(),
      boardRole: boardRole ? String(boardRole).trim() : "",
      avatarUrl: avatarUrl ? String(avatarUrl).trim() : "",
      avatarPublicId: avatarPublicId ? String(avatarPublicId).trim() : "",
      role: "associate"
    });
    const activeSeason = await getActiveSeason();
    await ActivityEvent.create({
      type: "member_joined",
      actorId: user._id,
      seasonId: activeSeason._id,
      message: `${user.firstName} ${user.lastName} (${user.area}) \xE8 entrato in FantaJESic!`
    });
    const token = signToken(String(user._id));
    res.status(201).json({
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Errore durante la registrazione." });
  }
});
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      res.status(400).json({ error: "Inserisci email e password." });
      return;
    }
    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) {
      res.status(401).json({ error: "Credenziali non valide." });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: "Questo account \xE8 stato sospeso dal Presidente." });
      return;
    }
    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Credenziali non valide." });
      return;
    }
    const token = signToken(String(user._id));
    res.json({
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Errore durante il login." });
  }
});
router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const activeSeason = await getActiveSeason();
    const [unreadNotifications, leaderboard] = await Promise.all([
      Notification.countDocuments({ userId: user._id, isRead: false }),
      computeSeasonLeaderboard(activeSeason._id)
    ]);
    const myStanding = leaderboard.find((e) => e.userId === String(user._id));
    res.json({
      user: sanitizeUser(user),
      unreadNotifications,
      activeSeason: {
        _id: String(activeSeason._id),
        name: activeSeason.name,
        startDate: activeSeason.startDate
      },
      myPoints: myStanding?.points ?? 0,
      myRank: myStanding?.rank ?? null
    });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Impossibile verificare la sessione." });
  }
});
router.get("/users", requireAuth, async (_req, res) => {
  try {
    const activeSeason = await getActiveSeason();
    const standings = await computeSeasonLeaderboard(activeSeason._id);
    res.json({ users: standings, seasonName: activeSeason.name });
  } catch (err) {
    console.error("List users error:", err);
    res.status(500).json({ error: "Errore nel caricamento degli associati." });
  }
});
router.get("/users/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose3.isValidObjectId(id)) {
      res.status(400).json({ error: "ID utente non valido." });
      return;
    }
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: "Associato non trovato." });
      return;
    }
    const activeSeason = await getActiveSeason();
    const [standings, posts, transactions] = await Promise.all([
      computeSeasonLeaderboard(activeSeason._id),
      Post.find({ authorId: user._id }).sort({ createdAt: -1 }).populate("authorId", "firstName lastName area boardRole avatarUrl role").populate("challengeId", "title status").populate("comments.authorId", "firstName lastName avatarUrl").lean(),
      PointTransaction.find({ recipientId: user._id }).sort({ createdAt: -1 }).populate("awardedBy", "firstName lastName").populate("challengeId", "title").populate("seasonId", "name").lean()
    ]);
    const standing = standings.find((s) => s.userId === String(user._id));
    res.json({
      profile: {
        ...sanitizeUser(user),
        points: standing?.points ?? 0,
        rank: standing?.rank ?? null,
        totalMembers: standings.length
      },
      posts,
      transactions
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "Errore nel caricamento del profilo." });
  }
});
router.patch("/users/me", requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, area, boardRole, bio, avatarUrl, avatarPublicId } = req.body || {};
    const user = req.user;
    if (firstName?.trim()) user.firstName = String(firstName).trim();
    if (lastName?.trim()) user.lastName = String(lastName).trim();
    if (area?.trim()) user.area = String(area).trim();
    if (boardRole !== void 0) user.boardRole = String(boardRole).trim();
    if (bio !== void 0) user.bio = String(bio).trim();
    if (avatarUrl !== void 0) user.avatarUrl = String(avatarUrl).trim();
    if (avatarPublicId !== void 0) user.avatarPublicId = String(avatarPublicId).trim();
    await user.save();
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Errore durante aggiornamento profilo." });
  }
});
router.get("/posts", requireAuth, async (req, res) => {
  try {
    await syncExpiredChallenges();
    const { challengeId, authorId, filter } = req.query;
    const query = {};
    if (challengeId && mongoose3.isValidObjectId(String(challengeId))) {
      query.challengeId = String(challengeId);
    } else if (filter === "challenges") {
      query.challengeId = { $ne: null };
    } else if (filter === "community") {
      query.challengeId = null;
    }
    if (authorId && mongoose3.isValidObjectId(String(authorId))) {
      query.authorId = String(authorId);
    }
    const posts = await Post.find(query).sort({ createdAt: -1 }).limit(80).populate("authorId", "firstName lastName area boardRole avatarUrl role badges").populate("challengeId", "title status participationMode pointsReward").populate("comments.authorId", "firstName lastName avatarUrl role").lean();
    res.json({ posts });
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ error: "Errore nel caricamento del feed." });
  }
});
router.post("/posts", requireAuth, async (req, res) => {
  try {
    await syncExpiredChallenges();
    const { caption, mediaUrl, mediaPublicId, mediaType, challengeId } = req.body || {};
    const user = req.user;
    if (!caption?.trim() && !mediaUrl?.trim()) {
      res.status(400).json({ error: "Inserisci un testo oppure carica una foto o un video." });
      return;
    }
    const activeSeason = await getActiveSeason();
    let linkedChallenge = null;
    if (challengeId) {
      if (!mongoose3.isValidObjectId(challengeId)) {
        res.status(400).json({ error: "Sfida non valida." });
        return;
      }
      linkedChallenge = await Challenge.findById(challengeId);
      if (!linkedChallenge) {
        res.status(404).json({ error: "Sfida non trovata." });
        return;
      }
      if (linkedChallenge.status !== "active") {
        res.status(400).json({
          error: "La partecipazione a questa sfida \xE8 chiusa. Non \xE8 pi\xF9 possibile inviare contributi."
        });
        return;
      }
      if (linkedChallenge.hasTimer && linkedChallenge.deadline && /* @__PURE__ */ new Date() >= linkedChallenge.deadline) {
        res.status(400).json({ error: "La sfida \xE8 scaduta." });
        return;
      }
      const isParticipant = linkedChallenge.participants.some(
        (p) => String(p) === String(user._id)
      );
      if (linkedChallenge.participationMode === "selected" && !isParticipant) {
        res.status(403).json({
          error: "Questa sfida \xE8 riservata ai partecipanti selezionati dal Presidente."
        });
        return;
      }
      if (linkedChallenge.participationMode === "registration" && !isParticipant) {
        res.status(403).json({
          error: "Devi prima iscriverti alla sfida per poter caricare un contenuto."
        });
        return;
      }
      if (linkedChallenge.participationMode === "open" && !isParticipant) {
        linkedChallenge.participants.push(user._id);
        await linkedChallenge.save();
      }
    }
    const created = await Post.create({
      authorId: user._id,
      caption: caption ? String(caption).trim() : "",
      mediaUrl: mediaUrl ? String(mediaUrl).trim() : "",
      mediaPublicId: mediaPublicId ? String(mediaPublicId).trim() : "",
      mediaType: mediaUrl ? mediaType === "video" ? "video" : "image" : "none",
      challengeId: linkedChallenge ? linkedChallenge._id : void 0,
      seasonId: linkedChallenge ? linkedChallenge.seasonId : activeSeason._id
    });
    const populated = await Post.findById(created._id).populate("authorId", "firstName lastName area boardRole avatarUrl role badges").populate("challengeId", "title status participationMode pointsReward").populate("comments.authorId", "firstName lastName avatarUrl role").lean();
    res.status(201).json({ post: populated });
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ error: "Errore nella pubblicazione del post." });
  }
});
router.post("/posts/:id/like", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ error: "Post non trovato." });
      return;
    }
    const userId = String(req.user._id);
    const alreadyLiked = post.likes.some((l) => String(l) === userId);
    if (alreadyLiked) {
      post.likes = post.likes.filter((l) => String(l) !== userId);
    } else {
      post.likes.push(req.user._id);
      if (String(post.authorId) !== userId) {
        await Notification.create({
          userId: post.authorId,
          type: "like",
          title: "Nuovo like al tuo post",
          body: `${req.user.firstName} ${req.user.lastName} ha messo Mi piace al tuo contenuto.`,
          linkTab: "feed",
          linkId: String(post._id)
        });
      }
    }
    await post.save();
    res.json({ likes: post.likes.map(String), liked: !alreadyLiked });
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ error: "Errore durante il like." });
  }
});
router.post("/posts/:id/comments", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body || {};
    if (!text?.trim()) {
      res.status(400).json({ error: "Scrivi un commento prima di inviare." });
      return;
    }
    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ error: "Post non trovato." });
      return;
    }
    post.comments.push({
      _id: new Types2.ObjectId(),
      authorId: req.user._id,
      text: String(text).trim(),
      createdAt: /* @__PURE__ */ new Date()
    });
    await post.save();
    if (String(post.authorId) !== String(req.user._id)) {
      await Notification.create({
        userId: post.authorId,
        type: "comment",
        title: "Nuovo commento",
        body: `${req.user.firstName} ${req.user.lastName} ha commentato: "${String(text).trim().slice(0, 60)}"`,
        linkTab: "feed",
        linkId: String(post._id)
      });
    }
    const updated = await Post.findById(post._id).populate("comments.authorId", "firstName lastName avatarUrl role").lean();
    res.status(201).json({ comments: updated?.comments ?? [] });
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ error: "Errore durante aggiunta commento." });
  }
});
router.delete("/posts/:id", requireAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ error: "Post non trovato." });
      return;
    }
    const isOwner = String(post.authorId) === String(req.user._id);
    const isPresident = req.user.role === "president";
    if (!isOwner && !isPresident) {
      res.status(403).json({ error: "Non hai i permessi per eliminare questo post." });
      return;
    }
    await Post.deleteOne({ _id: post._id });
    res.json({ deleted: true });
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).json({ error: "Errore eliminazione post." });
  }
});
router.get("/challenges", requireAuth, async (req, res) => {
  try {
    await syncExpiredChallenges();
    const { seasonId, status } = req.query;
    const query = {};
    if (seasonId && mongoose3.isValidObjectId(String(seasonId))) {
      query.seasonId = String(seasonId);
    }
    if (status && ["active", "evaluating", "voting", "completed"].includes(String(status))) {
      query.status = String(status);
    }
    const challenges = await Challenge.find(query).sort({ createdAt: -1 }).populate("participants", "firstName lastName area avatarUrl").populate("winnerIds", "firstName lastName area avatarUrl").populate("seasonId", "name status").populate("createdBy", "firstName lastName").lean();
    const challengeIds = challenges.map((c) => c._id);
    const [submissionCounts, userVotes] = await Promise.all([
      Post.aggregate([
        { $match: { challengeId: { $in: challengeIds } } },
        { $group: { _id: "$challengeId", count: { $sum: 1 } } }
      ]),
      Vote.find({ challengeId: { $in: challengeIds }, voterId: req.user._id }).lean()
    ]);
    const subMap = /* @__PURE__ */ new Map();
    for (const s of submissionCounts) subMap.set(String(s._id), s.count);
    const votedSet = new Set(userVotes.map((v) => String(v.challengeId)));
    res.json({
      challenges: challenges.map((c) => ({
        ...c,
        submissionsCount: subMap.get(String(c._id)) ?? 0,
        hasVoted: votedSet.has(String(c._id))
      }))
    });
  } catch (err) {
    console.error("List challenges error:", err);
    res.status(500).json({ error: "Errore caricamento sfide." });
  }
});
router.get("/challenges/:id", requireAuth, async (req, res) => {
  try {
    await syncExpiredChallenges();
    const { id } = req.params;
    if (!mongoose3.isValidObjectId(id)) {
      res.status(400).json({ error: "ID sfida non valido." });
      return;
    }
    const challenge = await Challenge.findById(id).populate("participants", "firstName lastName area boardRole avatarUrl role").populate("winnerIds", "firstName lastName area avatarUrl").populate("seasonId", "name status").populate("createdBy", "firstName lastName").lean();
    if (!challenge) {
      res.status(404).json({ error: "Sfida non trovata." });
      return;
    }
    const [submissions, votes, myVote] = await Promise.all([
      Post.find({ challengeId: challenge._id }).sort({ createdAt: -1 }).populate("authorId", "firstName lastName area boardRole avatarUrl role badges").populate("comments.authorId", "firstName lastName avatarUrl role").lean(),
      Vote.find({ challengeId: challenge._id }).populate("targetUserId", "firstName lastName area avatarUrl").lean(),
      Vote.findOne({ challengeId: challenge._id, voterId: req.user._id }).lean()
    ]);
    const tallyMap = /* @__PURE__ */ new Map();
    for (const v of votes) {
      const target = v.targetUserId;
      if (!target) continue;
      const key = String(target._id);
      const existing = tallyMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        tallyMap.set(key, {
          targetUserId: key,
          fullName: `${target.firstName} ${target.lastName}`.trim(),
          avatarUrl: target.avatarUrl || "",
          area: target.area || "",
          count: 1,
          targetPostId: v.targetPostId ? String(v.targetPostId) : void 0
        });
      }
    }
    const voteTallies = Array.from(tallyMap.values()).sort((a, b) => b.count - a.count);
    const uid = String(req.user._id);
    const participantIds = new Set(
      challenge.participants.map((p) => String(p._id))
    );
    const isParticipant = participantIds.has(uid);
    let canVote = challenge.status === "voting" && !myVote;
    if (challenge.votingDeadline && /* @__PURE__ */ new Date() >= new Date(challenge.votingDeadline)) {
      canVote = false;
    }
    if (canVote) {
      if (challenge.voterScope === "participants" && !isParticipant) canVote = false;
      if (challenge.voterScope === "non_participants" && isParticipant) canVote = false;
    }
    res.json({
      challenge,
      submissions,
      voteTallies,
      totalVotes: votes.length,
      myVote: myVote ? {
        targetUserId: String(myVote.targetUserId),
        targetPostId: myVote.targetPostId ? String(myVote.targetPostId) : void 0
      } : null,
      canVote
    });
  } catch (err) {
    console.error("Get challenge detail error:", err);
    res.status(500).json({ error: "Errore caricamento dettaglio sfida." });
  }
});
router.post("/challenges", requireAuth, requirePresident, async (req, res) => {
  try {
    const {
      title,
      description,
      coverImageUrl,
      coverPublicId,
      seasonId,
      participationMode,
      participants,
      evaluationMode,
      voterScope,
      pointsReward,
      secondaryPointsReward,
      hasTimer,
      deadline
    } = req.body || {};
    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ error: "Titolo e descrizione sono obbligatori." });
      return;
    }
    const activeSeason = seasonId ? await Season.findById(seasonId) : await getActiveSeason();
    if (!activeSeason) {
      res.status(404).json({ error: "Stagione non trovata." });
      return;
    }
    const useTimer = Boolean(hasTimer && deadline);
    if (useTimer && new Date(deadline) <= /* @__PURE__ */ new Date()) {
      res.status(400).json({ error: "La data di scadenza deve essere futura." });
      return;
    }
    const challenge = await Challenge.create({
      title: String(title).trim(),
      description: String(description).trim(),
      coverImageUrl: coverImageUrl ? String(coverImageUrl).trim() : "",
      coverPublicId: coverPublicId ? String(coverPublicId).trim() : "",
      seasonId: activeSeason._id,
      participationMode: participationMode || "open",
      participants: Array.isArray(participants) ? participants : [],
      evaluationMode: evaluationMode || "vote",
      voterScope: voterScope || "all",
      pointsReward: Number(pointsReward) >= 0 ? Number(pointsReward) : 50,
      secondaryPointsReward: Number(secondaryPointsReward) >= 0 ? Number(secondaryPointsReward) : 0,
      hasTimer: useTimer,
      deadline: useTimer ? new Date(deadline) : void 0,
      status: "active",
      createdBy: req.user._id
    });
    await ActivityEvent.create({
      type: "challenge_created",
      actorId: req.user._id,
      challengeId: challenge._id,
      seasonId: activeSeason._id,
      message: `Nuova sfida pubblicata: "${challenge.title}" (+${challenge.pointsReward} pt in palio).`
    });
    const activeUsers = await User.find({ isActive: true, _id: { $ne: req.user._id } }).select("_id");
    if (activeUsers.length > 0) {
      await Notification.insertMany(
        activeUsers.map((u) => ({
          userId: u._id,
          type: "new_challenge",
          title: "Nuova sfida disponibile!",
          body: `"${challenge.title}" \xB7 Premio in palio: ${challenge.pointsReward} punti.`,
          linkTab: "challenges",
          linkId: String(challenge._id)
        }))
      );
    }
    res.status(201).json({ challenge });
  } catch (err) {
    console.error("Create challenge error:", err);
    res.status(500).json({ error: "Errore creazione sfida." });
  }
});
router.patch("/challenges/:id", requireAuth, requirePresident, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      res.status(404).json({ error: "Sfida non trovata." });
      return;
    }
    const {
      title,
      description,
      participationMode,
      participants,
      evaluationMode,
      voterScope,
      pointsReward,
      secondaryPointsReward,
      hasTimer,
      deadline
    } = req.body || {};
    if (title?.trim()) challenge.title = String(title).trim();
    if (description?.trim()) challenge.description = String(description).trim();
    if (participationMode) challenge.participationMode = participationMode;
    if (Array.isArray(participants)) challenge.participants = participants;
    if (evaluationMode) challenge.evaluationMode = evaluationMode;
    if (voterScope) challenge.voterScope = voterScope;
    if (pointsReward !== void 0) challenge.pointsReward = Number(pointsReward);
    if (secondaryPointsReward !== void 0)
      challenge.secondaryPointsReward = Number(secondaryPointsReward);
    if (hasTimer !== void 0) {
      challenge.hasTimer = Boolean(hasTimer);
      challenge.deadline = hasTimer && deadline ? new Date(deadline) : void 0;
    }
    await challenge.save();
    res.json({ challenge });
  } catch (err) {
    console.error("Update challenge error:", err);
    res.status(500).json({ error: "Errore aggiornamento sfida." });
  }
});
router.post("/challenges/:id/join", requireAuth, async (req, res) => {
  try {
    await syncExpiredChallenges();
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      res.status(404).json({ error: "Sfida non trovata." });
      return;
    }
    if (challenge.status !== "active") {
      res.status(400).json({ error: "Le iscrizioni a questa sfida sono chiuse." });
      return;
    }
    if (challenge.participationMode === "selected") {
      res.status(403).json({
        error: "I partecipanti di questa sfida vengono selezionati direttamente dal Presidente."
      });
      return;
    }
    const uid = String(req.user._id);
    const alreadyJoined = challenge.participants.some((p) => String(p) === uid);
    if (!alreadyJoined) {
      challenge.participants.push(req.user._id);
      await challenge.save();
    }
    res.json({ joined: true, participantsCount: challenge.participants.length });
  } catch (err) {
    console.error("Join challenge error:", err);
    res.status(500).json({ error: "Errore durante iscrizione alla sfida." });
  }
});
router.post("/challenges/:id/close", requireAuth, requirePresident, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      res.status(404).json({ error: "Sfida non trovata." });
      return;
    }
    challenge.status = "evaluating";
    await challenge.save();
    await ActivityEvent.create({
      type: "challenge_completed",
      actorId: req.user._id,
      challengeId: challenge._id,
      seasonId: challenge.seasonId,
      message: `Le partecipazioni per "${challenge.title}" sono state chiuse dal Presidente.`
    });
    res.json({ challenge });
  } catch (err) {
    console.error("Close challenge error:", err);
    res.status(500).json({ error: "Errore chiusura sfida." });
  }
});
router.post(
  "/challenges/:id/start-voting",
  requireAuth,
  requirePresident,
  async (req, res) => {
    try {
      const challenge = await Challenge.findById(req.params.id);
      if (!challenge) {
        res.status(404).json({ error: "Sfida non trovata." });
        return;
      }
      const { voterScope, votingDeadline } = req.body || {};
      if (voterScope) challenge.voterScope = voterScope;
      challenge.votingDeadline = votingDeadline ? new Date(votingDeadline) : void 0;
      challenge.status = "voting";
      await challenge.save();
      await ActivityEvent.create({
        type: "voting_opened",
        actorId: req.user._id,
        challengeId: challenge._id,
        seasonId: challenge.seasonId,
        message: `Aperta la votazione per la sfida "${challenge.title}"!`
      });
      const activeUsers = await User.find({ isActive: true }).select("_id");
      if (activeUsers.length > 0) {
        await Notification.insertMany(
          activeUsers.map((u) => ({
            userId: u._id,
            type: "voting_started",
            title: "Votazione aperta!",
            body: `Puoi votare nella sfida "${challenge.title}".`,
            linkTab: "challenges",
            linkId: String(challenge._id)
          }))
        );
      }
      res.json({ challenge });
    } catch (err) {
      console.error("Start voting error:", err);
      res.status(500).json({ error: "Errore apertura votazione." });
    }
  }
);
router.post("/challenges/:id/vote", requireAuth, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      res.status(404).json({ error: "Sfida non trovata." });
      return;
    }
    if (challenge.status !== "voting") {
      res.status(400).json({ error: "La votazione per questa sfida non \xE8 attiva." });
      return;
    }
    if (challenge.votingDeadline && /* @__PURE__ */ new Date() >= challenge.votingDeadline) {
      res.status(400).json({ error: "Il tempo per votare \xE8 scaduto." });
      return;
    }
    const uid = String(req.user._id);
    const isParticipant = challenge.participants.some((p) => String(p) === uid);
    if (challenge.voterScope === "participants" && !isParticipant) {
      res.status(403).json({ error: "Solo i partecipanti iscritti possono votare in questa sfida." });
      return;
    }
    if (challenge.voterScope === "non_participants" && isParticipant) {
      res.status(403).json({ error: "In questa sfida votano solo gli associati non partecipanti." });
      return;
    }
    const { targetUserId, targetPostId } = req.body || {};
    if (!targetUserId || !mongoose3.isValidObjectId(targetUserId)) {
      res.status(400).json({ error: "Seleziona un partecipante valido da votare." });
      return;
    }
    const existingVote = await Vote.findOne({ challengeId: challenge._id, voterId: req.user._id });
    if (existingVote) {
      res.status(409).json({ error: "Hai gi\xE0 espresso il tuo voto per questa sfida." });
      return;
    }
    const vote = await Vote.create({
      challengeId: challenge._id,
      voterId: req.user._id,
      targetUserId,
      targetPostId: targetPostId && mongoose3.isValidObjectId(targetPostId) ? targetPostId : void 0
    });
    res.status(201).json({ vote });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ error: "Errore durante la registrazione del voto." });
  }
});
router.post(
  "/challenges/:id/confirm-winner",
  requireAuth,
  requirePresident,
  async (req, res) => {
    try {
      const challenge = await Challenge.findById(req.params.id);
      if (!challenge) {
        res.status(404).json({ error: "Sfida non trovata." });
        return;
      }
      const { awards, winnerIds, winningPostId } = req.body || {};
      if (challenge.pointsDistributed) {
        res.status(400).json({ error: "I punti per questa sfida sono gi\xE0 stati assegnati." });
        return;
      }
      const resolvedAwards = Array.isArray(awards) ? awards.filter((a) => a?.userId && Number(a.points) !== 0) : Array.isArray(winnerIds) ? winnerIds.map((uid) => ({
        userId: uid,
        points: challenge.pointsReward,
        reason: `Vincitore sfida "${challenge.title}"`
      })) : [];
      const finalWinnerIds = Array.isArray(winnerIds) && winnerIds.length > 0 ? winnerIds : resolvedAwards.map((a) => a.userId);
      challenge.winnerIds = finalWinnerIds;
      if (winningPostId && mongoose3.isValidObjectId(winningPostId)) {
        challenge.winningPostId = winningPostId;
      }
      challenge.status = "completed";
      challenge.pointsDistributed = true;
      await challenge.save();
      for (const item of resolvedAwards) {
        await PointTransaction.create({
          seasonId: challenge.seasonId,
          recipientId: item.userId,
          awardedBy: req.user._id,
          amount: Number(item.points),
          reason: item.reason || `Premio sfida "${challenge.title}"`,
          challengeId: challenge._id
        });
        if (item.badge?.trim()) {
          await User.updateOne(
            { _id: item.userId },
            { $addToSet: { badges: item.badge.trim() } }
          );
        }
        const recipient = await User.findById(item.userId);
        if (recipient) {
          await ActivityEvent.create({
            type: "points_awarded",
            actorId: req.user._id,
            targetUserId: recipient._id,
            challengeId: challenge._id,
            seasonId: challenge.seasonId,
            pointsDelta: Number(item.points),
            message: `${recipient.firstName} ${recipient.lastName} ha conquistato ${Number(item.points) > 0 ? `+${item.points}` : item.points} pt nella sfida "${challenge.title}"!`
          });
          await Notification.create({
            userId: recipient._id,
            type: "points_awarded",
            title: "Punti assegnati!",
            body: `Hai ricevuto ${Number(item.points) > 0 ? `+${item.points}` : item.points} pt per "${challenge.title}".`,
            linkTab: "leaderboard",
            linkId: String(challenge._id)
          });
        }
      }
      res.json({ challenge });
    } catch (err) {
      console.error("Confirm winner error:", err);
      res.status(500).json({ error: "Errore nella proclamazione dei vincitori." });
    }
  }
);
router.get("/proposals", requireAuth, async (req, res) => {
  try {
    const query = req.user.role === "president" ? {} : { proposedBy: req.user._id };
    const proposals = await ChallengeProposal.find(query).sort({ createdAt: -1 }).populate("proposedBy", "firstName lastName area avatarUrl").populate("reviewedBy", "firstName lastName").lean();
    res.json({ proposals });
  } catch (err) {
    console.error("Get proposals error:", err);
    res.status(500).json({ error: "Errore caricamento proposte." });
  }
});
router.post("/proposals", requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      suggestedPoints,
      suggestedParticipationMode,
      suggestedEvaluationMode
    } = req.body || {};
    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ error: "Titolo e descrizione della proposta sono obbligatori." });
      return;
    }
    const proposal = await ChallengeProposal.create({
      title: String(title).trim(),
      description: String(description).trim(),
      suggestedPoints: Number(suggestedPoints) >= 0 ? Number(suggestedPoints) : 50,
      suggestedParticipationMode: suggestedParticipationMode || "open",
      suggestedEvaluationMode: suggestedEvaluationMode || "vote",
      proposedBy: req.user._id,
      status: "pending"
    });
    res.status(201).json({ proposal });
  } catch (err) {
    console.error("Create proposal error:", err);
    res.status(500).json({ error: "Errore invio proposta." });
  }
});
router.patch("/proposals/:id", requireAuth, requirePresident, async (req, res) => {
  try {
    const proposal = await ChallengeProposal.findById(req.params.id);
    if (!proposal) {
      res.status(404).json({ error: "Proposta non trovata." });
      return;
    }
    if (proposal.status !== "pending") {
      res.status(400).json({ error: "Questa proposta \xE8 gi\xE0 stata valutata." });
      return;
    }
    const {
      action,
      presidentNote,
      title,
      description,
      pointsReward,
      participationMode,
      evaluationMode,
      voterScope,
      hasTimer,
      deadline
    } = req.body || {};
    if (action !== "approve" && action !== "reject") {
      res.status(400).json({ error: "Azione non valida (approve o reject)." });
      return;
    }
    proposal.status = action === "approve" ? "approved" : "rejected";
    proposal.presidentNote = presidentNote ? String(presidentNote).trim() : "";
    proposal.reviewedBy = req.user._id;
    proposal.reviewedAt = /* @__PURE__ */ new Date();
    let createdChallenge = null;
    if (action === "approve") {
      const activeSeason = await getActiveSeason();
      const useTimer = Boolean(hasTimer && deadline);
      createdChallenge = await Challenge.create({
        title: title?.trim() || proposal.title,
        description: description?.trim() || proposal.description,
        seasonId: activeSeason._id,
        participationMode: participationMode || proposal.suggestedParticipationMode,
        evaluationMode: evaluationMode || proposal.suggestedEvaluationMode,
        voterScope: voterScope || "all",
        pointsReward: pointsReward !== void 0 ? Number(pointsReward) : proposal.suggestedPoints,
        hasTimer: useTimer,
        deadline: useTimer ? new Date(deadline) : void 0,
        status: "active",
        createdBy: req.user._id
      });
      proposal.linkedChallengeId = createdChallenge._id;
      await ActivityEvent.create({
        type: "challenge_created",
        actorId: req.user._id,
        challengeId: createdChallenge._id,
        seasonId: activeSeason._id,
        message: `Approvata e pubblicata la sfida "${createdChallenge.title}"!`
      });
      await Notification.create({
        userId: proposal.proposedBy,
        type: "proposal_approved",
        title: "Proposta approvata!",
        body: `La tua proposta "${proposal.title}" \xE8 stata approvata e pubblicata tra le sfide!`,
        linkTab: "challenges",
        linkId: String(createdChallenge._id)
      });
    } else {
      await Notification.create({
        userId: proposal.proposedBy,
        type: "proposal_rejected",
        title: "Proposta non approvata",
        body: proposal.presidentNote ? `La proposta "${proposal.title}" non \xE8 stata approvata: ${proposal.presidentNote}` : `La proposta "${proposal.title}" non \xE8 stata approvata dal Presidente.`,
        linkTab: "challenges"
      });
    }
    await proposal.save();
    res.json({ proposal, challenge: createdChallenge });
  } catch (err) {
    console.error("Review proposal error:", err);
    res.status(500).json({ error: "Errore nella valutazione della proposta." });
  }
});
router.get("/leaderboard", requireAuth, async (req, res) => {
  try {
    const seasons = await Season.find().sort({ startDate: -1 }).lean();
    const activeSeason = seasons.find((s) => s.status === "active") || await getActiveSeason();
    const requestedSeasonId = req.query.seasonId ? String(req.query.seasonId) : String(activeSeason._id);
    const selectedSeason = seasons.find((s) => String(s._id) === requestedSeasonId) || activeSeason;
    let standings;
    if (selectedSeason.status === "archived" && selectedSeason.finalStandings?.length > 0) {
      standings = selectedSeason.finalStandings;
    } else {
      standings = await computeSeasonLeaderboard(selectedSeason._id);
    }
    res.json({
      season: selectedSeason,
      seasons,
      standings
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Errore caricamento classifica." });
  }
});
router.get("/points/history", requireAuth, async (req, res) => {
  try {
    const { seasonId, userId } = req.query;
    const query = {};
    if (seasonId && mongoose3.isValidObjectId(String(seasonId))) {
      query.seasonId = String(seasonId);
    }
    if (userId && mongoose3.isValidObjectId(String(userId))) {
      query.recipientId = String(userId);
    }
    const transactions = await PointTransaction.find(query).sort({ createdAt: -1 }).limit(120).populate("recipientId", "firstName lastName area avatarUrl").populate("awardedBy", "firstName lastName").populate("challengeId", "title").populate("seasonId", "name").lean();
    res.json({ transactions });
  } catch (err) {
    console.error("Points history error:", err);
    res.status(500).json({ error: "Errore caricamento storico punti." });
  }
});
router.post("/points", requireAuth, requirePresident, async (req, res) => {
  try {
    const { recipientId, amount, reason, seasonId, badge } = req.body || {};
    const numAmount = Number(amount);
    if (!recipientId || !mongoose3.isValidObjectId(recipientId)) {
      res.status(400).json({ error: "Seleziona un associato valido." });
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount === 0) {
      res.status(400).json({ error: "Inserisci una quantit\xE0 di punti diversa da zero." });
      return;
    }
    if (!reason?.trim()) {
      res.status(400).json({ error: "Inserisci la motivazione per questa operazione." });
      return;
    }
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      res.status(404).json({ error: "Associato non trovato." });
      return;
    }
    const targetSeason = seasonId ? await Season.findById(seasonId) : await getActiveSeason();
    if (!targetSeason) {
      res.status(404).json({ error: "Stagione non trovata." });
      return;
    }
    const tx = await PointTransaction.create({
      seasonId: targetSeason._id,
      recipientId: recipient._id,
      awardedBy: req.user._id,
      amount: numAmount,
      reason: String(reason).trim()
    });
    if (badge?.trim()) {
      await User.updateOne({ _id: recipient._id }, { $addToSet: { badges: String(badge).trim() } });
    }
    const signStr = numAmount > 0 ? `+${numAmount}` : `${numAmount}`;
    await ActivityEvent.create({
      type: "points_awarded",
      actorId: req.user._id,
      targetUserId: recipient._id,
      seasonId: targetSeason._id,
      pointsDelta: numAmount,
      message: `${recipient.firstName} ${recipient.lastName} ha ricevuto ${signStr} pt (${String(reason).trim()}).`
    });
    await Notification.create({
      userId: recipient._id,
      type: "points_awarded",
      title: numAmount > 0 ? "Hai ricevuto nuovi punti!" : "Aggiornamento punteggio",
      body: `${signStr} pt \xB7 Motivazione: ${String(reason).trim()}`,
      linkTab: "leaderboard"
    });
    res.status(201).json({ transaction: tx });
  } catch (err) {
    console.error("Assign points error:", err);
    res.status(500).json({ error: "Errore assegnazione punti." });
  }
});
router.get("/seasons", requireAuth, async (_req, res) => {
  try {
    const seasons = await Season.find().sort({ startDate: -1 }).populate("championUserId", "firstName lastName area avatarUrl").lean();
    res.json({ seasons });
  } catch (err) {
    console.error("List seasons error:", err);
    res.status(500).json({ error: "Errore caricamento stagioni." });
  }
});
router.post("/seasons", requireAuth, requirePresident, async (req, res) => {
  try {
    const { name, description, archiveCurrent } = req.body || {};
    if (!name?.trim()) {
      res.status(400).json({ error: "Inserisci il nome della nuova stagione." });
      return;
    }
    if (archiveCurrent) {
      const currentActive = await Season.findOne({ status: "active" });
      if (currentActive) {
        const finalStandings = await computeSeasonLeaderboard(currentActive._id);
        currentActive.status = "archived";
        currentActive.endDate = /* @__PURE__ */ new Date();
        currentActive.finalStandings = finalStandings.map((s) => ({
          userId: new Types2.ObjectId(s.userId),
          fullName: s.fullName,
          area: s.area,
          avatarUrl: s.avatarUrl,
          points: s.points,
          rank: s.rank
        }));
        if (finalStandings.length > 0 && finalStandings[0].points > 0) {
          currentActive.championUserId = new Types2.ObjectId(finalStandings[0].userId);
        }
        await currentActive.save();
      }
    } else {
      const activeExists = await Season.findOne({ status: "active" });
      if (activeExists) {
        res.status(400).json({
          error: "Esiste gi\xE0 una stagione attiva. Concludila prima di avviarne una nuova."
        });
        return;
      }
    }
    const season = await Season.create({
      name: String(name).trim(),
      description: description ? String(description).trim() : "",
      status: "active",
      startDate: /* @__PURE__ */ new Date(),
      createdBy: req.user._id
    });
    await ActivityEvent.create({
      type: "season_started",
      actorId: req.user._id,
      seasonId: season._id,
      message: `\xC8 ufficialmente iniziata la stagione "${season.name}"!`
    });
    res.status(201).json({ season });
  } catch (err) {
    console.error("Create season error:", err);
    res.status(500).json({ error: "Errore avvio nuova stagione." });
  }
});
router.post(
  "/seasons/:id/conclude",
  requireAuth,
  requirePresident,
  async (req, res) => {
    try {
      const season = await Season.findById(req.params.id);
      if (!season) {
        res.status(404).json({ error: "Stagione non trovata." });
        return;
      }
      if (season.status === "archived") {
        res.status(400).json({ error: "Questa stagione \xE8 gi\xE0 archiviata." });
        return;
      }
      const finalStandings = await computeSeasonLeaderboard(season._id);
      season.status = "archived";
      season.endDate = /* @__PURE__ */ new Date();
      season.finalStandings = finalStandings.map((s) => ({
        userId: new Types2.ObjectId(s.userId),
        fullName: s.fullName,
        area: s.area,
        avatarUrl: s.avatarUrl,
        points: s.points,
        rank: s.rank
      }));
      if (finalStandings.length > 0 && finalStandings[0].points > 0) {
        season.championUserId = new Types2.ObjectId(finalStandings[0].userId);
      }
      await season.save();
      res.json({ season });
    } catch (err) {
      console.error("Conclude season error:", err);
      res.status(500).json({ error: "Errore chiusura stagione." });
    }
  }
);
router.get("/activity", requireAuth, async (_req, res) => {
  try {
    await syncExpiredChallenges();
    const events = await ActivityEvent.find().sort({ createdAt: -1 }).limit(25).populate("actorId", "firstName lastName avatarUrl").populate("targetUserId", "firstName lastName avatarUrl").populate("challengeId", "title").lean();
    res.json({ events });
  } catch (err) {
    console.error("Activity error:", err);
    res.status(500).json({ error: "Errore caricamento attivit\xE0 recenti." });
  }
});
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(60).lean();
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error("Notifications error:", err);
    res.status(500).json({ error: "Errore caricamento notifiche." });
  }
});
router.post("/notifications/read", requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.body || {};
    if (notificationId && mongoose3.isValidObjectId(notificationId)) {
      await Notification.updateOne(
        { _id: notificationId, userId: req.user._id },
        { $set: { isRead: true } }
      );
    } else {
      await Notification.updateMany({ userId: req.user._id, isRead: false }, { $set: { isRead: true } });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Mark notifications read error:", err);
    res.status(500).json({ error: "Errore aggiornamento notifiche." });
  }
});
router.get("/regulations", requireAuth, async (_req, res) => {
  try {
    const regulation = await Regulation.findOne({ key: "main" }).populate("updatedBy", "firstName lastName").lean();
    res.json({ regulation });
  } catch (err) {
    console.error("Get regulations error:", err);
    res.status(500).json({ error: "Errore caricamento regolamento." });
  }
});
router.put("/regulations", requireAuth, requirePresident, async (req, res) => {
  try {
    const { title, sections } = req.body || {};
    if (!title?.trim() || !Array.isArray(sections)) {
      res.status(400).json({ error: "Titolo e sezioni del regolamento sono obbligatori." });
      return;
    }
    const updated = await Regulation.findOneAndUpdate(
      { key: "main" },
      {
        $set: {
          title: String(title).trim(),
          sections: sections.map((s, i) => ({
            id: s.id || `sec-${i + 1}`,
            heading: String(s.heading || "").trim(),
            content: String(s.content || "").trim()
          })),
          updatedBy: req.user._id
        }
      },
      { new: true, upsert: true }
    );
    res.json({ regulation: updated });
  } catch (err) {
    console.error("Update regulations error:", err);
    res.status(500).json({ error: "Errore salvataggio regolamento." });
  }
});
router.get("/admin/overview", requireAuth, requirePresident, async (_req, res) => {
  try {
    await syncExpiredChallenges();
    const activeSeason = await getActiveSeason();
    const [
      totalMembers,
      activeChallengesCount,
      evaluatingOrVotingCount,
      pendingProposalsCount,
      totalPostsCount,
      seasonPointsAgg,
      allUsers,
      recentPosts
    ] = await Promise.all([
      User.countDocuments(),
      Challenge.countDocuments({ status: "active" }),
      Challenge.countDocuments({ status: { $in: ["evaluating", "voting"] } }),
      ChallengeProposal.countDocuments({ status: "pending" }),
      Post.countDocuments(),
      PointTransaction.aggregate([
        { $match: { seasonId: activeSeason._id } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
      ]),
      User.find().select("-passwordHash").sort({ createdAt: -1 }).lean(),
      Post.find().sort({ createdAt: -1 }).limit(20).populate("authorId", "firstName lastName area avatarUrl").populate("challengeId", "title").lean()
    ]);
    res.json({
      stats: {
        totalMembers,
        activeChallengesCount,
        evaluatingOrVotingCount,
        pendingProposalsCount,
        totalPostsCount,
        seasonPointsAwarded: seasonPointsAgg[0]?.total ?? 0,
        seasonTransactionsCount: seasonPointsAgg[0]?.count ?? 0
      },
      users: allUsers,
      recentPosts,
      activeSeason
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    res.status(500).json({ error: "Errore caricamento pannello Presidente." });
  }
});
router.patch("/admin/users/:id", requireAuth, requirePresident, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: "Utente non trovato." });
      return;
    }
    const { area, boardRole, badges, isActive, firstName, lastName } = req.body || {};
    if (firstName?.trim()) user.firstName = String(firstName).trim();
    if (lastName?.trim()) user.lastName = String(lastName).trim();
    if (area?.trim()) user.area = String(area).trim();
    if (boardRole !== void 0) user.boardRole = String(boardRole).trim();
    if (Array.isArray(badges)) user.badges = badges.map((b) => String(b).trim()).filter(Boolean);
    if (typeof isActive === "boolean") user.isActive = isActive;
    await user.save();
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("Admin update user error:", err);
    res.status(500).json({ error: "Errore aggiornamento associato." });
  }
});
router.delete("/admin/posts/:id", requireAuth, requirePresident, async (req, res) => {
  try {
    await Post.deleteOne({ _id: req.params.id });
    res.json({ deleted: true });
  } catch (err) {
    console.error("Admin delete post error:", err);
    res.status(500).json({ error: "Errore eliminazione post." });
  }
});
router.delete(
  "/admin/posts/:postId/comments/:commentId",
  requireAuth,
  requirePresident,
  async (req, res) => {
    try {
      await Post.updateOne(
        { _id: req.params.postId },
        { $pull: { comments: { _id: req.params.commentId } } }
      );
      res.json({ deleted: true });
    } catch (err) {
      console.error("Admin delete comment error:", err);
      res.status(500).json({ error: "Errore moderazione commento." });
    }
  }
);
var routes_default = router;

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3e3;
  const isProd = process.env.NODE_ENV === "production";
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  await connectMongo();
  app.use("/api", routes_default);
  app.use("/api/*", (_req, res) => {
    res.status(404).json({ error: "Endpoint API non trovato." });
  });
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const parentDist = path.resolve(__dirname, "..", "dist");
    const localDist = path.resolve(__dirname, "dist");
    const resolvedDist = fs.existsSync(parentDist) ? parentDist : fs.existsSync(localDist) ? localDist : path.resolve(process.cwd(), "dist");
    app.use(express.static(resolvedDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(resolvedDist, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FantaJESic server running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start FantaJESic server:", err);
  process.exit(1);
});
