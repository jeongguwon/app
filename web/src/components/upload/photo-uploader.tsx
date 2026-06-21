"use client";

import { ChangeEvent, useState } from "react";

import {
  getImagePrepareErrorMessage,
  MAX_IMAGE_COUNT,
  prepareImageForUpload,
} from "@/lib/image/client-image";

interface PhotoUploaderProps {
  onChange: (files: File[]) => void;
}

export function PhotoUploader({ onChange }: PhotoUploaderProps) {
  const [selectedCount, setSelectedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []).slice(0, MAX_IMAGE_COUNT);

    const preparedFiles: File[] = [];
    setErrorMessage(null);

    for (const file of selectedFiles) {
      const result = await prepareImageForUpload(file);

      if (result.ok) {
        preparedFiles.push(result.file);
        continue;
      }

      setErrorMessage(getImagePrepareErrorMessage(result.reason));
    }

    setSelectedCount(preparedFiles.length);
    onChange(preparedFiles);

    event.target.value = "";
  };

  return (
    <section className="space-y-2">
      <label className="block text-sm font-medium text-zinc-800" htmlFor="photo-upload-input">
        사진 업로드
      </label>
      <input
        id="photo-upload-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileChange}
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
      />
      <p className="text-xs text-zinc-600">{selectedCount}/{MAX_IMAGE_COUNT}장 선택됨</p>
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
    </section>
  );
}
