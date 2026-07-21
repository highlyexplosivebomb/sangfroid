import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTeamByTag, saveTeamCreate, saveTeamJoin } from './supabase';
import {
  buildCreatePayload,
  buildJoinPayload,
  getCheckedValues,
  type SignupStage,
  type SignupType,
} from './signup';
import { initDigitalStopwatch } from './stopwatch';
import '@lottiefiles/lottie-player';
import {
  getRequiredElement,
  shakeElement,
  type LottiePlayer,
  getActiveSubmitBtn,
  getActiveInvalidInputs,
  showSubmissionOverlay,
  transitionToSuccess,
  handleSubmissionError,
} from './dom';

const landingScreen = getRequiredElement<HTMLElement>('#landingScreen');
const openFormButton = getRequiredElement<HTMLButtonElement>('#openFormButton');
const signupFormPanel = getRequiredElement<HTMLElement>('#signupFormPanel');
const signupForm = getRequiredElement<HTMLFormElement>('#signupForm');
const digitalDisplay = getRequiredElement<HTMLElement>('#digitalDisplay');
const submissionOverlay = getRequiredElement<HTMLElement>('#submissionOverlay');
const savingAnim = getRequiredElement<LottiePlayer>('#savingAnim');
const successAnim = getRequiredElement<LottiePlayer>('#successAnim');
const teamTagDisplay = getRequiredElement<HTMLElement>('#teamTagDisplay');
const teamTagValue = getRequiredElement<HTMLElement>('#teamTagValue');
const teamTagHint = getRequiredElement<HTMLElement>('#teamTagHint');
const joinTagInput = getRequiredElement<HTMLInputElement>('input[name="teamTag"]');
const joinTagSubmit = getRequiredElement<HTMLButtonElement>('#joinTagSubmit');

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
    return;
  }
  teamId = resolvedTeamId;
  signUpType = 'join';
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

function revealForm(): void {
  signupForm.reset();
  signUpType = undefined;
  gameId = 0;
  teamId = 0;
  signupFormPanel.classList.add('visible');
  setStage(1);
}

openFormButton.addEventListener('click', () => {
  if (hasOpenedForm) {
    return;
  }
  hasOpenedForm = true;
  stopwatch.stopAndShowResult();

  setTimeout(() => {
    landingScreen.classList.add('fly-away');
    const fallbackTimer = setTimeout(revealForm, 1100);
    landingScreen.addEventListener('transitionend', () => {
      clearTimeout(fallbackTimer);
      revealForm();
    }, { once: true });
  }, 100);
});



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
    setStage(4);
    return;
  }

  if (currentStage === 4) {
    if (signUpType === 'create') {
      const availability = getCheckedValues(signupForm, 'availability');
      if (availability.length === 0) {
        shakeElement(signupForm.querySelector('#availabilityGroup'));
        return;
      }

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
        teamTagHint.textContent = "This is your team's tag. Share it with your teammates so they can join!";
        teamTagDisplay.classList.remove('hidden');
      } catch {
        handleSubmissionError(signupForm, submissionOverlay, submitBtn);
      }

      return;
    }

    if (signUpType === 'join') {
      const invalidInputs = getActiveInvalidInputs(signupForm);
      if (invalidInputs.length > 0) {
        invalidInputs.forEach((input) => shakeElement(input));
        return;
      }

      const availability = getCheckedValues(signupForm, 'joinAvailability');
      if (availability.length === 0) {
        shakeElement(signupForm.querySelector('#joinAvailabilityGroup'));
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

const map = L.map('mapBackground', {
  center: [-33.8688, 151.2093], // Sydney
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