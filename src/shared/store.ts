import {
  fetchGameState, updateGameState,
  fetchAnnouncements, insertAnnouncement,
  fetchSubmissions, insertSubmission, updateSubmissionStatus,
  fetchChallenges, fetchTeams, dismissAnnouncementDb,
  supabase,
  GAME_TABLE, ANNOUNCEMENT_TABLE, SUBMISSION_TABLE
} from './supabase';

export const ChallengeType = {
  Answer: 'answer',
  Photo: 'photo',
  Unique: 'unique',
} as const;
export type ChallengeType = (typeof ChallengeType)[keyof typeof ChallengeType];

export const SubmissionStatus = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export interface Announcement {
  id: number;
  message: string;
  timestamp: number;
}

export interface Challenge {
  id: number;
  type: ChallengeType;
  title: string;
  description: string;
  points: number;
  answer?: string;
}

export interface Submission {
  id: number;
  challengeId: number;
  teamId: number;
  timestamp: number;
  value: string;
  status: SubmissionStatus;
}

export interface Team {
  id: number;
  game_id: number;
  name: string;
  tag: string;
  pin: string;
  timestamp: string;
}

export interface TeamSession {
  id: number;
  tag: string;
  name: string;
  gameId: number;
  timestamp: number;
}

export const GameStatus = {
  Running: 'running',
  Paused: 'paused',
  Stopped: 'stopped',
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export interface GameState {
  status: GameStatus;
  duration: number;
  timeRemainingSeconds: number;
  lastTickTimestamp: number;
}

function normalizeStatus<T extends string>(raw: string | null | undefined, fallback: T): T | string {
  return (raw === '' || !raw) ? fallback : raw;
}

let currentTeam: TeamSession | undefined;
let isAdmin = false;
let adminGameId: number | undefined;

export function loginTeam(id: number, tag: string, name: string, gameId: number, timestamp: number): void {
  currentTeam = { id, tag, name, gameId, timestamp };
  startPolling();
}

export function logoutTeam(): void {
  currentTeam = undefined;
  stopPolling();
}

export function getTeamSession(): TeamSession | undefined {
  return currentTeam;
}

export function loginAdmin(gameId: number | undefined): void {
  isAdmin = true;
  adminGameId = gameId;
  currentTeam = undefined;
  startPolling();
}

export function logoutAdmin(): void {
  isAdmin = false;
  adminGameId = undefined;
  stopPolling();
}

export function getIsAdmin(): boolean {
  return isAdmin;
}

export function getAdminGameId(): number | undefined {
  return adminGameId;
}

export function setAdminGameId(gameId: number | undefined): void {
  adminGameId = gameId;
  if (isAdmin) {
    stopPolling();
    startPolling();
  }
}

let cachedGameState: GameState = {
  status: GameStatus.Stopped,
  duration: 0,
  timeRemainingSeconds: 0,
  lastTickTimestamp: 0,
};
let cachedAnnouncements: Announcement[] = [];
let cachedSubmissions: Submission[] = [];
export let cachedChallenges: Challenge[] = [];
export let dataVersion = 0;
let cachedTeams: Record<number, { tag: string; name: string }> = {};

let realtimeChannel: ReturnType<typeof supabase.channel> | undefined;
let syncTimeout: number | undefined;

function getActiveGameId(): number | undefined {
  if (isAdmin && adminGameId) {
    return adminGameId;
  }
  if (currentTeam) {
    return currentTeam.gameId;
  }
  return undefined;
}

async function syncAllData(gameId: number) {
  const teams = await fetchTeams(gameId);
  teams.forEach((t: { id: number; tag: string; name: string }) => {
    cachedTeams[t.id] = { tag: t.tag, name: t.name };
  });

  const state = await fetchGameState(gameId);
  if (state) {
    cachedGameState = {
      status: normalizeStatus(state.status, GameStatus.Stopped) as GameStatus,
      duration: state.duration,
      timeRemainingSeconds: state.time_remaining,
      lastTickTimestamp: state.last_tick_timestamp ? new Date(state.last_tick_timestamp).getTime() : 0,
    };
  }

  const anns = await fetchAnnouncements(gameId);
  cachedAnnouncements = anns
    .filter((a: any) => !currentTeam || !a.dismissed_by?.includes(currentTeam.tag))
    .map((a: any) => ({
      id: a.id,
      message: a.message,
      timestamp: a.created_at ? new Date(a.created_at).getTime() : 0,
    }));

  const subs = await fetchSubmissions(gameId, isAdmin, currentTeam?.id);
  cachedSubmissions = subs.map((s: any) => ({
    id: s.id,
    challengeId: s.challenge_id,
    teamId: s.team_id,
    value: s.value,
    status: normalizeStatus(s.status, SubmissionStatus.Pending) as SubmissionStatus,
    timestamp: s.created_at ? new Date(s.created_at).getTime() : 0,
  }));

  if (cachedChallenges.length === 0) {
    const challs = await fetchChallenges();
    cachedChallenges = challs.map((c: any) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      description: c.description,
      points: c.points,
      answer: c.answer
    }));
  }

  dataVersion++;
}

