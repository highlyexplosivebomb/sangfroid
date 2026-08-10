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

  const zone = document.createElement('div');
  zone.className = 'photo-upload-zone';

  const icon = createSvgIcon(
    `<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
     <circle cx="8.5" cy="8.5" r="1.5"/>
     <polyline points="21 15 16 10 5 21"/>`
  );
  icon.setAttribute('class', 'photo-upload-icon');

  const text = document.createElement('div');
  text.className = 'photo-upload-text';
  text.textContent = 'Tap to take or upload a photo';

  const preview = document.createElement('img');
  preview.className = 'photo-preview hidden';
  preview.alt = 'Preview';

  zone.appendChild(icon);
  zone.appendChild(text);
  zone.appendChild(preview);
  container.appendChild(zone);
  container.appendChild(fileInput);

  let selectedBlob: Blob | undefined;
  const isLocked = existingSubmission?.status === SubmissionStatus.Pending || existingSubmission?.status === SubmissionStatus.Approved;

  if (existingSubmission?.value) {
    preview.src = existingSubmission.value;
    preview.classList.remove('hidden');
    icon.classList.add('hidden');

    if (isLocked) {
      text.classList.add('hidden');
      zone.classList.add('locked');
    } else {
      text.textContent = 'Tap to change photo';
      zone.classList.add('has-preview');
    }
  }

  zone.addEventListener('click', () => {
    if (isLocked) {
      return;
    }
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    try {
      const result = await compressImage(file);
      selectedBlob = result.blob;
      preview.src = result.dataUrl;
      preview.classList.remove('hidden');
      icon.classList.add('hidden');
      text.textContent = 'Tap to change photo';
      zone.classList.add('has-preview');
    } catch {
      shakeElement(zone);
    }
  });

  const btn = document.createElement('button');
  btn.className = 'challenge-submit-btn photo-submit-btn';
  btn.type = 'button';
  btn.textContent = 'Submit';

  if (!isLocked) {
    container.appendChild(btn);
  }

  const feedbackSlot = document.createElement('div');
  feedbackSlot.className = 'photo-feedback-slot';
  container.insertBefore(feedbackSlot, zone);

  if (existingSubmission?.status === SubmissionStatus.Rejected) {
    feedbackSlot.appendChild(createFeedback('incorrect', 'Submission rejected - try again'));
  } else if (existingSubmission?.status === SubmissionStatus.Approved) {
    feedbackSlot.appendChild(createFeedback('correct', `Submission approved - +${challenge.points} pts`));
  } else if (existingSubmission?.status === SubmissionStatus.Pending) {
    feedbackSlot.appendChild(createFeedback('submitted', 'Submitted - under review. This may take a few mins.'));
  }

  btn.addEventListener('click', async () => {
    if (!selectedBlob) {
      if (existingSubmission?.value) {
        onSubmit(existingSubmission.value);
      } else {
        shakeElement(zone);
      }
      return;
    }

    const session = getTeamSession();
    if (!session) {
      return;
    }

    btn.disabled = true;
    zone.style.pointerEvents = 'none';
    zone.style.opacity = '0.6';

    const originalText = btn.textContent;
    btn.textContent = 'Uploading...';

    const publicUrl = await uploadPhoto(selectedBlob, session.tag);

    if (publicUrl) {
      onSubmit(publicUrl);
    } else {
      btn.disabled = false;
      zone.style.pointerEvents = '';
      zone.style.opacity = '';
      btn.textContent = originalText;

      feedbackSlot.innerHTML = '';
      feedbackSlot.appendChild(createFeedback('incorrect', 'Upload failed - try again'));
    }
  });

  return container;
}
