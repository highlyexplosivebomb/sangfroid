import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTeamByTag, saveTeamCreate, saveTeamJoin, getTeamMemberCount } from '../shared/supabase';
import {
  buildCreatePayload,
  buildJoinPayload,
  SignupType,
  type SignupStage,
} from './signup';
import { initDigitalStopwatch } from './stopwatch';
import '@lottiefiles/lottie-player';
import {
  getRequiredElement,
  shakeElement,
  type LottiePlayer,
} from '../shared/dom';
import { navigateTo, SangfroidView } from '../shared/router';
import { loginTeam, loginAdmin } from '../shared/store';

function getActiveSubmitBtn(form: HTMLFormElement): HTMLButtonElement | null {
  return form.querySelector<HTMLButtonElement>(
    '.signup-stage:not([hidden]) button[type="submit"]'
  );
}

function getActiveInvalidInputs(form: HTMLFormElement): NodeListOf<HTMLInputElement> {
  return form.querySelectorAll<HTMLInputElement>(
    '.signup-stage:not([hidden]) input:invalid'
  );
}

function showSubmissionOverlay(
  overlay: HTMLElement,
  saving: LottiePlayer,
  success: LottiePlayer,
  tagDisplay: HTMLElement
): void {
  overlay.classList.add('visible');
  saving.classList.remove('hidden', 'fly-away');
  saving.play();
  success.stop();
  success.classList.add('hidden');
  tagDisplay.classList.add('hidden');
}

async function transitionToSuccess(
  saving: LottiePlayer,
  success: LottiePlayer
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  saving.classList.add('hidden');
  success.classList.remove('hidden');
  success.play();
}

function handleSubmissionError(
  form: HTMLFormElement,
  overlay: HTMLElement,
  submitBtn: HTMLButtonElement | null
): void {
  shakeElement(form.querySelector<HTMLInputElement>('.signup-stage:not([hidden]) input'));
  if (submitBtn) {
    submitBtn.disabled = false;
  }
  overlay.classList.remove('visible');
}

const landingScreen = getRequiredElement<HTMLElement>('#landingScreen');
const compassFormPanel = getRequiredElement<HTMLElement>('#compassFormPanel');
const halfCompassBg = getRequiredElement<HTMLElement>('.half-compass-bg');
const signupForm = getRequiredElement<HTMLFormElement>('#signupForm');
const loginForm = getRequiredElement<HTMLFormElement>('#loginForm');
const digitalDisplay = getRequiredElement<HTMLElement>('#digitalDisplay');
const submissionOverlay = getRequiredElement<HTMLElement>('#submissionOverlay');
const savingAnim = getRequiredElement<LottiePlayer>('#savingAnim');
const successAnim = getRequiredElement<LottiePlayer>('#successAnim');
const teamTagDisplay = getRequiredElement<HTMLElement>('#teamTagDisplay');
const teamTagValue = getRequiredElement<HTMLElement>('#teamTagValue');
const teamTagHint = getRequiredElement<HTMLElement>('#teamTagHint');
const joinTagInput = getRequiredElement<HTMLInputElement>('input[name="teamTag"]');
const joinTagSubmit = getRequiredElement<HTMLButtonElement>('#joinTagSubmit');
const openSignupBtn = getRequiredElement<HTMLButtonElement>('#openSignupBtn');
const openLoginBtn = getRequiredElement<HTMLButtonElement>('#openLoginBtn');
const loginTagInput = getRequiredElement<HTMLInputElement>('#loginTagInput');
const loginPinInput = getRequiredElement<HTMLInputElement>('#loginPinInput');

const stageSections = document.querySelectorAll<HTMLElement>('[data-signup-stage]');

let hasOpenedForm = false;
let currentStage: SignupStage = 1;
let signUpType: SignupType | undefined = undefined;
let gameId = 0;
let teamId = 0;

const stopwatch = initDigitalStopwatch(digitalDisplay);

