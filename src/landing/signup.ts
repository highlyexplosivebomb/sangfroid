export const SignupStage = {
  CreateJoin: 1,
  Details: 2,
  PlayerInfo: 3,
  Success: 4,
} as const;
export type SignupStage = (typeof SignupStage)[keyof typeof SignupStage];

export const SignupType = {
  CreateTeam: 'create-team',
  JoinTeam: 'join-team',
} as const;
export type SignupType = (typeof SignupType)[keyof typeof SignupType];

export type PlayerPayload = {
  player_name: string;
};

export type CreateTeamPayload = {
  signupType: SignupType;
  game_id: number;
  email: string;
  name: string;
  team_tag: string;
  pin: string;
  team_leader: PlayerPayload;
};

export type JoinTeamPayload = {
  signupType: SignupType;
  team_id: number;
} & PlayerPayload;

export type SignupPayload = CreateTeamPayload | JoinTeamPayload;

export async function generateTeamTag(teamName: string, isTagTaken: (tag: string) => Promise<boolean>): Promise<string> {
  const words = teamName.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(Boolean);

  let baseTag = "";
  if (words.length >= 3) {
    baseTag = words[0][0] + words[1][0] + words[2][0];
  } else if (words.length === 2) {
    baseTag = words[0].slice(0, 2) + words[1][0];
  } else if (words.length === 1) {
    baseTag = words[0].slice(0, 3);
  }

  if (baseTag.length === 3) {
    if (!(await isTagTaken(baseTag))) {
      return baseTag;
    }
  }

  const prefix1 = baseTag.slice(0, 2);
  for (let i = 0; i <= 9; i++) {
    const candidate = `${prefix1}${i}`;
    if (!(await isTagTaken(candidate))) {
      return candidate;
    }
  }

  const prefix2 = baseTag.slice(0, 1);
  for (let i = 10; i <= 99; i++) {
    const candidate = `${prefix2}${i}`;
    if (!(await isTagTaken(candidate))) {
      return candidate;
    }
  }

  throw new Error('All tag combinations are exhausted.');
}

export function generateTeamPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getField(form: HTMLFormElement, name: string): string {
  const el = form.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
  return (el?.value ?? '').trim();
}

function buildPlayerPayload(form: HTMLFormElement, isJoin = false): PlayerPayload {
  return {
    player_name: getField(form, isJoin ? 'joinPlayerName' : 'playerName'),
  };
}

export async function buildCreatePayload(form: HTMLFormElement, gameId: number, isTagTaken: (tag: string) => Promise<boolean>): Promise<CreateTeamPayload> {
  const teamName = getField(form, 'teamName');

  return {
    signupType: SignupType.CreateTeam,
    game_id: gameId,
    email: getField(form, 'email'),
    name: teamName,
    team_tag: await generateTeamTag(teamName, isTagTaken),
    pin: generateTeamPin(),
    team_leader: buildPlayerPayload(form),
  };
}

export function buildJoinPayload(form: HTMLFormElement, teamId: number): JoinTeamPayload {
  return {
    signupType: SignupType.JoinTeam,
    team_id: teamId,
    ...buildPlayerPayload(form, true),
  };
}