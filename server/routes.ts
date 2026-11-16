import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import mongoose, { Types } from 'mongoose';
import {
  ActivityEvent,
  Challenge,
  ChallengeProposal,
  IUser,
  Notification,
  PointTransaction,
  Post,
  Regulation,
  Season,
  User,
  Vote,
} from './models';
import {
  configureCloudinary,
  connectMongo,
  getDbStatus,
  isCloudinaryConfigured,
} from './db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fantajesic-jwt-secret-set-in-env';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for video/photo
});

interface AuthedRequest extends Request {
  user?: IUser;
}

function sanitizeUser(user: IUser) {
  return {
    _id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    area: user.area,
    boardRole: user.boardRole || '',
    avatarUrl: user.avatarUrl || '',
    bio: user.bio || '',
    role: user.role,
    badges: user.badges || [],
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

async function requireDb(_req: Request, res: Response, next: NextFunction) {
  const connected = await connectMongo();
  if (!connected) {
    res.status(503).json({
      error:
        'MongoDB Atlas non è ancora connesso. Configura la variabile MONGODB_URI nel pannello Secrets o su Render.',
      code: 'DB_UNAVAILABLE',
      db: getDbStatus(),
    });
    return;
  }
  next();
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) {
      res.status(401).json({ error: 'Autenticazione richiesta.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string };
    if (!decoded?.userId) {
      res.status(401).json({ error: 'Token non valido.' });
      return;
    }

    // ALWAYS fetch live user from MongoDB so manual role edits (associate -> president) take effect immediately
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Account non trovato o disattivato.' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Sessione scaduta o non valida. Effettua nuovamente il login.' });
  }
}

function requirePresident(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'president') {
    res.status(403).json({
      error: 'Accesso negato: questa operazione è riservata al Presidente.',
    });
    return;
  }
  next();
}

async function getActiveSeason() {
  let active = await Season.findOne({ status: 'active' }).sort({ startDate: -1 });
  if (!active) {
    active = await Season.create({
      name: 'Stagione 2026/2027',
      description: 'Stagione ufficiale FantaJESic',
      status: 'active',
      startDate: new Date(),
    });
  }
  return active;
}

async function syncExpiredChallenges() {
  const now = new Date();
  const expired = await Challenge.find({
    status: 'active',
    hasTimer: true,
    deadline: { $lte: now },
  });

  for (const ch of expired) {
    ch.status = 'evaluating';
    await ch.save();

    await ActivityEvent.create({
      type: 'challenge_completed',
      challengeId: ch._id,
      seasonId: ch.seasonId,
      message: `La sfida "${ch.title}" ha raggiunto la scadenza ed è ora in valutazione.`,
    });

    const participantIds = ch.participants.map((p: Types.ObjectId) => String(p));
    if (participantIds.length > 0) {
      await Notification.insertMany(
        participantIds.map((uid: string) => ({
          userId: uid,
          type: 'challenge_ended',
          title: 'Sfida terminata',
          body: `Il tempo per "${ch.title}" è scaduto. Inizia la fase di valutazione!`,
          linkTab: 'challenges',
          linkId: String(ch._id),
        }))
      );
    }
  }
}