const GAME_CODES: Record<string, number> = {};
for (const [envKey, id] of [
  ['VITE_GAME_CODE_1', 1],
  ['VITE_GAME_CODE_2', 2],
  ['VITE_GAME_CODE_3', 3],
] as const) {
  const code = import.meta.env[envKey]?.trim().toUpperCase();
  if (code) {
    GAME_CODES[code] = id;
  }
}

signupForm.addEventListener('input', (event) => {
  const target = event.target as HTMLElement;
  target.classList.remove('error');
  target.closest('.checkbox-group')?.classList.remove('error');
});

function syncStageVisibility(): void {
  halfCompassBg.classList.toggle('hidden', currentStage !== 1);
  stageSections.forEach((section) => {
    const stage = Number(section.dataset.signupStage) as SignupStage;
    const sectionSignupType = section.dataset.signupType as SignupType | undefined;
    const isActive = stage === currentStage && (!sectionSignupType || sectionSignupType === signUpType);

    section.hidden = !isActive;
    section
      .querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>(
        'input, button, textarea'
      )
      .forEach((control) => {
        control.disabled = !isActive;
      });
  });
}

function setStage(stage: SignupStage): void {
  currentStage = stage;
  syncStageVisibility();
}

document.querySelectorAll<HTMLButtonElement>('[data-stage-back]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setStage(Number(btn.dataset.stageBack) as SignupStage);
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((btn) => {
  btn.addEventListener('click', () => {
    signUpType = btn.dataset.choice as SignupType;
    setStage(3);
  });
});

async function handleJoinTag(): Promise<void> {
  const tag = joinTagInput.value.trim().toUpperCase();
  if (!tag) {
    shakeElement(joinTagInput);
    return;
  }

  joinTagSubmit.disabled = true;
  const resolvedTeamId = await getTeamByTag(tag);
  if (!resolvedTeamId) {
    shakeElement(joinTagInput);
    joinTagSubmit.disabled = false;
    return;
  }

  const memberCount = await getTeamMemberCount(resolvedTeamId.id);
  if (memberCount >= 3) {
    alert('This team is already full (max 3 members).');
    shakeElement(joinTagInput);
    joinTagSubmit.disabled = false;
    return;
  }

  teamId = resolvedTeamId.id;
  signUpType = SignupType.JoinTeam;
  setStage(4);

  joinTagSubmit.disabled = false;
}

joinTagSubmit.addEventListener('click', handleJoinTag);
joinTagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleJoinTag();
  }
});

function revealForm(formType: 'signup' | 'login'): void {
  signupForm.hidden = formType !== 'signup';
  loginForm.hidden = formType !== 'login';

  if (formType === 'signup') {
    signupForm.reset();
    signUpType = undefined;
    gameId = 0;
    teamId = 0;
    setStage(1);
  }

  compassFormPanel.classList.add('visible');
}

function handleOpenForm(formType: 'signup' | 'login'): void {
  if (hasOpenedForm) {
    return;
  }
  hasOpenedForm = true;
  stopwatch.stopAndShowResult();

  setTimeout(() => {
    landingScreen.classList.add('fly-away');
    const fallbackTimer = setTimeout(() => revealForm(formType), 1100);
    landingScreen.addEventListener('transitionend', () => {
      clearTimeout(fallbackTimer);
      revealForm(formType);
    }, { once: true });
  }, 100);
}

