'use client';

import { useRef, useState } from 'react';

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/ezve7bwi/image/upload';
const UPLOAD_PRESET = 'Pintukr';
const FOLDER = 'civiclens';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export type PhotoState =
  | { kind: 'empty' }
  | { kind: 'uploading'; progress: number; preview: string }
  | { kind: 'done'; url: string }
  | { kind: 'error'; message: string; preview: string | null };

export function PhotoUploader({
  value,
  onChange,
}: {
  value: PhotoState;
  onChange: (s: PhotoState) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const startUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      onChange({ kind: 'error', message: 'That file is not an image. Please choose a JPG, PNG, or HEIC photo.', preview: null });
      return;
    }
    if (file.size > MAX_BYTES) {
      onChange({ kind: 'error', message: 'That photo is larger than 10 MB. Please pick a smaller one.', preview: null });
      return;
    }
    const preview = URL.createObjectURL(file);
    onChange({ kind: 'uploading', progress: 0, preview });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', CLOUDINARY_URL);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onChange({ kind: 'uploading', progress: Math.round((e.loaded / e.total) * 100), preview });
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.secure_url) {
            onChange({ kind: 'done', url: data.secure_url });
            return;
          }
        } catch {
          /* fall through to error */
        }
      }
      onChange({
        kind: 'error',
        message: 'The upload did not finish. Check your connection and try again — or skip the photo.',
        preview,
      });
    };
    xhr.onerror = () => {
      onChange({
        kind: 'error',
        message: 'The upload failed. Check your connection and try again — or skip the photo.',
        preview,
      });
    };
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', FOLDER);
    xhr.send(form);
  };

  const pick = () => inputRef.current?.click();

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Choose a photo of the issue"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) startUpload(f);
          e.target.value = '';
        }}
      />

      {value.kind === 'empty' && (
        <button
          type="button"
          onClick={pick}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) startUpload(f);
          }}
          className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
            dragOver ? 'border-civic-500 bg-civic-50' : 'border-slate-300 bg-slate-50 hover:border-civic-400 hover:bg-civic-50/50'
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-civic-100" aria-hidden="true">
            <svg className="h-7 w-7 text-civic-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </span>
          <span>
            <span className="block text-base font-semibold text-slate-900">Add a photo of the issue</span>
            <span className="mt-1 block text-sm text-slate-500">
              Tap to take a photo or choose one — a picture helps crews find and fix it faster.
            </span>
          </span>
          <span className="rounded-full bg-civic-600 px-5 py-2 text-sm font-bold text-white">Choose photo</span>
        </button>
      )}

      {value.kind === 'uploading' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {value.preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.preview} alt="Uploading preview" className="h-56 w-full object-cover opacity-70" />
          )}
          <div className="p-4">
            <div className="flex items-center justify-between text-sm font-medium text-slate-600">
              <span>Uploading photo…</span>
              <span>{value.progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-civic-600 transition-all duration-200"
                style={{ width: `${value.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {value.kind === 'done' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.url} alt="Uploaded photo of the reported issue" className="h-56 w-full object-cover" />
          <div className="flex items-center justify-between p-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Photo attached
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={pick} className="rounded-full px-3 py-1.5 text-sm font-semibold text-civic-700 hover:bg-civic-50">
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange({ kind: 'empty' })}
                className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {value.kind === 'error' && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          {value.preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.preview} alt="Photo that failed to upload" className="mb-3 h-40 w-full rounded-xl object-cover opacity-60" />
          )}
          <p className="text-sm font-medium text-red-800">{value.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={pick}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => onChange({ kind: 'empty' })}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              Choose a different photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