function triggerSync() {
  const gameId = getActiveGameId();
  if (!gameId) {
    return;
  }
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => {
    syncAllData(gameId);
  }, 300);
}

export function startPolling(): void {
  const gameId = getActiveGameId();
  if (!gameId || realtimeChannel) {
    return;
  }

  triggerSync();

  realtimeChannel = supabase.channel(`game-${gameId}-changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table: SUBMISSION_TABLE, filter: `game_id=eq.${gameId}` }, (payload) => {
      handleRealtimeUpdate('submission', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: ANNOUNCEMENT_TABLE, filter: `game_id=eq.${gameId}` }, (payload) => {
      handleRealtimeUpdate('announcement', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: GAME_TABLE, filter: `id=eq.${gameId}` }, (payload) => {
      handleRealtimeUpdate('game', payload);
    })
    .subscribe();
}

function handleRealtimeUpdate(type: 'submission' | 'announcement' | 'game', payload: any) {
  const { eventType, new: newRow, old: oldRow } = payload;

  if (type === 'game') {
    if (eventType === 'UPDATE') {
      cachedGameState = {
        status: normalizeStatus(newRow.status, 'stopped') as GameStatus,
        duration: newRow.duration,
        timeRemainingSeconds: newRow.time_remaining,
        lastTickTimestamp: newRow.last_tick_timestamp ? new Date(newRow.last_tick_timestamp).getTime() : 0,
      };
      dataVersion++;
    }
  } else if (type === 'announcement') {
    if (eventType === 'INSERT') {
      if (currentTeam && newRow.dismissed_by?.includes(currentTeam.tag)) {
        return;
      }
      cachedAnnouncements.push({
        id: newRow.id,
        message: newRow.message,
        timestamp: newRow.created_at ? new Date(newRow.created_at).getTime() : 0,
      });
      dataVersion++;
    } else if (eventType === 'UPDATE') {
      if (currentTeam && newRow.dismissed_by?.includes(currentTeam.tag)) {
        cachedAnnouncements = cachedAnnouncements.filter(a => a.id !== newRow.id);
        dataVersion++;
      }
    }
  } else if (type === 'submission') {
    if (eventType === 'INSERT') {
      let finalValue = newRow.value;
      if (!isAdmin && currentTeam && newRow.team_id !== currentTeam.id) {
        finalValue = null;
      }
      const exists = cachedSubmissions.find(sub => sub.id === newRow.id);
      if (!exists) {
        cachedSubmissions.push({
          id: newRow.id,
          challengeId: newRow.challenge_id,
          teamId: newRow.team_id,
          value: finalValue,
          status: normalizeStatus(newRow.status, 'pending') as SubmissionStatus,
          timestamp: newRow.created_at ? new Date(newRow.created_at).getTime() : 0,
        });
        dataVersion++;
      }
    } else if (eventType === 'UPDATE') {
      const idx = cachedSubmissions.findIndex(sub => sub.id === newRow.id);
      if (idx !== -1) {
        cachedSubmissions[idx].status = normalizeStatus(newRow.status, 'pending') as SubmissionStatus;
        if (isAdmin || (currentTeam && newRow.team_id === currentTeam.id)) {
          cachedSubmissions[idx].value = newRow.value;
        }
        dataVersion++;
      }
    } else if (eventType === 'DELETE') {
      cachedSubmissions = cachedSubmissions.filter(sub => sub.id !== oldRow.id);
      dataVersion++;
    }
  }
}

export function stopPolling(): void {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = undefined;
  }
}

export function getGameState(): GameState {
  return cachedGameState;
}

export async function saveGameState(gameId: number, state: GameState): Promise<void> {
  cachedGameState = state;
  await updateGameState(gameId, state);
}

export function getAnnouncements(): Announcement[] {
  return cachedAnnouncements;
}

export async function addAnnouncement(gameId: number, message: string): Promise<void> {
  const id = await insertAnnouncement(gameId, message);
  if (id) {
    cachedAnnouncements.push({
      id,
      message,
      timestamp: Date.now(),
    });
  }
}

export async function dismissAnnouncement(id: number): Promise<void> {
  cachedAnnouncements = cachedAnnouncements.filter(a => a.id !== id);
  if (currentTeam) {
    await dismissAnnouncementDb(id, currentTeam.tag);
  }
}

export function getChallenges(): readonly Challenge[] {
  return cachedChallenges;
}

export function getChallengeById(id: number): Challenge | undefined {
  return cachedChallenges.find((c) => c.id === id);
}

export async function addSubmission(
  challengeId: number,
  teamId: number,
  value: string,
  status: SubmissionStatus,
): Promise<Submission> {
  const gameId = getActiveGameId();
  if (!gameId) {
    throw new Error("No active game to submit to");
  }

  const sub: Omit<Submission, 'id'> = {
    challengeId,
    teamId,
    timestamp: Date.now(),
    value,
    status,
  };

  const optimisticId = -Date.now();
  const optimisticSub = { ...sub, id: optimisticId };
  cachedSubmissions.push(optimisticSub);
  dataVersion++;

  const id = await insertSubmission(gameId, sub);

  if (id) {
    const idx = cachedSubmissions.findIndex(s => s.id === optimisticId);
    if (idx !== -1) {
      cachedSubmissions[idx].id = id;
    }
    return cachedSubmissions[idx] || { ...sub, id };
  }
  throw new Error("Failed to insert submission");
}

export function getSubmissionsForTeam(teamId: number): readonly Submission[] {
  return cachedSubmissions.filter((s) => s.teamId === teamId);
}

export function getSubmissionForChallenge(teamId: number, challengeId: number): Submission | undefined {
  for (let i = cachedSubmissions.length - 1; i >= 0; i--) {
    if (cachedSubmissions[i].teamId === teamId && cachedSubmissions[i].challengeId === challengeId) {
      return cachedSubmissions[i];
    }
  }
  return undefined;
}

export function getPendingSubmissions(): Submission[] {
  return cachedSubmissions.filter((s) => s.status === 'pending');
}

export async function setSubmissionStatus(submissionId: number, status: SubmissionStatus): Promise<void> {
  const sub = cachedSubmissions.find((s) => s.id === submissionId);
  if (sub) {
    sub.status = status;
    await updateSubmissionStatus(submissionId, status);
  }
}

export function getTeamPoints(teamId: number): number {
  return cachedSubmissions
    .filter((s) => s.teamId === teamId && s.status === 'approved')
    .reduce((sum, s) => {
      const challenge = getChallengeById(s.challengeId);
      return sum + (challenge ? challenge.points : 0);
    }, 0);
}

export function getLeaderboard(): { id: number; tag: string; name: string; points: number }[] {
  const teamMap = new Map<number, { tag: string; name: string; points: number }>();

  for (const [idStr, teamInfo] of Object.entries(cachedTeams)) {
    teamMap.set(Number(idStr), { tag: teamInfo.tag, name: teamInfo.name, points: 0 });
  }

  for (const sub of cachedSubmissions) {
    if (!teamMap.has(sub.teamId)) {
      const teamInfo = cachedTeams[sub.teamId] || { tag: 'UNK', name: 'Unknown Team' };
      teamMap.set(sub.teamId, { tag: teamInfo.tag, name: teamInfo.name, points: 0 });
    }
    if (sub.status === 'approved') {
      const challenge = getChallengeById(sub.challengeId);
      if (challenge) {
        teamMap.get(sub.teamId)!.points += challenge.points;
      }
    }
  }

  return Array.from(teamMap.entries())
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => b.points - a.points);
}

export function getTeamData(teamId: number) {
  return cachedTeams[teamId];
}