openSignupBtn.addEventListener('click', () => handleOpenForm('signup'));
openLoginBtn.addEventListener('click', () => handleOpenForm('login'));

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (currentStage === 1) {
    const codeInput = signupForm.querySelector<HTMLInputElement>('input[name="gameCode"]');
    const code = codeInput?.value.trim().toUpperCase() ?? '';
    const matchedGameId = GAME_CODES[code];

    if (!matchedGameId) {
      shakeElement(codeInput);
      return;
    }
    gameId = matchedGameId;
    setStage(2);
    return;
  }

  if (currentStage === 3) {
    const invalidInputs = getActiveInvalidInputs(signupForm);
    if (invalidInputs.length > 0) {
      invalidInputs.forEach((input) => shakeElement(input));
      return;
    }

    if (signUpType === SignupType.CreateTeam) {
      const submitBtn = getActiveSubmitBtn(signupForm);
      if (submitBtn) {
        submitBtn.disabled = true;
      }

      showSubmissionOverlay(submissionOverlay, savingAnim, successAnim, teamTagDisplay);

      try {
        const payload = await buildCreatePayload(signupForm, gameId, async (tag) => {
          return (await getTeamByTag(tag)) !== undefined;
        });

        await saveTeamCreate(payload);
        await transitionToSuccess(savingAnim, successAnim);
        teamTagValue.textContent = payload.team_tag;
        teamTagValue.classList.remove('hidden');
        teamTagHint.textContent = "This is your Team Tag. Share it with your teammates!";
        teamTagDisplay.classList.remove('hidden');
      } catch {
        handleSubmissionError(signupForm, submissionOverlay, submitBtn);
      }

      return;
    }

    setStage(4);
    return;
  }

  if (currentStage === 4) {
    if (signUpType === SignupType.JoinTeam) {
      const invalidInputs = getActiveInvalidInputs(signupForm);
      if (invalidInputs.length > 0) {
        invalidInputs.forEach((input) => shakeElement(input));
        return;
      }

      const payload = buildJoinPayload(signupForm, teamId);
      const submitBtn = getActiveSubmitBtn(signupForm);
      if (submitBtn) {
        submitBtn.disabled = true;
      }

      showSubmissionOverlay(submissionOverlay, savingAnim, successAnim, teamTagDisplay);

      try {
        await saveTeamJoin(payload);
        await transitionToSuccess(savingAnim, successAnim);
        teamTagValue.classList.add('hidden');
        teamTagHint.textContent = "You're in! You can close this page now.";
        teamTagDisplay.classList.remove('hidden');
      } catch {
        handleSubmissionError(signupForm, submissionOverlay, submitBtn);
      }

      return;
    }
  }
});

syncStageVisibility();

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const tag = loginTagInput.value.trim().toUpperCase();
  const pin = loginPinInput.value.trim();
  if (!tag || !pin) {
    shakeElement(loginTagInput);
    shakeElement(loginPinInput);
    return;
  }

  const submitBtn = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
  }

  try {
    const resolvedTeam = await getTeamByTag(tag);
    if (!resolvedTeam || resolvedTeam.pin !== pin) {
      shakeElement(loginTagInput);
      shakeElement(loginPinInput);
      if (submitBtn) {
        submitBtn.disabled = false;
      }
      return;
    }

    if (tag === '000') {
      loginAdmin(undefined);
      navigateTo(SangfroidView.AdminPortal);
    } else {
      loginTeam(resolvedTeam.id, tag, resolvedTeam.name, resolvedTeam.game_id);
      navigateTo(SangfroidView.PlayerPortal);
    }
  } catch {
    shakeElement(loginTagInput);
  }

  if (submitBtn) {
    submitBtn.disabled = false;
  }
});

export function initMap(): void {
  const map = L.map('mapBackground', {
    center: [-33.8688, 151.2093],
    zoom: 18,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    attributionControl: false,
  });

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
  }).addTo(map);

  let lastTime = performance.now();
  let xAcc = 0;
  let yAcc = 0;

  function animateMap(time: number) {
    const dt = time - lastTime;
    lastTime = time;

    const speed = 25;
    const dist = (dt / 1000) * speed;

    xAcc += dist;
    yAcc += dist;

    const panX = Math.floor(xAcc);
    const panY = Math.floor(yAcc);

    if (panX !== 0 || panY !== 0) {
      map.panBy([panX, panY], { animate: false });
      xAcc -= panX;
      yAcc -= panY;
    }

    requestAnimationFrame(animateMap);
  }
  requestAnimationFrame(animateMap);
}

export function mountLanding(): void {
  const landingView = document.getElementById('landingView');
  if (landingView) {
    landingView.classList.remove('hidden');
  }
  loginTagInput.value = '';
  loginPinInput.value = '';
}

export function unmountLanding(): void {
  const landingView = document.getElementById('landingView');
  if (landingView) {
    landingView.classList.add('hidden');
  }
}