async function computeSeasonLeaderboard(seasonId: Types.ObjectId | string) {
  const sid = typeof seasonId === 'string' ? new Types.ObjectId(seasonId) : seasonId;
  const [users, sums] = await Promise.all([
    User.find({ isActive: true }).sort({ createdAt: 1 }).lean(),
    PointTransaction.aggregate([
      { $match: { seasonId: sid } },
      { $group: { _id: '$recipientId', totalPoints: { $sum: '$amount' } } },
    ]),
  ]);

  const pointsMap = new Map<string, number>();
  for (const row of sums) {
    pointsMap.set(String(row._id), Number(row.totalPoints) || 0);
  }

  const entries = users.map((u) => ({
    userId: String(u._id),
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`.trim(),
    area: u.area,
    boardRole: u.boardRole || '',
    avatarUrl: u.avatarUrl || '',
    role: u.role,
    badges: u.badges || [],
    points: pointsMap.get(String(u._id)) ?? 0,
  }));

  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.fullName.localeCompare(b.fullName, 'it');
  });

  return entries.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: 'auto' | 'image' | 'video' = 'auto'
): Promise<{ url: string; publicId: string; resourceType: 'image' | 'video' }> {
  const cld = configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (err, result) => {
        if (err || !result) {
          reject(err || new Error('Upload Cloudinary fallito.'));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type === 'video' ? 'video' : 'image',
        });
      }
    );
    stream.end(buffer);
  });
}

// -----------------------------------------------------------------------------
// HEALTH & STATUS (Does not block on DB)
// -----------------------------------------------------------------------------
router.get('/health', async (_req: Request, res: Response) => {
  await connectMongo();
  res.json({
    ok: true,
    service: 'FantaJESic API',
    db: getDbStatus(),
  });
});

// -----------------------------------------------------------------------------
// CLOUDINARY UPLOAD (Public avatar during registration + Authenticated media)
// -----------------------------------------------------------------------------
router.post('/upload/avatar', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({
        error:
          'Cloudinary non configurato. Imposta CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.',
        code: 'CLOUDINARY_UNAVAILABLE',
      });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Nessun file selezionato.' });
      return;
    }
    if (!req.file.mimetype.startsWith('image/')) {
      res.status(400).json({ error: 'La foto profilo deve essere un immagine.' });
      return;
    }
    const result = await uploadBufferToCloudinary(req.file.buffer, 'fantajesic/avatars', 'image');
    res.json(result);
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Errore durante il caricamento su Cloudinary.' });
  }
});

// All routes below require MongoDB Atlas connection
router.use(requireDb);

router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (!isCloudinaryConfigured()) {
        res.status(503).json({
          error:
            'Cloudinary non configurato. Imposta CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.',
          code: 'CLOUDINARY_UNAVAILABLE',
        });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Nessun file allegato.' });
        return;
      }
      const isImage = req.file.mimetype.startsWith('image/');
      const isVideo = req.file.mimetype.startsWith('video/');
      if (!isImage && !isVideo) {
        res.status(400).json({ error: 'Sono supportate solo immagini e video.' });
        return;
      }
      const result = await uploadBufferToCloudinary(
        req.file.buffer,
        'fantajesic/media',
        isVideo ? 'video' : 'image'
      );
      res.json(result);
    } catch (err) {
      console.error('Media upload error:', err);
      res.status(500).json({ error: 'Errore durante il caricamento media su Cloudinary.' });
    }
  }
);

// -----------------------------------------------------------------------------
// AUTHENTICATION & LIVE ROLE SYNC
// -----------------------------------------------------------------------------
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, area, boardRole, avatarUrl, avatarPublicId } =
      req.body || {};

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password || !area?.trim()) {
      res.status(400).json({
        error: 'Compila tutti i campi obbligatori: nome, cognome, email, password e area.',
      });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({ error: 'La password deve contenere almeno 6 caratteri.' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ error: 'Esiste già un account associato a questa email.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    // CRITICAL RULE: Every registered account starts as 'associate'. Role cannot be chosen at signup.
    const user = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: normalizedEmail,
      passwordHash,
      area: String(area).trim(),
      boardRole: boardRole ? String(boardRole).trim() : '',
      avatarUrl: avatarUrl ? String(avatarUrl).trim() : '',
      avatarPublicId: avatarPublicId ? String(avatarPublicId).trim() : '',
      role: 'associate',
    });

    const activeSeason = await getActiveSeason();
    await ActivityEvent.create({
      type: 'member_joined',
      actorId: user._id,
      seasonId: activeSeason._id,
      message: `${user.firstName} ${user.lastName} (${user.area}) è entrato in FantaJESic!`,
    });

    const token = signToken(String(user._id));
    res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Errore durante la registrazione.' });
  }
});

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      res.status(400).json({ error: 'Inserisci email e password.' });
      return;
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) {
      res.status(401).json({ error: 'Credenziali non valide.' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: 'Questo account è stato sospeso dal Presidente.' });
      return;
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Credenziali non valide.' });
      return;
    }

    const token = signToken(String(user._id));
    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Errore durante il login.' });
  }
});

router.get('/auth/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user!;
    const activeSeason = await getActiveSeason();
    const [unreadNotifications, leaderboard] = await Promise.all([
      Notification.countDocuments({ userId: user._id, isRead: false }),
      computeSeasonLeaderboard(activeSeason._id),
    ]);

    const myStanding = leaderboard.find((e) => e.userId === String(user._id));
    res.json({
      user: sanitizeUser(user),
      unreadNotifications,
      activeSeason: {
        _id: String(activeSeason._id),
        name: activeSeason.name,
        startDate: activeSeason.startDate,
      },
      myPoints: myStanding?.points ?? 0,
      myRank: myStanding?.rank ?? null,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Impossibile verificare la sessione.' });
  }
});

// -----------------------------------------------------------------------------
// USERS & PROFILES
// -----------------------------------------------------------------------------
router.get('/users', requireAuth, async (_req: AuthedRequest, res: Response) => {
  try {
    const activeSeason = await getActiveSeason();
    const standings = await computeSeasonLeaderboard(activeSeason._id);
    res.json({ users: standings, seasonName: activeSeason.name });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Errore nel caricamento degli associati.' });
  }
});

router.get('/users/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'ID utente non valido.' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: 'Associato non trovato.' });
      return;
    }

    const activeSeason = await getActiveSeason();
    const [standings, posts, transactions] = await Promise.all([
      computeSeasonLeaderboard(activeSeason._id),
      Post.find({ authorId: user._id })
        .sort({ createdAt: -1 })
        .populate('authorId', 'firstName lastName area boardRole avatarUrl role')
        .populate('challengeId', 'title status')
        .populate('comments.authorId', 'firstName lastName avatarUrl')
        .lean(),
      PointTransaction.find({ recipientId: user._id })
        .sort({ createdAt: -1 })
        .populate('awardedBy', 'firstName lastName')
        .populate('challengeId', 'title')
        .populate('seasonId', 'name')
        .lean(),
    ]);

    const standing = standings.find((s) => s.userId === String(user._id));
    res.json({
      profile: {
        ...sanitizeUser(user),
        points: standing?.points ?? 0,
        rank: standing?.rank ?? null,
        totalMembers: standings.length,
      },
      posts,
      transactions,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Errore nel caricamento del profilo.' });
  }
});

router.patch('/users/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { firstName, lastName, area, boardRole, bio, avatarUrl, avatarPublicId } = req.body || {};
    const user = req.user!;

    if (firstName?.trim()) user.firstName = String(firstName).trim();
    if (lastName?.trim()) user.lastName = String(lastName).trim();
    if (area?.trim()) user.area = String(area).trim();
    if (boardRole !== undefined) user.boardRole = String(boardRole).trim();
    if (bio !== undefined) user.bio = String(bio).trim();
    if (avatarUrl !== undefined) user.avatarUrl = String(avatarUrl).trim();
    if (avatarPublicId !== undefined) user.avatarPublicId = String(avatarPublicId).trim();

    await user.save();
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Errore durante aggiornamento profilo.' });
  }
});

// -----------------------------------------------------------------------------
// SOCIAL FEED & POSTS
// -----------------------------------------------------------------------------
router.get('/posts', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    await syncExpiredChallenges();
    const { challengeId, authorId, filter } = req.query;
    const query: Record<string, unknown> = {};

    if (challengeId && mongoose.isValidObjectId(String(challengeId))) {
      query.challengeId = String(challengeId);
    } else if (filter === 'challenges') {
      query.challengeId = { $ne: null };
    } else if (filter === 'community') {
      query.challengeId = null;
    }

    if (authorId && mongoose.isValidObjectId(String(authorId))) {
      query.authorId = String(authorId);
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(80)
      .populate('authorId', 'firstName lastName area boardRole avatarUrl role badges')
      .populate('challengeId', 'title status participationMode pointsReward')
      .populate('comments.authorId', 'firstName lastName avatarUrl role')
      .lean();

    res.json({ posts });
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ error: 'Errore nel caricamento del feed.' });
  }
});

router.post('/posts', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    await syncExpiredChallenges();
    const { caption, mediaUrl, mediaPublicId, mediaType, challengeId } = req.body || {};
    const user = req.user!;

    if (!caption?.trim() && !mediaUrl?.trim()) {
      res.status(400).json({ error: 'Inserisci un testo oppure carica una foto o un video.' });
      return;
    }

    const activeSeason = await getActiveSeason();
    let linkedChallenge = null;

    if (challengeId) {
      if (!mongoose.isValidObjectId(challengeId)) {
        res.status(400).json({ error: 'Sfida non valida.' });
        return;
      }
      linkedChallenge = await Challenge.findById(challengeId);
      if (!linkedChallenge) {
        res.status(404).json({ error: 'Sfida non trovata.' });
        return;
      }
      if (linkedChallenge.status !== 'active') {
        res.status(400).json({
          error: 'La partecipazione a questa sfida è chiusa. Non è più possibile inviare contributi.',
        });
        return;
      }
      if (linkedChallenge.hasTimer && linkedChallenge.deadline && new Date() >= linkedChallenge.deadline) {
        res.status(400).json({ error: 'La sfida è scaduta.' });
        return;
      }

      const isParticipant = linkedChallenge.participants.some(
        (p: Types.ObjectId) => String(p) === String(user._id)
      );

      if (linkedChallenge.participationMode === 'selected' && !isParticipant) {
        res.status(403).json({
          error: 'Questa sfida è riservata ai partecipanti selezionati dal Presidente.',
        });
        return;
      }
      if (linkedChallenge.participationMode === 'registration' && !isParticipant) {
        res.status(403).json({
          error: 'Devi prima iscriverti alla sfida per poter caricare un contenuto.',
        });
        return;
      }
      if (linkedChallenge.participationMode === 'open' && !isParticipant) {
        linkedChallenge.participants.push(user._id);
        await linkedChallenge.save();
      }
    }

    const created = await Post.create({
      authorId: user._id,
      caption: caption ? String(caption).trim() : '',
      mediaUrl: mediaUrl ? String(mediaUrl).trim() : '',
      mediaPublicId: mediaPublicId ? String(mediaPublicId).trim() : '',
      mediaType: mediaUrl ? (mediaType === 'video' ? 'video' : 'image') : 'none',
      challengeId: linkedChallenge ? linkedChallenge._id : undefined,
      seasonId: linkedChallenge ? linkedChallenge.seasonId : activeSeason._id,
    });

    const populated = await Post.findById(created._id)
      .populate('authorId', 'firstName lastName area boardRole avatarUrl role badges')
      .populate('challengeId', 'title status participationMode pointsReward')
      .populate('comments.authorId', 'firstName lastName avatarUrl role')
      .lean();

    res.status(201).json({ post: populated });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Errore nella pubblicazione del post.' });
  }
});

router.post('/posts/:id/like', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ error: 'Post non trovato.' });
      return;
    }

    const userId = String(req.user!._id);
    const alreadyLiked = post.likes.some((l: Types.ObjectId) => String(l) === userId);
    if (alreadyLiked) {
      post.likes = post.likes.filter((l: Types.ObjectId) => String(l) !== userId);
    } else {
      post.likes.push(req.user!._id);
      if (String(post.authorId) !== userId) {
        await Notification.create({
          userId: post.authorId,
          type: 'like',
          title: 'Nuovo like al tuo post',
          body: `${req.user!.firstName} ${req.user!.lastName} ha messo Mi piace al tuo contenuto.`,
          linkTab: 'feed',
          linkId: String(post._id),
        });
      }
    }

    await post.save();
    res.json({ likes: post.likes.map(String), liked: !alreadyLiked });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Errore durante il like.' });
  }
});

router.post('/posts/:id/comments', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text } = req.body || {};
    if (!text?.trim()) {
      res.status(400).json({ error: 'Scrivi un commento prima di inviare.' });
      return;
    }

    const post = await Post.findById(id);
    if (!post) {
      res.status(404).json({ error: 'Post non trovato.' });
      return;
    }

    post.comments.push({
      _id: new Types.ObjectId(),
      authorId: req.user!._id as Types.ObjectId,
      text: String(text).trim(),
      createdAt: new Date(),
    });
    await post.save();

    if (String(post.authorId) !== String(req.user!._id)) {
      await Notification.create({
        userId: post.authorId,
        type: 'comment',
        title: 'Nuovo commento',
        body: `${req.user!.firstName} ${req.user!.lastName} ha commentato: "${String(text).trim().slice(0, 60)}"`,
        linkTab: 'feed',
        linkId: String(post._id),
      });
    }

    const updated = await Post.findById(post._id)
      .populate('comments.authorId', 'firstName lastName avatarUrl role')
      .lean();
    res.status(201).json({ comments: updated?.comments ?? [] });
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ error: 'Errore durante aggiunta commento.' });
  }
});

router.delete('/posts/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Post non trovato.' });
      return;
    }
    const isOwner = String(post.authorId) === String(req.user!._id);
    const isPresident = req.user!.role === 'president';
    if (!isOwner && !isPresident) {
      res.status(403).json({ error: 'Non hai i permessi per eliminare questo post.' });
      return;
    }

    await Post.deleteOne({ _id: post._id });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Errore eliminazione post.' });
  }
});

// -----------------------------------------------------------------------------
// CHALLENGES & VOTING
// -----------------------------------------------------------------------------
router.get('/challenges', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    await syncExpiredChallenges();
    const { seasonId, status } = req.query;
    const query: Record<string, unknown> = {};
    if (seasonId && mongoose.isValidObjectId(String(seasonId))) {
      query.seasonId = String(seasonId);
    }
    if (status && ['active', 'evaluating', 'voting', 'completed'].includes(String(status))) {
      query.status = String(status);
    }

    const challenges = await Challenge.find(query)
      .sort({ createdAt: -1 })
      .populate('participants', 'firstName lastName area avatarUrl')
      .populate('winnerIds', 'firstName lastName area avatarUrl')
      .populate('seasonId', 'name status')
      .populate('createdBy', 'firstName lastName')
      .lean();

    const challengeIds = challenges.map((c) => c._id);
    const [submissionCounts, userVotes] = await Promise.all([
      Post.aggregate([
        { $match: { challengeId: { $in: challengeIds } } },
        { $group: { _id: '$challengeId', count: { $sum: 1 } } },
      ]),
      Vote.find({ challengeId: { $in: challengeIds }, voterId: req.user!._id }).lean(),
    ]);

    const subMap = new Map<string, number>();
    for (const s of submissionCounts) subMap.set(String(s._id), s.count);
    const votedSet = new Set(userVotes.map((v) => String(v.challengeId)));

    res.json({
      challenges: challenges.map((c) => ({
        ...c,
        submissionsCount: subMap.get(String(c._id)) ?? 0,
        hasVoted: votedSet.has(String(c._id)),
      })),
    });
  } catch (err) {
    console.error('List challenges error:', err);
    res.status(500).json({ error: 'Errore caricamento sfide.' });
  }
});

router.get('/challenges/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    await syncExpiredChallenges();
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'ID sfida non valido.' });
      return;
    }

    const challenge = await Challenge.findById(id)
      .populate('participants', 'firstName lastName area boardRole avatarUrl role')
      .populate('winnerIds', 'firstName lastName area avatarUrl')
      .populate('seasonId', 'name status')
      .populate('createdBy', 'firstName lastName')
      .lean();

    if (!challenge) {
      res.status(404).json({ error: 'Sfida non trovata.' });
      return;
    }

    const [submissions, votes, myVote] = await Promise.all([
      Post.find({ challengeId: challenge._id })
        .sort({ createdAt: -1 })
        .populate('authorId', 'firstName lastName area boardRole avatarUrl role badges')
        .populate('comments.authorId', 'firstName lastName avatarUrl role')
        .lean(),
      Vote.find({ challengeId: challenge._id })
        .populate('targetUserId', 'firstName lastName area avatarUrl')
        .lean(),
      Vote.findOne({ challengeId: challenge._id, voterId: req.user!._id }).lean(),
    ]);

    // Tally votes per targetUserId & targetPostId
    const tallyMap = new Map<
      string,
      { targetUserId: string; fullName: string; avatarUrl: string; area: string; count: number; targetPostId?: string }
    >();

    for (const v of votes) {
      const target = v.targetUserId as unknown as {
        _id: Types.ObjectId;
        firstName: string;
        lastName: string;
        avatarUrl?: string;
        area?: string;
      };
      if (!target) continue;
      const key = String(target._id);
      const existing = tallyMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        tallyMap.set(key, {
          targetUserId: key,
          fullName: `${target.firstName} ${target.lastName}`.trim(),
          avatarUrl: target.avatarUrl || '',
          area: target.area || '',
          count: 1,
          targetPostId: v.targetPostId ? String(v.targetPostId) : undefined,
        });
      }
    }

    const voteTallies = Array.from(tallyMap.values()).sort((a, b) => b.count - a.count);

    // Determine if current user is eligible to vote
    const uid = String(req.user!._id);
    const participantIds = new Set(
      (challenge.participants as Array<{ _id: Types.ObjectId }>).map((p) => String(p._id))
    );
    const isParticipant = participantIds.has(uid);
    let canVote = challenge.status === 'voting' && !myVote;
    if (challenge.votingDeadline && new Date() >= new Date(challenge.votingDeadline)) {
      canVote = false;
    }
    if (canVote) {
      if (challenge.voterScope === 'participants' && !isParticipant) canVote = false;
      if (challenge.voterScope === 'non_participants' && isParticipant) canVote = false;
    }

    res.json({
      challenge,
      submissions,
      voteTallies,
      totalVotes: votes.length,
      myVote: myVote
        ? {
            targetUserId: String(myVote.targetUserId),
            targetPostId: myVote.targetPostId ? String(myVote.targetPostId) : undefined,
          }
        : null,
      canVote,
    });
  } catch (err) {
    console.error('Get challenge detail error:', err);
    res.status(500).json({ error: 'Errore caricamento dettaglio sfida.' });
  }
});

router.post('/challenges', requireAuth, requirePresident, async (req: AuthedRequest, res: Response) => {
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
      deadline,
    } = req.body || {};

    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ error: 'Titolo e descrizione sono obbligatori.' });
      return;
    }

    const activeSeason = seasonId ? await Season.findById(seasonId) : await getActiveSeason();
    if (!activeSeason) {
      res.status(404).json({ error: 'Stagione non trovata.' });
      return;
    }

    const useTimer = Boolean(hasTimer && deadline);
    if (useTimer && new Date(deadline) <= new Date()) {
      res.status(400).json({ error: 'La data di scadenza deve essere futura.' });
      return;
    }

    const challenge = await Challenge.create({
      title: String(title).trim(),
      description: String(description).trim(),
      coverImageUrl: coverImageUrl ? String(coverImageUrl).trim() : '',
      coverPublicId: coverPublicId ? String(coverPublicId).trim() : '',
      seasonId: activeSeason._id,
      participationMode: participationMode || 'open',
      participants: Array.isArray(participants) ? participants : [],
      evaluationMode: evaluationMode || 'vote',
      voterScope: voterScope || 'all',
      pointsReward: Number(pointsReward) >= 0 ? Number(pointsReward) : 50,
      secondaryPointsReward: Number(secondaryPointsReward) >= 0 ? Number(secondaryPointsReward) : 0,
      hasTimer: useTimer,
      deadline: useTimer ? new Date(deadline) : undefined,
      status: 'active',
      createdBy: req.user!._id,
    });

    await ActivityEvent.create({
      type: 'challenge_created',
      actorId: req.user!._id,
      challengeId: challenge._id,
      seasonId: activeSeason._id,
      message: `Nuova sfida pubblicata: "${challenge.title}" (+${challenge.pointsReward} pt in palio).`,
    });

    const activeUsers = await User.find({ isActive: true, _id: { $ne: req.user!._id } }).select('_id');
    if (activeUsers.length > 0) {
      await Notification.insertMany(
        activeUsers.map((u) => ({
          userId: u._id,
          type: 'new_challenge',
          title: 'Nuova sfida disponibile!',
          body: `"${challenge.title}" · Premio in palio: ${challenge.pointsReward} punti.`,
          linkTab: 'challenges',
          linkId: String(challenge._id),
        }))
      );
    }

    res.status(201).json({ challenge });
  } catch (err) {
    console.error('Create challenge error:', err);
    res.status(500).json({ error: 'Errore creazione sfida.' });
  }
});

router.patch('/challenges/:id', requireAuth, requirePresident, async (req: AuthedRequest, res: Response) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      res.status(404).json({ error: 'Sfida non trovata.' });
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
      deadline,
    } = req.body || {};

    if (title?.trim()) challenge.title = String(title).trim();
    if (description?.trim()) challenge.description = String(description).trim();
    if (participationMode) challenge.participationMode = participationMode;
    if (Array.isArray(participants)) challenge.participants = participants;
    if (evaluationMode) challenge.evaluationMode = evaluationMode;
    if (voterScope) challenge.voterScope = voterScope;
    if (pointsReward !== undefined) challenge.pointsReward = Number(pointsReward);
    if (secondaryPointsReward !== undefined)
      challenge.secondaryPointsReward = Number(secondaryPointsReward);
    if (hasTimer !== undefined) {
      challenge.hasTimer = Boolean(hasTimer);
      challenge.deadline = hasTimer && deadline ? new Date(deadline) : undefined;
    }

    await challenge.save();
    res.json({ challenge });
  } catch (err) {
    console.error('Update challenge error:', err);
    res.status(500).json({ error: 'Errore aggiornamento sfida.' });
  }
});

router.post('/challenges/:id/join', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    await syncExpiredChallenges();
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      res.status(404).json({ error: 'Sfida non trovata.' });
      return;
    }
    if (challenge.status !== 'active') {
      res.status(400).json({ error: 'Le iscrizioni a questa sfida sono chiuse.' });
      return;
    }
    if (challenge.participationMode === 'selected') {
      res.status(403).json({
        error: 'I partecipanti di questa sfida vengono selezionati direttamente dal Presidente.',
      });
      return;
    }

    const uid = String(req.user!._id);
    const alreadyJoined = challenge.participants.some((p: Types.ObjectId) => String(p) === uid);
    if (!alreadyJoined) {
      challenge.participants.push(req.user!._id);
      await challenge.save();
    }
    res.json({ joined: true, participantsCount: challenge.participants.length });
  } catch (err) {
    console.error('Join challenge error:', err);
    res.status(500).json({ error: 'Errore durante iscrizione alla sfida.' });
  }
});

router.post('/challenges/:id/close', requireAuth, requirePresident, async (req: AuthedRequest, res: Response) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      res.status(404).json({ error: 'Sfida non trovata.' });
      return;
    }
    challenge.status = 'evaluating';
    await challenge.save();

    await ActivityEvent.create({
      type: 'challenge_completed',
      actorId: req.user!._id,
      challengeId: challenge._id,
      seasonId: challenge.seasonId,
      message: `Le partecipazioni per "${challenge.title}" sono state chiuse dal Presidente.`,
    });

    res.json({ challenge });
  } catch (err) {
    console.error('Close challenge error:', err);
    res.status(500).json({ error: 'Errore chiusura sfida.' });
  }
});

router.post(
  '/challenges/:id/start-voting',
  requireAuth,
  requirePresident,
  async (req: AuthedRequest, res: Response) => {
    try {
      const challenge = await Challenge.findById(req.params.id);
      if (!challenge) {
        res.status(404).json({ error: 'Sfida non trovata.' });
        return;
      }
      const { voterScope, votingDeadline } = req.body || {};
      if (voterScope) challenge.voterScope = voterScope;
      challenge.votingDeadline = votingDeadline ? new Date(votingDeadline) : undefined;
      challenge.status = 'voting';
      await challenge.save();

      await ActivityEvent.create({
        type: 'voting_opened',
        actorId: req.user!._id,
        challengeId: challenge._id,
        seasonId: challenge.seasonId,
        message: `Aperta la votazione per la sfida "${challenge.title}"!`,
      });

      const activeUsers = await User.find({ isActive: true }).select('_id');
      if (activeUsers.length > 0) {
        await Notification.insertMany(
          activeUsers.map((u) => ({
            userId: u._id,
            type: 'voting_started',
            title: 'Votazione aperta!',
            body: `Puoi votare nella sfida "${challenge.title}".`,
            linkTab: 'challenges',
            linkId: String(challenge._id),
          }))
        );
      }

      res.json({ challenge });
    } catch (err) {
      console.error('Start voting error:', err);
      res.status(500).json({ error: 'Errore apertura votazione.' });
    }
  }
);

router.post('/challenges/:id/vote', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      res.status(404).json({ error: 'Sfida non trovata.' });
      return;
    }
    if (challenge.status !== 'voting') {
      res.status(400).json({ error: 'La votazione per questa sfida non è attiva.' });
      return;
    }
    if (challenge.votingDeadline && new Date() >= challenge.votingDeadline) {
      res.status(400).json({ error: 'Il tempo per votare è scaduto.' });
      return;
    }

    const uid = String(req.user!._id);
    const isParticipant = challenge.participants.some((p: Types.ObjectId) => String(p) === uid);
    if (challenge.voterScope === 'participants' && !isParticipant) {
      res.status(403).json({ error: 'Solo i partecipanti iscritti possono votare in questa sfida.' });
      return;
    }
    if (challenge.voterScope === 'non_participants' && isParticipant) {
      res.status(403).json({ error: 'In questa sfida votano solo gli associati non partecipanti.' });
      return;
    }

    const { targetUserId, targetPostId } = req.body || {};
    if (!targetUserId || !mongoose.isValidObjectId(targetUserId)) {
      res.status(400).json({ error: 'Seleziona un partecipante valido da votare.' });
      return;
    }

    const existingVote = await Vote.findOne({ challengeId: challenge._id, voterId: req.user!._id });
    if (existingVote) {
      res.status(409).json({ error: 'Hai già espresso il tuo voto per questa sfida.' });
      return;
    }

    const vote = await Vote.create({
      challengeId: challenge._id,
      voterId: req.user!._id,
      targetUserId,
      targetPostId: targetPostId && mongoose.isValidObjectId(targetPostId) ? targetPostId : undefined,
    });

    res.status(201).json({ vote });
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Errore durante la registrazione del voto.' });
  }
});

router.post(
  '/challenges/:id/confirm-winner',
  requireAuth,
  requirePresident,
  async (req: AuthedRequest, res: Response) => {
    try {
      const challenge = await Challenge.findById(req.params.id);
      if (!challenge) {
        res.status(404).json({ error: 'Sfida non trovata.' });
        return;
      }

      // awards: Array<{ userId: string; points: number; reason?: string; badge?: string }>
      const { awards, winnerIds, winningPostId } = req.body || {};

      if (challenge.pointsDistributed) {
        res.status(400).json({ error: 'I punti per questa sfida sono già stati assegnati.' });
        return;
      }

      const resolvedAwards: Array<{ userId: string; points: number; reason: string; badge?: string }> =
        Array.isArray(awards)
          ? awards.filter((a) => a?.userId && Number(a.points) !== 0)
          : Array.isArray(winnerIds)
          ? winnerIds.map((uid: string) => ({
              userId: uid,
              points: challenge.pointsReward,
              reason: `Vincitore sfida "${challenge.title}"`,
            }))
          : [];

      const finalWinnerIds =
        Array.isArray(winnerIds) && winnerIds.length > 0
          ? winnerIds
          : resolvedAwards.map((a) => a.userId);

      challenge.winnerIds = finalWinnerIds;
      if (winningPostId && mongoose.isValidObjectId(winningPostId)) {
        challenge.winningPostId = winningPostId;
      }
      challenge.status = 'completed';
      challenge.pointsDistributed = true;
      await challenge.save();

      for (const item of resolvedAwards) {
        await PointTransaction.create({
          seasonId: challenge.seasonId,
          recipientId: item.userId,
          awardedBy: req.user!._id,
          amount: Number(item.points),
          reason: item.reason || `Premio sfida "${challenge.title}"`,
          challengeId: challenge._id,
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
            type: 'points_awarded',
            actorId: req.user!._id,
            targetUserId: recipient._id,
            challengeId: challenge._id,
            seasonId: challenge.seasonId,
            pointsDelta: Number(item.points),
            message: `${recipient.firstName} ${recipient.lastName} ha conquistato ${
              Number(item.points) > 0 ? `+${item.points}` : item.points
            } pt nella sfida "${challenge.title}"!`,
          });

          await Notification.create({
            userId: recipient._id,
            type: 'points_awarded',
            title: 'Punti assegnati!',
            body: `Hai ricevuto ${Number(item.points) > 0 ? `+${item.points}` : item.points} pt per "${challenge.title}".`,
            linkTab: 'leaderboard',
            linkId: String(challenge._id),
          });
        }
      }

      res.json({ challenge });
    } catch (err) {
      console.error('Confirm winner error:', err);
      res.status(500).json({ error: 'Errore nella proclamazione dei vincitori.' });
    }
  }
);

// -----------------------------------------------------------------------------
// CHALLENGE PROPOSALS
// -----------------------------------------------------------------------------
router.get('/proposals', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const query =
      req.user!.role === 'president' ? {} : { proposedBy: req.user!._id };
    const proposals = await ChallengeProposal.find(query)
      .sort({ createdAt: -1 })
      .populate('proposedBy', 'firstName lastName area avatarUrl')
      .populate('reviewedBy', 'firstName lastName')
      .lean();
    res.json({ proposals });
  } catch (err) {
    console.error('Get proposals error:', err);
    res.status(500).json({ error: 'Errore caricamento proposte.' });
  }
});

router.post('/proposals', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const {
      title,
      description,
      suggestedPoints,
      suggestedParticipationMode,
      suggestedEvaluationMode,
    } = req.body || {};

    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ error: 'Titolo e descrizione della proposta sono obbligatori.' });
      return;
    }

    const proposal = await ChallengeProposal.create({
      title: String(title).trim(),
      description: String(description).trim(),
      suggestedPoints: Number(suggestedPoints) >= 0 ? Number(suggestedPoints) : 50,
      suggestedParticipationMode: suggestedParticipationMode || 'open',
      suggestedEvaluationMode: suggestedEvaluationMode || 'vote',
      proposedBy: req.user!._id,
      status: 'pending',
    });

    res.status(201).json({ proposal });
  } catch (err) {
    console.error('Create proposal error:', err);
    res.status(500).json({ error: 'Errore invio proposta.' });
  }
});

router.patch('/proposals/:id', requireAuth, requirePresident, async (req: AuthedRequest, res: Response) => {
  try {
    const proposal = await ChallengeProposal.findById(req.params.id);
    if (!proposal) {
      res.status(404).json({ error: 'Proposta non trovata.' });
      return;
    }
    if (proposal.status !== 'pending') {
      res.status(400).json({ error: 'Questa proposta è già stata valutata.' });
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
      deadline,
    } = req.body || {};

    if (action !== 'approve' && action !== 'reject') {
      res.status(400).json({ error: 'Azione non valida (approve o reject).' });
      return;
    }

    proposal.status = action === 'approve' ? 'approved' : 'rejected';
    proposal.presidentNote = presidentNote ? String(presidentNote).trim() : '';
    proposal.reviewedBy = req.user!._id;
    proposal.reviewedAt = new Date();

    let createdChallenge = null;
    if (action === 'approve') {
      const activeSeason = await getActiveSeason();
      const useTimer = Boolean(hasTimer && deadline);

      createdChallenge = await Challenge.create({
        title: title?.trim() || proposal.title,
        description: description?.trim() || proposal.description,
        seasonId: activeSeason._id,
        participationMode: participationMode || proposal.suggestedParticipationMode,
        evaluationMode: evaluationMode || proposal.suggestedEvaluationMode,
        voterScope: voterScope || 'all',
        pointsReward:
          pointsReward !== undefined ? Number(pointsReward) : proposal.suggestedPoints,
        hasTimer: useTimer,
        deadline: useTimer ? new Date(deadline) : undefined,
        status: 'active',
        createdBy: req.user!._id,
      });

      proposal.linkedChallengeId = createdChallenge._id;

      await ActivityEvent.create({
        type: 'challenge_created',
        actorId: req.user!._id,
        challengeId: createdChallenge._id,
        seasonId: activeSeason._id,
        message: `Approvata e pubblicata la sfida "${createdChallenge.title}"!`,
      });

      await Notification.create({
        userId: proposal.proposedBy,
        type: 'proposal_approved',
        title: 'Proposta approvata!',
        body: `La tua proposta "${proposal.title}" è stata approvata e pubblicata tra le sfide!`,
        linkTab: 'challenges',
        linkId: String(createdChallenge._id),
      });
    } else {
      await Notification.create({
        userId: proposal.proposedBy,
        type: 'proposal_rejected',
        title: 'Proposta non approvata',
        body: proposal.presidentNote
          ? `La proposta "${proposal.title}" non è stata approvata: ${proposal.presidentNote}`
          : `La proposta "${proposal.title}" non è stata approvata dal Presidente.`,
        linkTab: 'challenges',
      });
    }

    await proposal.save();
    res.json({ proposal, challenge: createdChallenge });
  } catch (err) {
    console.error('Review proposal error:', err);
    res.status(500).json({ error: 'Errore nella valutazione della proposta.' });
  }
});

// -----------------------------------------------------------------------------
// POINTS, LEADERBOARD & SEASONS
// -----------------------------------------------------------------------------
router.get('/leaderboard', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const seasons = await Season.find().sort({ startDate: -1 }).lean();
    const activeSeason = seasons.find((s) => s.status === 'active') || (await getActiveSeason());
    const requestedSeasonId = req.query.seasonId
      ? String(req.query.seasonId)
      : String(activeSeason._id);

    const selectedSeason = seasons.find((s) => String(s._id) === requestedSeasonId) || activeSeason;

    let standings;
    if (selectedSeason.status === 'archived' && selectedSeason.finalStandings?.length > 0) {
      standings = selectedSeason.finalStandings;
    } else {
      standings = await computeSeasonLeaderboard(selectedSeason._id);
    }

    res.json({
      season: selectedSeason,
      seasons,
      standings,
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Errore caricamento classifica.' });
  }
});

router.get('/points/history', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { seasonId, userId } = req.query;
    const query: Record<string, unknown> = {};
    if (seasonId && mongoose.isValidObjectId(String(seasonId))) {
      query.seasonId = String(seasonId);
    }
    if (userId && mongoose.isValidObjectId(String(userId))) {
      query.recipientId = String(userId);
    }

    const transactions = await PointTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(120)
      .populate('recipientId', 'firstName lastName area avatarUrl')
      .populate('awardedBy', 'firstName lastName')
      .populate('challengeId', 'title')
      .populate('seasonId', 'name')
      .lean();

    res.json({ transactions });
  } catch (err) {
    console.error('Points history error:', err);
    res.status(500).json({ error: 'Errore caricamento storico punti.' });
  }
});

router.post('/points', requireAuth, requirePresident, async (req: AuthedRequest, res: Response) => {
  try {
    const { recipientId, amount, reason, seasonId, badge } = req.body || {};
    const numAmount = Number(amount);

    if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
      res.status(400).json({ error: 'Seleziona un associato valido.' });
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount === 0) {
      res.status(400).json({ error: 'Inserisci una quantità di punti diversa da zero.' });
      return;
    }
    if (!reason?.trim()) {
      res.status(400).json({ error: 'Inserisci la motivazione per questa operazione.' });
      return;
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      res.status(404).json({ error: 'Associato non trovato.' });
      return;
    }

    const targetSeason = seasonId ? await Season.findById(seasonId) : await getActiveSeason();
    if (!targetSeason) {
      res.status(404).json({ error: 'Stagione non trovata.' });
      return;
    }

    const tx = await PointTransaction.create({
      seasonId: targetSeason._id,
      recipientId: recipient._id,
      awardedBy: req.user!._id,
      amount: numAmount,
      reason: String(reason).trim(),
    });

    if (badge?.trim()) {
      await User.updateOne({ _id: recipient._id }, { $addToSet: { badges: String(badge).trim() } });
    }

    const signStr = numAmount > 0 ? `+${numAmount}` : `${numAmount}`;
    await ActivityEvent.create({
      type: 'points_awarded',
      actorId: req.user!._id,
      targetUserId: recipient._id,
      seasonId: targetSeason._id,
      pointsDelta: numAmount,
      message: `${recipient.firstName} ${recipient.lastName} ha ricevuto ${signStr} pt (${String(reason).trim()}).`,
    });

    await Notification.create({
      userId: recipient._id,
      type: 'points_awarded',
      title: numAmount > 0 ? 'Hai ricevuto nuovi punti!' : 'Aggiornamento punteggio',
      body: `${signStr} pt · Motivazione: ${String(reason).trim()}`,
      linkTab: 'leaderboard',
    });

    res.status(201).json({ transaction: tx });
  } catch (err) {
    console.error('Assign points error:', err);
    res.status(500).json({ error: 'Errore assegnazione punti.' });
  }
});

router.get('/seasons', requireAuth, async (_req: AuthedRequest, res: Response) => {
  try {
    const seasons = await Season.find()
      .sort({ startDate: -1 })
      .populate('championUserId', 'firstName lastName area avatarUrl')
      .lean();
    res.json({ seasons });
  } catch (err) {
    console.error('List seasons error:', err);
    res.status(500).json({ error: 'Errore caricamento stagioni.' });
  }
});

router.post('/seasons', requireAuth, requirePresident, async (req: AuthedRequest, res: Response) => {
  try {
    const { name, description, archiveCurrent } = req.body || {};
    if (!name?.trim()) {
      res.status(400).json({ error: 'Inserisci il nome della nuova stagione.' });
      return;
    }

    if (archiveCurrent) {
      const currentActive = await Season.findOne({ status: 'active' });
      if (currentActive) {
        const finalStandings = await computeSeasonLeaderboard(currentActive._id);
        currentActive.status = 'archived';
        currentActive.endDate = new Date();
        currentActive.finalStandings = finalStandings.map((s) => ({
          userId: new Types.ObjectId(s.userId),
          fullName: s.fullName,
          area: s.area,
          avatarUrl: s.avatarUrl,
          points: s.points,
          rank: s.rank,
        }));
        if (finalStandings.length > 0 && finalStandings[0].points > 0) {
          currentActive.championUserId = new Types.ObjectId(finalStandings[0].userId);
        }
        await currentActive.save();
      }
    } else {
      const activeExists = await Season.findOne({ status: 'active' });
      if (activeExists) {
        res.status(400).json({
          error: 'Esiste già una stagione attiva. Concludila prima di avviarne una nuova.',
        });
        return;
      }
    }

    const season = await Season.create({
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      status: 'active',
      startDate: new Date(),
      createdBy: req.user!._id,
    });

    await ActivityEvent.create({
      type: 'season_started',
      actorId: req.user!._id,
      seasonId: season._id,
      message: `È ufficialmente iniziata la stagione "${season.name}"!`,
    });

    res.status(201).json({ season });
  } catch (err) {
    console.error('Create season error:', err);
    res.status(500).json({ error: 'Errore avvio nuova stagione.' });
  }
});

router.post(
  '/seasons/:id/conclude',
  requireAuth,
  requirePresident,
  async (req: AuthedRequest, res: Response) => {
    try {
      const season = await Season.findById(req.params.id);
      if (!season) {
        res.status(404).json({ error: 'Stagione non trovata.' });
        return;
      }
      if (season.status === 'archived') {
        res.status(400).json({ error: 'Questa stagione è già archiviata.' });
        return;
      }

      const finalStandings = await computeSeasonLeaderboard(season._id);
      season.status = 'archived';
      season.endDate = new Date();
      season.finalStandings = finalStandings.map((s) => ({
        userId: new Types.ObjectId(s.userId),
        fullName: s.fullName,
        area: s.area,
        avatarUrl: s.avatarUrl,
        points: s.points,
        rank: s.rank,
      }));
      if (finalStandings.length > 0 && finalStandings[0].points > 0) {
        season.championUserId = new Types.ObjectId(finalStandings[0].userId);
      }
      await season.save();

      res.json({ season });
    } catch (err) {
      console.error('Conclude season error:', err);
      res.status(500).json({ error: 'Errore chiusura stagione.' });
    }
  }
);

// -----------------------------------------------------------------------------
// ACTIVITY FEED, NOTIFICATIONS & REGULATIONS
// -----------------------------------------------------------------------------
router.get('/activity', requireAuth, async (_req: AuthedRequest, res: Response) => {
  try {
    await syncExpiredChallenges();
    const events = await ActivityEvent.find()
      .sort({ createdAt: -1 })
      .limit(25)
      .populate('actorId', 'firstName lastName avatarUrl')
      .populate('targetUserId', 'firstName lastName avatarUrl')
      .populate('challengeId', 'title')
      .lean();
    res.json({ events });
  } catch (err) {
    console.error('Activity error:', err);
    res.status(500).json({ error: 'Errore caricamento attività recenti.' });
  }
});

router.get('/notifications', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const notifications = await Notification.find({ userId: req.user!._id })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Errore caricamento notifiche.' });
  }
});

router.post('/notifications/read', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { notificationId } = req.body || {};
    if (notificationId && mongoose.isValidObjectId(notificationId)) {
      await Notification.updateOne(
        { _id: notificationId, userId: req.user!._id },
        { $set: { isRead: true } }
      );
    } else {
      await Notification.updateMany({ userId: req.user!._id, isRead: false }, { $set: { isRead: true } });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark notifications read error:', err);
    res.status(500).json({ error: 'Errore aggiornamento notifiche.' });
  }
});

router.get('/regulations', requireAuth, async (_req: AuthedRequest, res: Response) => {
  try {
    const regulation = await Regulation.findOne({ key: 'main' })
      .populate('updatedBy', 'firstName lastName')
      .lean();
    res.json({ regulation });
  } catch (err) {
    console.error('Get regulations error:', err);
    res.status(500).json({ error: 'Errore caricamento regolamento.' });
  }
});

router.put('/regulations', requireAuth, requirePresident, async (req: AuthedRequest, res: Response) => {
  try {
    const { title, sections } = req.body || {};
    if (!title?.trim() || !Array.isArray(sections)) {
      res.status(400).json({ error: 'Titolo e sezioni del regolamento sono obbligatori.' });
      return;
    }

    const updated = await Regulation.findOneAndUpdate(
      { key: 'main' },
      {
        $set: {
          title: String(title).trim(),
          sections: sections.map((s: { id?: string; heading: string; content: string }, i: number) => ({
            id: s.id || `sec-${i + 1}`,
            heading: String(s.heading || '').trim(),
            content: String(s.content || '').trim(),
          })),
          updatedBy: req.user!._id,
        },
      },
      { new: true, upsert: true }
    );

    res.json({ regulation: updated });
  } catch (err) {
    console.error('Update regulations error:', err);
    res.status(500).json({ error: 'Errore salvataggio regolamento.' });
  }
});

// -----------------------------------------------------------------------------
// PRESIDENT ADMIN PANEL ENDPOINTS (Strictly RBAC protected)
// -----------------------------------------------------------------------------
router.get('/admin/overview', requireAuth, requirePresident, async (_req: AuthedRequest, res: Response) => {
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
      recentPosts,
    ] = await Promise.all([
      User.countDocuments(),
      Challenge.countDocuments({ status: 'active' }),
      Challenge.countDocuments({ status: { $in: ['evaluating', 'voting'] } }),
      ChallengeProposal.countDocuments({ status: 'pending' }),
      Post.countDocuments(),
      PointTransaction.aggregate([
        { $match: { seasonId: activeSeason._id } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      User.find().select('-passwordHash').sort({ createdAt: -1 }).lean(),
      Post.find()
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('authorId', 'firstName lastName area avatarUrl')
        .populate('challengeId', 'title')
        .lean(),
    ]);

    res.json({
      stats: {
        totalMembers,
        activeChallengesCount,
        evaluatingOrVotingCount,
        pendingProposalsCount,
        totalPostsCount,
        seasonPointsAwarded: seasonPointsAgg[0]?.total ?? 0,
        seasonTransactionsCount: seasonPointsAgg[0]?.count ?? 0,
      },
      users: allUsers,
      recentPosts,
      activeSeason,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Errore caricamento pannello Presidente.' });
  }
});

router.patch('/admin/users/:id', requireAuth, requirePresident, async (req: AuthedRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Utente non trovato.' });
      return;
    }

    const { area, boardRole, badges, isActive, firstName, lastName } = req.body || {};
    if (firstName?.trim()) user.firstName = String(firstName).trim();
    if (lastName?.trim()) user.lastName = String(lastName).trim();
    if (area?.trim()) user.area = String(area).trim();
    if (boardRole !== undefined) user.boardRole = String(boardRole).trim();
    if (Array.isArray(badges)) user.badges = badges.map((b) => String(b).trim()).filter(Boolean);
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Errore aggiornamento associato.' });
  }
});

router.delete('/admin/posts/:id', requireAuth, requirePresident, async (req: AuthedRequest, res: Response) => {
  try {
    await Post.deleteOne({ _id: req.params.id });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Admin delete post error:', err);
    res.status(500).json({ error: 'Errore eliminazione post.' });
  }
});

router.delete(
  '/admin/posts/:postId/comments/:commentId',
  requireAuth,
  requirePresident,
  async (req: AuthedRequest, res: Response) => {
    try {
      await Post.updateOne(
        { _id: req.params.postId },
        { $pull: { comments: { _id: req.params.commentId } } }
      );
      res.json({ deleted: true });
    } catch (err) {
      console.error('Admin delete comment error:', err);
      res.status(500).json({ error: 'Errore moderazione commento.' });
    }
  }
);

export default router;
