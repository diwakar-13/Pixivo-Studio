"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { upload } from "@imagekit/next";
import * as Sentry from "@sentry/nextjs";

import { openRouterImageModels } from "@/lib/openRouter-image-model";
import { stylePresets } from "@/lib/style-presents";

const StudioWorkbenchContext = createContext(null);

const uploadInputId = "studio-image-upload";

async function getImageKitAuthParams() {
  const response = await fetch("/api/upload");

  if (!response.ok) {
    throw new Error("Failed to get upload credentials.");
  }

  const data = await response.json();

  return data;
}

export function StudioWorkbenchProvider({
  children,
  clerkUserId,
  initialHistory,
  initialQuota,
}) {
  const value = useStudioWorkbenchValue({
    clerkUserId,
    initialHistory,
    initialQuota,
  });

  return (
    <StudioWorkbenchContext.Provider value={value}>
      {children}
    </StudioWorkbenchContext.Provider>
  );
}

export function useStudioWorkbench() {
  const value = useContext(StudioWorkbenchContext);

  if (!value) {
    throw new Error(
      "useStudioWorkbench must be used within StudioWorkbenchProvider.",
    );
  }

  return value;
}

function useStudioWorkbenchValue({
  clerkUserId,
  initialHistory,
  initialQuota,
}) {
  const [selectedStyle, setSelectedStyle] = useState(
    stylePresets[0]?.slug ?? "",
  );

  const [selectedModel, setSelectedModel] = useState(openRouterImageModels[0]);

  const [file, setFile] = useState(null);

  const [uploadedSource, setUploadedSource] = useState(null);

  const [sourcePreview, setSourcePreview] = useState(null);

  const [result, setResult] = useState(null);

  const [history, setHistory] = useState(initialHistory);

  const [viewedHistoryItem, setViewedHistoryItem] = useState(null);

  const [error, setError] = useState(null);

  const [isLoading, setIsLoading] = useState(false);

  const [quota, setQuota] = useState(initialQuota);

  useEffect(() => {
    if (!file) {
      setSourcePreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    setSourcePreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const resultPreview = result
    ? `data:${result.mimeType};base64,${result.imageBase64}`
    : null;

  const selectedPreset =
    stylePresets.find((preset) => preset.slug === selectedStyle) ??
    stylePresets[0];

  const isGenerateDisabled = isLoading || !file || quota.remaining <= 0;

  function resetGenerationState() {
    setResult(null);
    setError(null);
  }

  function replaceFile(nextFile) {
    setFile(nextFile);
    setUploadedSource(null);
    resetGenerationState();
  }

  function openHistoryPreview(item) {
    setViewedHistoryItem(item);
    setError(null);
  }

  function closeHistoryPreview() {
    setViewedHistoryItem(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setError("Please upload an image first.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      let nextUploadedSource = uploadedSource;

      if (!nextUploadedSource) {
        const authParams = await getImageKitAuthParams();

        const uploadResult = await upload({
          file,
          fileName: file.name,
          folder: `/users/${clerkUserId}/uploads`,
          signature: authParams.signature,
          token: authParams.token,
          expire: authParams.expire,
          publicKey: authParams.publicKey,
        });

        if (!uploadResult.url) {
          throw new Error("Upload did not return a URL.");
        }

        nextUploadedSource = {
          imageUrl: uploadResult.url,
          originalFileName: file.name,
          sourceMimeType: file.type,
        };

        setUploadedSource(nextUploadedSource);
      }

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceImageUrl: nextUploadedSource.imageUrl,
          sourceMimeType: nextUploadedSource.sourceMimeType,
          originalFileName: nextUploadedSource.originalFileName,
          styleSlug: selectedStyle,
          model: selectedModel,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setResult(null);

        const err = payload.error;

        setError(typeof err === "string" ? err : "Generation failed.");

        const p = payload;

        if (typeof p.limit === "number" && typeof p.used === "number") {
          setQuota({
            limit: p.limit,
            used: p.used,
            remaining: Math.max(0, p.limit - p.used),
          });
        }

        return;
      }

      const resultPayload = payload;
      const g = resultPayload.savedGeneration;

      Sentry.logger.info("studio.generation_succeeded", {
        styleSlug: g.styleSlug,
        model: g.model,
      });

      setResult(resultPayload);

      setHistory((current) => [
        g,
        ...current.filter((item) => item.id !== g.id),
      ]);

      setQuota((prev) => ({
        limit: prev.limit,
        used: prev.used + 1,
        remaining: Math.max(0, prev.remaining - 1),
      }));
    } catch {
      setResult(null);
      setError("Something went wrong while generating the image.");
    } finally {
      setIsLoading(false);
    }
  }

  return {
    closeHistoryPreview,
    error,
    file,
    handleSubmit,
    history,
    inputId: uploadInputId,
    isGenerateDisabled,
    isLoading,
    openHistoryPreview,
    quota,
    replaceFile,
    resultPreview,
    selectedModel,
    selectedPreset,
    selectedStyle,
    selectModel: setSelectedModel,
    selectStyle: setSelectedStyle,
    sourcePreview,
    viewedHistoryItem,
  };
}
