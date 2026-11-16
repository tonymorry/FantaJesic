import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRole = 'associate' | 'president';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  area: string;
  boardRole: string;
  avatarUrl: string;
  avatarPublicId: string;
  bio: string;
  role: UserRole;
  badges: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    area: { type: String, required: true, trim: true },
    boardRole: { type: String, default: '', trim: true },
    avatarUrl: { type: String, default: '' },
    avatarPublicId: { type: String, default: '' },
    bio: { type: String, default: '', trim: true },
    role: { type: String, enum: ['associate', 'president'], default: 'associate', required: true },
    badges: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export interface IStandingSnapshot {
  userId: Types.ObjectId;
  fullName: string;
  area: string;
  avatarUrl: string;
  points: number;
  rank: number;
}

export interface ISeason extends Document {
  name: string;
  description: string;
  status: 'active' | 'archived';
  startDate: Date;
  endDate?: Date;
  championUserId?: Types.ObjectId;
  finalStandings: IStandingSnapshot[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SeasonSchema = new Schema<ISeason>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: { type: String, enum: ['active', 'archived'], default: 'active', required: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date },
    championUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    finalStandings: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        fullName: { type: String, required: true },
        area: { type: String, default: '' },
        avatarUrl: { type: String, default: '' },
        points: { type: Number, required: true },
        rank: { type: Number, required: true },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export interface IChallenge extends Document {
  title: string;
  description: string;
  coverImageUrl: string;
  coverPublicId: string;
  seasonId: Types.ObjectId;
  participationMode: 'open' | 'registration' | 'selected';
  participants: Types.ObjectId[];
  evaluationMode: 'vote' | 'president_pick' | 'direct_points';
  voterScope: 'all' | 'participants' | 'non_participants';
  pointsReward: number;
  secondaryPointsReward: number;
  hasTimer: boolean;
  deadline?: Date;
  votingDeadline?: Date;
  status: 'active' | 'evaluating' | 'voting' | 'completed';
  winnerIds: Types.ObjectId[];
  winningPostId?: Types.ObjectId;
  pointsDistributed: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChallengeSchema = new Schema<IChallenge>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    coverImageUrl: { type: String, default: '' },
    coverPublicId: { type: String, default: '' },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', required: true },
    participationMode: {
      type: String,
      enum: ['open', 'registration', 'selected'],
      default: 'open',
      required: true,
    },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    evaluationMode: {
      type: String,
      enum: ['vote', 'president_pick', 'direct_points'],
      default: 'vote',
      required: true,
    },
    voterScope: {
      type: String,
      enum: ['all', 'participants', 'non_participants'],
      default: 'all',
    },
    pointsReward: { type: Number, required: true, min: 0, default: 50 },
    secondaryPointsReward: { type: Number, default: 0, min: 0 },
    hasTimer: { type: Boolean, default: false },
    deadline: { type: Date },
    votingDeadline: { type: Date },
    status: {
      type: String,
      enum: ['active', 'evaluating', 'voting', 'completed'],
      default: 'active',
      required: true,
    },
    winnerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    winningPostId: { type: Schema.Types.ObjectId, ref: 'Post' },
    pointsDistributed: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export interface IChallengeProposal extends Document {
  title: string;
  description: string;
  suggestedPoints: number;
  suggestedParticipationMode: 'open' | 'registration' | 'selected';
  suggestedEvaluationMode: 'vote' | 'president_pick' | 'direct_points';
  proposedBy: Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  presidentNote: string;
  linkedChallengeId?: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChallengeProposalSchema = new Schema<IChallengeProposal>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    suggestedPoints: { type: Number, default: 50, min: 0 },
    suggestedParticipationMode: {
      type: String,
      enum: ['open', 'registration', 'selected'],
      default: 'open',
    },
    suggestedEvaluationMode: {
      type: String,
      enum: ['vote', 'president_pick', 'direct_points'],
      default: 'vote',
    },
    proposedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    presidentNote: { type: String, default: '', trim: true },
    linkedChallengeId: { type: Schema.Types.ObjectId, ref: 'Challenge' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

export interface IComment {
  _id: Types.ObjectId;
  authorId: Types.ObjectId;
  text: string;
  createdAt: Date;
}

export interface IPost extends Document {
  authorId: Types.ObjectId;
  caption: string;
  mediaUrl: string;
  mediaPublicId: string;
  mediaType: 'none' | 'image' | 'video';
  challengeId?: Types.ObjectId;
  seasonId?: Types.ObjectId;
  likes: Types.ObjectId[];
  comments: IComment[];
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    caption: { type: String, default: '', trim: true },
    mediaUrl: { type: String, default: '' },
    mediaPublicId: { type: String, default: '' },
    mediaType: { type: String, enum: ['none', 'image', 'video'], default: 'none' },
    challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge' },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season' },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    comments: [
      {
        authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export interface IVote extends Document {
  challengeId: Types.ObjectId;
  voterId: Types.ObjectId;
  targetUserId: Types.ObjectId;
  targetPostId?: Types.ObjectId;
  createdAt: Date;
}

const VoteSchema = new Schema<IVote>(
  {
    challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge', required: true },
    voterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetPostId: { type: Schema.Types.ObjectId, ref: 'Post' },
  },
  { timestamps: true }
);

VoteSchema.index({ challengeId: 1, voterId: 1 }, { unique: true });

export interface IPointTransaction extends Document {
  seasonId: Types.ObjectId;
  recipientId: Types.ObjectId;
  awardedBy: Types.ObjectId;
  amount: number;
  reason: string;
  challengeId?: Types.ObjectId;
  createdAt: Date;
}

const PointTransactionSchema = new Schema<IPointTransaction>(
  {
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    awardedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge' },
  },
  { timestamps: true }
);

export interface IActivityEvent extends Document {
  type:
    | 'member_joined'
    | 'challenge_created'
    | 'challenge_completed'
    | 'points_awarded'
    | 'voting_opened'
    | 'season_started';
  actorId?: Types.ObjectId;
  targetUserId?: Types.ObjectId;
  challengeId?: Types.ObjectId;
  seasonId?: Types.ObjectId;
  message: string;
  pointsDelta?: number;
  createdAt: Date;
}

const ActivityEventSchema = new Schema<IActivityEvent>(
  {
    type: {
      type: String,
      enum: [
        'member_joined',
        'challenge_created',
        'challenge_completed',
        'points_awarded',
        'voting_opened',
        'season_started',
      ],
      required: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge' },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season' },
    message: { type: String, required: true },
    pointsDelta: { type: Number },
  },
  { timestamps: true }
);

export interface INotification extends Document {
  userId: Types.ObjectId;
  type:
    | 'like'
    | 'comment'
    | 'new_challenge'
    | 'proposal_approved'
    | 'proposal_rejected'
    | 'challenge_ended'
    | 'points_awarded'
    | 'voting_started';
  title: string;
  body: string;
  linkTab?: string;
  linkId?: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'like',
        'comment',
        'new_challenge',
        'proposal_approved',
        'proposal_rejected',
        'challenge_ended',
        'points_awarded',
        'voting_started',
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    linkTab: { type: String, default: 'feed' },
    linkId: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export interface IRegulationSection {
  id: string;
  heading: string;
  content: string;
}

export interface IRegulation extends Document {
  key: string;
  title: string;
  sections: IRegulationSection[];
  updatedBy?: Types.ObjectId;
  updatedAt: Date;
}

const RegulationSchema = new Schema<IRegulation>(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    title: { type: String, required: true, default: 'Regolamento Ufficiale FantaJESic' },
    sections: [
      {
        id: { type: String, required: true },
        heading: { type: String, required: true },
        content: { type: String, required: true },
      },
    ],
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const Season = mongoose.models.Season || mongoose.model<ISeason>('Season', SeasonSchema);
export const Challenge = mongoose.models.Challenge || mongoose.model<IChallenge>('Challenge', ChallengeSchema);
export const ChallengeProposal =
  mongoose.models.ChallengeProposal ||
  mongoose.model<IChallengeProposal>('ChallengeProposal', ChallengeProposalSchema);
export const Post = mongoose.models.Post || mongoose.model<IPost>('Post', PostSchema);
export const Vote = mongoose.models.Vote || mongoose.model<IVote>('Vote', VoteSchema);
export const PointTransaction =
  mongoose.models.PointTransaction ||
  mongoose.model<IPointTransaction>('PointTransaction', PointTransactionSchema);
export const ActivityEvent =
  mongoose.models.ActivityEvent || mongoose.model<IActivityEvent>('ActivityEvent', ActivityEventSchema);
export const Notification =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
export const Regulation =
  mongoose.models.Regulation || mongoose.model<IRegulation>('Regulation', RegulationSchema);
