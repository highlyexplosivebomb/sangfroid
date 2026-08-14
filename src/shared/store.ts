import {
  fetchGameState, updateGameState,
  fetchAnnouncements, insertAnnouncement,
  fetchSubmissions, insertSubmission, updateSubmissionStatus,
  updateSubmissionValueAndStatus, updateSubmissionGuestTeamIds,
  fetchChallenges, fetchTeams,
  supabase, deleteSubmission,
  GAME_TABLE, ANNOUNCEMENT_TABLE, SUBMISSION_TABLE, CHALLENGE_MESSAGES_TABLE,
  fetchChallengeMessages, fetchMultipleChallengeMessages, insertChallengeMessage
} from './supabase';

export const ChallengeType = {
  Answer: 'answer',
  Photo: 'photo',
  Unique1: 'unique-1',
  Unique2: 'unique-2',
  Unique3: 'unique-3',
  Final: 'final',
} as const;
export type ChallengeType = (typeof ChallengeType)[keyof typeof ChallengeType];

export const SubmissionStatus = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  MatchmakingRequest: 'matchmaking_request',
  MatchmakingAccepted: 'matchmaking_accepted',
  PendingChoice: 'pending_choice',
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
  matchmakingLimitType?: 'players' | 'teams';
  matchmakingLimit?: number;
  allowEveryoneToSubmit?: boolean;
}

export interface Submission {
  id: number;
  challengeId: number;
  teamId: number;
  timestamp: number;
  value: string;
  status: SubmissionStatus;
  guestTeamIds: number[];
  hostTeamId?: number;
}

export interface ChallengeMessage {
  id: number;
  challengeId: number;
  submissionId: number;
  teamId: number;
  message: string;
  timestamp: number;
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
  skipPregame: boolean;
  skipFinalChallenge: boolean;
}

export const GamePhase = {
  Stopped: 'stopped',
  Pregame: 'pregame',
  Main: 'main',
  Final: 'final',
  Ended: 'ended'
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

function normalizeStatus<T extends string>(raw: string | null | undefined, fallback: T): string {
  return (raw === '' || !raw) ? fallback : raw;
}

let currentTeam: TeamSession | undefined;
let isAdmin = false;
let adminGameId: number | undefined;

const storedTeam = localStorage.getItem('sangfroid_team');
if (storedTeam) {
  currentTeam = JSON.parse(storedTeam);
}

let declinedMatchmakingRequests: Set<number> = new Set();
try {
  const d = localStorage.getItem('sangfroid_declined_matchmaking');
  if (d) {
    declinedMatchmakingRequests = new Set(JSON.parse(d));
  }
} catch {
  // ignore
}

let dismissedAnnouncements: Set<number> = new Set();
try {
  const a = localStorage.getItem('sangfroid_dismissed_announcements');
  if (a) {
    dismissedAnnouncements = new Set(JSON.parse(a));
  }
} catch {
  // ignore
}

export function loginTeam(id: number, tag: string, name: string, gameId: number, timestamp: number): void {
  currentTeam = { id, tag, name, gameId, timestamp };
  localStorage.setItem('sangfroid_team', JSON.stringify(currentTeam));
  startPolling();
}

export function logoutTeam(): void {
  currentTeam = undefined;
  localStorage.removeItem('sangfroid_team');
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
  if (gameId !== undefined) {
    isAdmin = true;
  }
  stopPolling();
  startPolling();
}

let cachedGameState: GameState = {
  status: GameStatus.Stopped,
  duration: 0,
  timeRemainingSeconds: 0,
  lastTickTimestamp: 0,
  skipPregame: false,
  skipFinalChallenge: false,
};

export function getCurrentPhase(): GamePhase {
  if (cachedGameState.status === GameStatus.Stopped) {
    return GamePhase.Stopped;
  }

  let remaining = cachedGameState.timeRemainingSeconds;
  if (cachedGameState.status === GameStatus.Running) {
    const elapsed = Math.floor((Date.now() - cachedGameState.lastTickTimestamp) / 1000);
    remaining -= elapsed;
  }

  if (remaining <= 0) {
    if (cachedGameState.skipFinalChallenge) {
      return GamePhase.Ended;
    } else {
      const finalRemaining = (30 * 60) + remaining;
      if (finalRemaining <= 0) {
        return GamePhase.Ended;
      }
      return GamePhase.Final;
    }
  }

  const gameDuration = 120 * 60;
  if (!cachedGameState.skipPregame && remaining > gameDuration) {
    return GamePhase.Pregame;
  }

  return GamePhase.Main;
}
let cachedAnnouncements: Announcement[] = [];
let cachedSubmissions: Submission[] = [];
export let cachedChallenges: Challenge[] = [];
export let cachedChallengeMessages: ChallengeMessage[] = [];
export let dataVersion = 0;
let cachedTeams: Record<number, { tag: string; name: string }> = {};

let realtimeChannel: ReturnType<typeof supabase.channel> | undefined;

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
      skipPregame: state.skip_pregame ?? false,
      skipFinalChallenge: state.skip_final_challenge ?? false,
    };
  }

  const anns = await fetchAnnouncements(gameId);
  cachedAnnouncements = anns
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
    guestTeamIds: s.guest_team_ids || [],
    hostTeamId: s.host_team_id || undefined,
  }));

  if (currentTeam && !isAdmin) {
    const activeChatSubIds = cachedSubmissions
      .filter(s => s.status === SubmissionStatus.MatchmakingAccepted && (s.teamId === currentTeam!.id || s.guestTeamIds.includes(currentTeam!.id)))
      .map(s => s.id);

    if (activeChatSubIds.length > 0) {
      cachedChallengeMessages = await fetchMultipleChallengeMessages(activeChatSubIds);
    }
  }

  if (cachedChallenges.length === 0) {
    const challs = await fetchChallenges();
    cachedChallenges = challs.map((c: any) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      description: c.description,
      points: c.points,
      answer: c.answer,
      matchmakingLimitType: c.matchmaking_limit_type,
      matchmakingLimit: c.matchmaking_limit,
      allowEveryoneToSubmit: c.allow_everyone_submit
    }));
  }

  dataVersion++;
}


