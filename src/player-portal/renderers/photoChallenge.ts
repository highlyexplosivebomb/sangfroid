import { uploadPhoto } from '../../shared/supabase';
import { SubmissionStatus, type Challenge, type Submission, getTeamSession } from '../../shared/store';
import type { SubmitCallback } from '../challenges';
import { createSvgIcon } from '../../shared/svg';
import { shakeElement } from '../../shared/dom';

const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.6;

function compressImage(file: File): Promise<{ dataUrl: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        let { width, height } = img;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({ dataUrl: e.target?.result as string, blob: file });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        canvas.toBlob(
          (b) => {
            resolve({ dataUrl, blob: b ?? file });
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function createFeedback(className: string, text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `challenge-feedback ${className}`;
  el.textContent = text;
  return el;
}

export function renderPhotoChallenge(
  challenge: Challenge,
  existingSubmission: Submission | undefined,
  onSubmit: SubmitCallback,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'challenge-submit-section';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.capture = 'environment';
  fileInput.style.display = 'none';
  container.appendChild(fileInput);

  const isLocked = existingSubmission?.status === SubmissionStatus.Pending || existingSubmission?.status === SubmissionStatus.Approved;

  const feedbackSlot = document.createElement('div');
  feedbackSlot.className = 'photo-feedback-slot';
  container.appendChild(feedbackSlot);

  if (existingSubmission?.status === SubmissionStatus.Rejected) {
    feedbackSlot.appendChild(createFeedback('incorrect', 'Submission rejected - try again'));
  } else if (existingSubmission?.status === SubmissionStatus.Approved) {
    feedbackSlot.appendChild(createFeedback('correct', `Submission approved - +${challenge.points} pts`));
  } else if (existingSubmission?.status === SubmissionStatus.Pending) {
    feedbackSlot.appendChild(createFeedback('submitted', 'Submitted - under review'));
  }

  let selectedBlob: Blob | undefined;

  const btn = document.createElement('button');
  btn.className = 'challenge-submit-btn photo-submit-btn';
  btn.type = 'button';
  btn.textContent = existingSubmission?.value ? 'Retake Photo' : 'Capture Photo';

  btn.addEventListener('click', () => {
    fileInput.click();
  });

  if (!isLocked) {
    container.appendChild(btn);
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    try {
      const result = await compressImage(file);
      selectedBlob = result.blob;
      showPhotoPopup(result.dataUrl);
    } catch {
      shakeElement(btn);
    }
  });

  function showPhotoPopup(dataUrl: string) {
    const overlay = document.createElement('div');
    overlay.className = 'photo-popup-overlay';

    const modal = document.createElement('div');
    modal.className = 'photo-popup-modal';

    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'photo-popup-preview';

    const btnRow = document.createElement('div');
    btnRow.className = 'message-action-row';

    const retakeBtn = document.createElement('button');
    retakeBtn.className = 'challenge-submit-btn steal-btn';
    retakeBtn.textContent = 'Retake';
    retakeBtn.onclick = () => {
      overlay.remove();
      fileInput.click();
    };

    const submitBtn = document.createElement('button');
    submitBtn.className = 'challenge-submit-btn split-btn';
    submitBtn.textContent = 'Submit';
    submitBtn.onclick = async () => {
      if (!selectedBlob) {
        return;
      }

      const session = getTeamSession();
      if (!session) {
        return;
      }

      submitBtn.disabled = true;
      retakeBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      const publicUrl = await uploadPhoto(selectedBlob, session.tag);
      overlay.remove();

      if (publicUrl) {
        onSubmit(publicUrl);
      } else {
        feedbackSlot.innerHTML = '';
        feedbackSlot.appendChild(createFeedback('incorrect', 'Upload failed - try again'));
      }
    };

    btnRow.appendChild(retakeBtn);
    btnRow.appendChild(submitBtn);

    modal.appendChild(img);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
  }

  return container;
}
