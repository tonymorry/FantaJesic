export type UserRole = 'associate' | 'president';

export interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  area: string;
  boardRole: string;
  avatarUrl: string;
  bio: string;
  role: UserRole;
  badges: string[];
  isActive: boolean;
  createdAt: string;
}

export interface DbStatus {
  configured: boolean;
  connected: boolean;
  error: string | null;
  cloudinaryConfigured: boolean;
}

export interface Season {
  _id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  startDate: string;
  endDate?: string;
  championUserId?: {
    _id: string;
    firstName: string;
    lastName: string;
    area: string;
    avatarUrl?: string;
  };
  finalStandings?: Array<{
    userId: string;
    fullName: string;
    area: string;
    avatarUrl: string;
    points: number;
    rank: number;
  }>;
}

export interface LeaderboardEntry {
  userId: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  area: string;
  boardRole?: string;
  avatarUrl: string;
  role?: UserRole;
  badges?: string[];
  points: number;
  rank: number;
}

export interface PostComment {
  _id: string;
  authorId: {
    _id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    role?: UserRole;
  };
  text: string;
  createdAt: string;
}

export interface PostItem {
  _id: string;
  authorId: {
    _id: string;
    firstName: string;
    lastName: string;
    area: string;
    boardRole?: string;
    avatarUrl?: string;
    role?: UserRole;
    badges?: string[];
  };
  caption: string;
  mediaUrl?: string;
  mediaType: 'none' | 'image' | 'video';
  challengeId?: {
    _id: string;
    title: string;
    status: string;
    participationMode?: string;
    pointsReward?: number;
  };
  likes: string[];
  comments: PostComment[];
  createdAt: string;
}

export interface ChallengeItem {
  _id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  seasonId: { _id: string; name: string; status: string } | string;
  participationMode: 'open' | 'registration' | 'selected';
  participants: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    area: string;
    boardRole?: string;
    avatarUrl?: string;
  }>;
  evaluationMode: 'vote' | 'president_pick' | 'direct_points';
  voterScope: 'all' | 'participants' | 'non_participants';
  pointsReward: number;
  secondaryPointsReward?: number;
  hasTimer: boolean;
  deadline?: string;
  votingDeadline?: string;
  status: 'active' | 'evaluating' | 'voting' | 'completed';
  winnerIds: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    area: string;
    avatarUrl?: string;
  }>;
  pointsDistributed: boolean;
  createdBy?: { _id: string; firstName: string; lastName: string };
  submissionsCount?: number;
  hasVoted?: boolean;
  createdAt: string;
}

export interface VoteTally {
  targetUserId: string;
  fullName: string;
  avatarUrl: string;
  area: string;
  count: number;
  targetPostId?: string;
}

export interface ChallengeProposalItem {
  _id: string;
  title: string;
  description: string;
  suggestedPoints: number;
  suggestedParticipationMode: 'open' | 'registration' | 'selected';
  suggestedEvaluationMode: 'vote' | 'president_pick' | 'direct_points';
  proposedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    area: string;
    avatarUrl?: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  presidentNote?: string;
  linkedChallengeId?: string;
  createdAt: string;
}

export interface PointTransactionItem {
  _id: string;
  seasonId?: { _id: string; name: string };
  recipientId: { _id: string; firstName: string; lastName: string; area: string; avatarUrl?: string };
  awardedBy: { _id: string; firstName: string; lastName: string };
  amount: number;
  reason: string;
  challengeId?: { _id: string; title: string };
  createdAt: string;
}

export interface ActivityEventItem {
  _id: string;
  type:
    | 'member_joined'
    | 'challenge_created'
    | 'challenge_completed'
    | 'points_awarded'
    | 'voting_opened'
    | 'season_started';
  message: string;
  pointsDelta?: number;
  challengeId?: { _id: string; title: string };
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body: string;
  linkTab?: string;
  linkId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface RegulationDoc {
  _id: string;
  title: string;
  sections: Array<{ id: string; heading: string; content: string }>;
  updatedAt: string;
  updatedBy?: { firstName: string; lastName: string };
}

export type AppTab =
  | 'feed'
  | 'challenges'
  | 'leaderboard'
  | 'regulations'
  | 'notifications'
  | 'profile'
  | 'president';

export const JESIC_AREAS = [
  'Board',
  'Sales, Legal e Public Affairs',
  'HR e Audit',
  'Marketing e IT',
] as const;