export function startPolling(): void {
  const gameId = getActiveGameId();
  if (!gameId || realtimeChannel) {
    return;
  }

  realtimeChannel = supabase.channel('schema-db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: GAME_TABLE }, (payload) => handleRealtimeUpdate('game', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: ANNOUNCEMENT_TABLE }, (payload) => handleRealtimeUpdate('announcement', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: SUBMISSION_TABLE }, (payload) => handleRealtimeUpdate('submission', payload))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: CHALLENGE_MESSAGES_TABLE }, (payload) => handleRealtimeUpdate('challenge_message', payload))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        syncAllData(gameId);
      }
    });
}

function handleRealtimeUpdate(type: 'submission' | 'announcement' | 'game' | 'challenge_message', payload: any) {
  const { eventType, new: newRow, old: oldRow } = payload;

  if (type === 'game') {
    if (eventType === 'UPDATE') {
      if (newRow.id !== getActiveGameId()) return;
      cachedGameState = {
        status: normalizeStatus(newRow.status, 'stopped') as GameStatus,
        duration: newRow.duration,
        timeRemainingSeconds: newRow.time_remaining,
        lastTickTimestamp: newRow.last_tick_timestamp ? new Date(newRow.last_tick_timestamp).getTime() : 0,
        skipPregame: newRow.skip_pregame,
        skipFinalChallenge: newRow.skip_final_challenge,
      };
      dataVersion++;
    }
  } else if (type === 'announcement') {
    if (eventType === 'INSERT') {
      if (newRow.game_id !== getActiveGameId()) {
        return;
      }
      cachedAnnouncements.push({
        id: newRow.id,
        message: newRow.message,
        timestamp: newRow.created_at ? new Date(newRow.created_at).getTime() : 0,
      });
      dataVersion++;
    }
  } else if (type === 'submission') {
    if (eventType === 'INSERT') {
      if (newRow.game_id !== getActiveGameId()) return;
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
          guestTeamIds: newRow.guest_team_ids || [],
          hostTeamId: newRow.host_team_id || undefined,
        });
        dataVersion++;
      }
    } else if (eventType === 'UPDATE') {
      const idx = cachedSubmissions.findIndex(sub => sub.id === newRow.id);
      if (idx !== -1) {
        cachedSubmissions[idx].status = normalizeStatus(newRow.status, 'pending') as SubmissionStatus;
        cachedSubmissions[idx].guestTeamIds = newRow.guest_team_ids || [];
        cachedSubmissions[idx].hostTeamId = newRow.host_team_id || undefined;
        if ('value' in newRow) {
          cachedSubmissions[idx].value = newRow.value;
        }
        dataVersion++;
      }
    } else if (eventType === 'DELETE') {
      cachedSubmissions = cachedSubmissions.filter(sub => sub.id !== oldRow.id);
      dataVersion++;
    }
  } else if (type === 'challenge_message') {
    if (eventType === 'INSERT') {
      const exists = cachedChallengeMessages.find(m => m.id === newRow.id);
      if (!exists) {
        cachedChallengeMessages.push({
          id: newRow.id,
          challengeId: newRow.challenge_id,
          submissionId: newRow.submission_id,
          teamId: newRow.team_id,
          message: newRow.message,
          timestamp: newRow.created_at ? new Date(newRow.created_at).getTime() : 0,
        });
        dataVersion++;
      }
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



export function getChallenges(): readonly Challenge[] {
  return cachedChallenges;
}

export function getChallengeById(id: number): Challenge | undefined {
  return cachedChallenges.find((c) => c.id === id);
}

export function getActiveChatSubmissions(): readonly Submission[] {
  if (!currentTeam) {
    return [];
  }
  return cachedSubmissions.filter(s => {
    if (s.hostTeamId) {
      return false;
    }

    if (s.guestTeamIds.length > 0) {
      if (s.status === SubmissionStatus.Approved) {
        return false;
      }
      return s.teamId === currentTeam!.id || s.guestTeamIds.includes(currentTeam!.id);
    }

    return false;
  });
}

export async function addSubmission(
  challengeId: number,
  teamId: number,
  value: string,
  status: SubmissionStatus = 'pending',
  hostTeamId?: number
): Promise<Submission> {
  const gameId = getActiveGameId()!;

  const sub: Omit<Submission, 'id'> = {
    challengeId,
    teamId,
    timestamp: Date.now(),
    value,
    status,
    guestTeamIds: [],
    hostTeamId,
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

export async function sendChallengeMessage(challengeId: number, submissionId: number, message: string): Promise<void> {
  const session = getTeamSession();
  if (!session) {
    return;
  }

  const optimisticId = -Date.now();
  const optimisticMsg: ChallengeMessage = {
    id: optimisticId,
    challengeId,
    submissionId,
    teamId: session.id,
    message,
    timestamp: Date.now(),
  };

  cachedChallengeMessages.push(optimisticMsg);
  dataVersion++;

  const id = await insertChallengeMessage(challengeId, submissionId, session.id, message);
  if (id) {
    const idx = cachedChallengeMessages.findIndex(m => m.id === optimisticId);
    if (idx !== -1) {
      cachedChallengeMessages[idx].id = id;
    }
  }
}

export function getUnreadChatMessagesCount(): number {
  if (!currentTeam) {
    return 0;
  }
  return getActiveChatSubmissions().reduce((sum, s) => sum + getUnreadCountForChat(s.id), 0);
}

export function getUnreadCountForChat(submissionId: number): number {
  if (!currentTeam) {
    return 0;
  }

  const lastReadKey = `sangfroid_chat_read_${submissionId}`;
  const lastReadTime = parseInt(localStorage.getItem(lastReadKey) || '0', 10);

  return cachedChallengeMessages.filter(m =>
    m.submissionId === submissionId &&
    m.teamId !== currentTeam!.id &&
    m.timestamp > lastReadTime
  ).length;
}

export function markChatAsRead(submissionId: number): void {
  const messages = cachedChallengeMessages.filter(m => m.submissionId === submissionId);
  const maxTimestamp = messages.length > 0 ? Math.max(...messages.map(m => m.timestamp)) : Date.now();
  localStorage.setItem(`sangfroid_chat_read_${submissionId}`, maxTimestamp.toString());
  dataVersion++;
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

export function getMatchmakingRequests(challengeId?: number): Submission[] {
  return cachedSubmissions.filter((s) =>
    s.status === SubmissionStatus.MatchmakingRequest &&
    (challengeId === undefined || s.challengeId === challengeId)
  );
}

export async function requestTeamUp(challengeId: number, teamId: number): Promise<Submission> {
  return addSubmission(challengeId, teamId, '', SubmissionStatus.MatchmakingRequest);
}

export function declineMatchmakingRequest(submissionId: number): void {
  declinedMatchmakingRequests.add(submissionId);
  localStorage.setItem('sangfroid_declined_matchmaking', JSON.stringify(Array.from(declinedMatchmakingRequests)));
}

export function isMatchmakingDeclined(submissionId: number): boolean {
  return declinedMatchmakingRequests.has(submissionId);
}

export async function cancelMatchmakingRequest(submissionId: number): Promise<void> {
  const hostSub = cachedSubmissions.find(s => s.id === submissionId);

  if (hostSub) {
    for (const gid of hostSub.guestTeamIds) {
      const gSub = getSubmissionForChallenge(gid, hostSub.challengeId);
      if (gSub) {
        const gIdx = cachedSubmissions.findIndex(s => s.id === gSub.id);
        if (gIdx !== -1) {
          cachedSubmissions.splice(gIdx, 1);
        }
        await deleteSubmission(gSub.id);
      }
    }
  }

  const idx = cachedSubmissions.findIndex(s => s.id === submissionId);
  if (idx !== -1) {
    cachedSubmissions.splice(idx, 1);
    dataVersion++;
  }
  await deleteSubmission(submissionId);
}

export function hasDismissedAnnouncement(announcementId: number): boolean {
  return dismissedAnnouncements.has(announcementId);
}

export function markAnnouncementDismissed(announcementId: number): void {
  dismissedAnnouncements.add(announcementId);
  localStorage.setItem('sangfroid_dismissed_announcements', JSON.stringify(Array.from(dismissedAnnouncements)));
}

export async function acceptTeamUp(hostSubmission: Submission, guestTeamId: number): Promise<void> {


  const hostSub = cachedSubmissions.find(s => s.id === hostSubmission.id);
  let newGuestTeamIds = [...(hostSub?.guestTeamIds || hostSubmission.guestTeamIds || [])];

  if (!newGuestTeamIds.includes(guestTeamId)) {
    newGuestTeamIds.push(guestTeamId);
  }

  if (hostSub) {
    hostSub.guestTeamIds = newGuestTeamIds;
  }
  await updateSubmissionGuestTeamIds(hostSubmission.id, newGuestTeamIds);

  await addSubmission(hostSubmission.challengeId, guestTeamId, '', SubmissionStatus.MatchmakingAccepted, hostSubmission.teamId);
}

export async function startMatchmakingChallenge(hostSubmissionId: number): Promise<void> {
  const hostSub = cachedSubmissions.find(s => s.id === hostSubmissionId);
  if (hostSub) {
    hostSub.status = SubmissionStatus.MatchmakingAccepted;
  }
  await setSubmissionStatus(hostSubmissionId, SubmissionStatus.MatchmakingAccepted);
}

export async function setSubmissionStatus(submissionId: number, status: SubmissionStatus): Promise<void> {
  const sub = cachedSubmissions.find((s) => s.id === submissionId);
  if (sub) {
    sub.status = status;
    await updateSubmissionStatus(submissionId, status);
  }
}

export async function updateSubmissionData(submissionId: number, value: string, status: SubmissionStatus): Promise<void> {
  const sub = cachedSubmissions.find((s) => s.id === submissionId);
  if (sub) {
    sub.status = status;
    sub.value = value;
    await updateSubmissionValueAndStatus(submissionId, value, status);
  }
}

function calculatePointsForSubmission(sub: Submission): number {
  if (sub.status !== 'approved') {
    return 0;
  }
  const challenge = getChallengeById(sub.challengeId);
  if (!challenge) {
    return 0;
  }

  if (challenge.type === ChallengeType.Unique2) {
    const partnerId = sub.hostTeamId || sub.guestTeamIds[0];
    if (!partnerId) {
      return 0;
    }
    const partnerSub = getSubmissionForChallenge(partnerId, challenge.id);
    if (!partnerSub) {
      return 0;
    }
    if (sub.value === 'split' && partnerSub.value === 'split') {
      return Math.floor(challenge.points / 2);
    }
    if (sub.value === 'steal' && partnerSub.value === 'split') {
      return challenge.points;
    }
    return 0;
  }

  return challenge.points;
}

export function getTeamPoints(teamId: number): number {
  return cachedSubmissions
    .filter((s) => s.teamId === teamId && s.status === 'approved')
    .reduce((sum, s) => sum + calculatePointsForSubmission(s), 0);
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
      teamMap.get(sub.teamId)!.points += calculatePointsForSubmission(sub);
    }
  }

  return Array.from(teamMap.entries())
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => b.points - a.points);
}

export function getTeamData(teamId: number) {
  return cachedTeams[teamId];
}

if (currentTeam) {
  startPolling();
}

export async function loadChallengeMessages(submissionId: number): Promise<void> {
  const newMessages = await fetchChallengeMessages(submissionId);

  for (const m of newMessages) {
    if (!cachedChallengeMessages.find(existing => existing.id === m.id)) {
      cachedChallengeMessages.push(m);
    }
  }
  dataVersion++;
}


