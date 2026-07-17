import { saveTeamSignup, sangfroidConfig } from './supabase';
import { buildSignupPayload, isStageComplete, type SignupStage } from './signup';
import { initDigitalStopwatch } from './stopwatch';
import '@lottiefiles/lottie-player';

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required element missing: ${selector}`);
  }
  return element;
}

const landingScreen = getRequiredElement<HTMLDivElement>('#landingScreen');
const openFormButton = getRequiredElement<HTMLButtonElement>('#openFormButton');
const signupFormPanel = getRequiredElement<HTMLElement>('#signupFormPanel');
const signupForm = getRequiredElement<HTMLFormElement>('#signupForm');
const submitButton = getRequiredElement<HTMLButtonElement>('#submitButton');
const digitalDisplay = getRequiredElement<HTMLDivElement>('#digitalDisplay');

const submissionOverlay = getRequiredElement<HTMLDivElement>('#submissionOverlay');
const savingAnim = getRequiredElement<Element>('#savingAnim') as any;
const successAnim = getRequiredElement<Element>('#successAnim') as any;

const teammateCountGroup = getRequiredElement<HTMLFieldSetElement>('#teammateCountGroup');
const teammateNameInputs = getRequiredElement<HTMLDivElement>('#teammateNameInputs');
const playerTwoLabel = getRequiredElement<HTMLLabelElement>('#playerTwoLabel');
const playerTwoInput = getRequiredElement<HTMLInputElement>('#playerTwoInput');
const playerThreeLabel = getRequiredElement<HTMLLabelElement>('#playerThreeLabel');
const playerThreeInput = getRequiredElement<HTMLInputElement>('#playerThreeInput');

const stageSections = Array.from(document.querySelectorAll<HTMLElement>('[data-signup-stage]'));
const backButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-stage-back]'));

let hasOpenedForm = false;
let currentStage: SignupStage = 1;
let resolvedGameId = 0;

const stopwatch = initDigitalStopwatch(digitalDisplay);

teammateCountGroup.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement;
  if (target.name !== 'extraTeammates') {
    return;
  }
  const count = Number(target.value);

  teammateNameInputs.classList.toggle('hidden', count === 0);

  playerTwoLabel.classList.toggle('hidden', count < 1);
  playerTwoInput.required = count >= 1;
  if (count < 1) {
    playerTwoInput.value = '';
  }

  playerThreeLabel.classList.toggle('hidden', count < 2);
  playerThreeInput.required = count >= 2;
  if (count < 2) {
    playerThreeInput.value = '';
  }
});

function showErrorOnInput(input: Element | null): void {
  if (!input) {
    return;
  }

  input.classList.remove('error');
  void (input as HTMLElement).offsetWidth;
  input.classList.add('error');
}

signupForm.addEventListener('input', (event) => {
  const target = event.target as HTMLElement;
  if (target.classList.contains('error')) {
    target.classList.remove('error');
  }
});

function syncStageState(): void {
  stageSections.forEach((section) => {
    const stage = Number(section.dataset.signupStage) as SignupStage;
    const isActive = stage === currentStage;
    section.hidden = !isActive;
    section.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach((control) => {
      control.disabled = !isActive;
    });
  });
}

function setStage(stage: SignupStage): void {
  currentStage = stage;
  syncStageState();
}

backButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setStage(Number(button.dataset.stageBack) as SignupStage);
  });
});

function revealForm(): void {
  signupForm.reset();
  signupFormPanel.removeAttribute('style');
  signupFormPanel.classList.add('visible');
  setStage(1);
}

openFormButton.addEventListener('click', () => {
  if (hasOpenedForm) {
    return;
  }

  hasOpenedForm = true;
  stopwatch.stopAndShowResult();

  window.setTimeout(() => {
    landingScreen.classList.add('fly-away');
    const fallbackTimer = window.setTimeout(revealForm, 1100);
    landingScreen.addEventListener('transitionend', () => {
      window.clearTimeout(fallbackTimer);
      revealForm();
    }, { once: true });
  }, 100);
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!signupForm.checkValidity()) {
    const emailInput = signupForm.querySelector<HTMLInputElement>('input[type="email"]');
    if (emailInput && emailInput.validity.typeMismatch) {
      showErrorOnInput(emailInput);
    } else {
      const invalidInputs = document.querySelectorAll('.signup-stage:not([hidden]) input:invalid');
      invalidInputs.forEach(input => showErrorOnInput(input));
    }
    return;
  }

  const formData = new FormData();
  Array.from(signupForm.elements).forEach((element) => {
    const input = element as HTMLInputElement;
    if (input.name) {
      formData.append(input.name, input.value);
    }
  });

  if (currentStage === 1) {
    const code = formData.get('gameCode')?.toString().trim().toUpperCase() ?? '';
    const gameCodes: Record<string, number> = {};
    if (import.meta.env.VITE_GAME_CODE_1) {
      gameCodes[import.meta.env.VITE_GAME_CODE_1.trim().toUpperCase()] = 1;
    }
    if (import.meta.env.VITE_GAME_CODE_2) {
      gameCodes[import.meta.env.VITE_GAME_CODE_2.trim().toUpperCase()] = 2;
    }
    if (import.meta.env.VITE_GAME_CODE_3) {
      gameCodes[import.meta.env.VITE_GAME_CODE_3.trim().toUpperCase()] = 3;
    }

    const gameId = gameCodes[code];
    if (gameId === undefined) {
      showErrorOnInput(document.querySelector('input[name="gameCode"]'));
      return;
    }
    resolvedGameId = gameId;
  }

  const payload = buildSignupPayload(formData, resolvedGameId);

  if (!isStageComplete(currentStage, payload, formData)) {
    showErrorOnInput(document.querySelector('.signup-stage:not([hidden]) input:invalid') ?? document.querySelector('.signup-stage:not([hidden]) input'));
    return;
  }

  if (currentStage < 3) {
    setStage((currentStage + 1) as SignupStage);
    return;
  }

  submitButton.disabled = true;

  submissionOverlay.classList.add('visible');
  savingAnim.classList.remove('hidden', 'fly-away');
  savingAnim.play();

  successAnim.stop();
  successAnim.classList.add('hidden');

  try {
    await saveTeamSignup(payload, sangfroidConfig);

    await new Promise(resolve => setTimeout(resolve, 600));
    savingAnim.classList.add('hidden');

    successAnim.classList.remove('hidden');
    successAnim.play();
  } catch (error) {
    showErrorOnInput(document.querySelector('.signup-stage:not([hidden]) input'));
    submitButton.disabled = false;
    submissionOverlay.classList.remove('visible');
  }
});

syncStageState();