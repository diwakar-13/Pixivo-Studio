"use client";

import Link from "next/link";
import {
  ChevronDownIcon,
  RefreshCcwIcon,
  SparklesIcon,
  UploadIcon,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useStudioWorkbench } from "@/context/StudioWorkbenchContext";
import { GenerateButton, StylePresetCard } from "./workbench-ui";
import { stylePresets } from "@/lib/style-presents";

// TUMHARI EXACT LABELS AUR MODELS WALI IMPORTS
import {
  openRouterImageModelLabels,
  openRouterImageModels,
} from "@/lib/openRouter-image-model";

// Frontend Client-Side Compression Logic (11MB Fixer)
async function compressImageOnClient(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas compression failed"));
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export function StudioControlsPanel() {
  const {
    error,
    file,
    inputId,
    isGenerateDisabled,
    isLoading,
    quota,
    replaceFile,
    selectedModel,
    selectedStyle,
    selectModel,
    selectStyle,
  } = useStudioWorkbench();

  return (
    <section className="studio-panel rounded-[2rem] border p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="studio-panel-inset flex size-[4.5rem] shrink-0 items-center justify-center rounded-[1.65rem] border text-primary">
          <UploadIcon className="size-8" />
        </div>

        <div className="pt-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.4rem]">
            Create a styled result
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground sm:text-xl">
            Upload an image, choose a style, and generate a new result.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 rounded-[1.35rem] border border-border/45 bg-background/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-foreground">
          <span className="tabular-nums text-lg font-semibold text-primary">
            {quota.remaining}
          </span>{" "}
          generations left
          <span className="font-normal text-muted-foreground">
            {" "}
            ({quota.used} of {quota.limit} used this month)
          </span>
        </p>
        {quota.remaining <= 0 ? (
          <Button className="text-sm font-medium">
            <Link href="/#pricing">View plans</Link>
          </Button>
        ) : null}
      </div>

      <div className="studio-panel-inset mt-7 rounded-[1.8rem] border p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[1.05rem] font-semibold text-foreground sm:text-[1.2rem]">
            1. Upload image
          </p>

          {file ? (
            <Button
              variant="outline"
              size="sm"
              className="studio-pill gap-2  rounded-full px-3.5 py-1.5 text-xs"
            >
              <label htmlFor={inputId} className="flex  gap-2   cursor-pointer">
                <RefreshCcwIcon className="size-4" />
                Change
              </label>
            </Button>
          ) : null}
        </div>

        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onClick={(e) => {
            e.currentTarget.value = "";
          }}
          onChange={async (e) => {
            const rawFile = e.target.files?.[0];
            if (!rawFile) return;

            if (rawFile.size > 2 * 1024 * 1024) {
              try {
                const optimizedFile = await compressImageOnClient(rawFile);
                replaceFile(optimizedFile);
              } catch (err) {
                replaceFile(rawFile);
              }
            } else {
              replaceFile(rawFile);
            }
          }}
        />

        <div className="mt-5 flex flex-col gap-4 rounded-[1.45rem] border border-border/35 bg-background/22 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <Button className="studio-primary-action rounded-full p-5 text-base font-semibold">
              <label htmlFor={inputId} className="cursor-pointer">
                {file ? "Replace Image" : "Upload Image"}
              </label>
            </Button>

            <p className="max-w-xl text-lg text-muted-foreground">
              {file ? file.name : "Choose a JPG, PNG, or WEBP file to begin."}
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          Supports JPG, PNG, and WEBP via ImageKit upload.
        </p>
      </div>

      <div className="mt-7">
        <p className="text-[1.05rem] font-semibold text-foreground sm:text-[1.2rem]">
          2. Choose a style
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stylePresets.map((preset) => (
            <StylePresetCard
              key={preset.slug}
              isSelected={preset.slug === selectedStyle}
              label={preset.label}
              onSelect={() => selectStyle(preset.slug)}
              thumbnailAlt={preset.thumbnailAlt}
              thumbnailPath={preset.thumbnailPath}
            />
          ))}
        </div>
      </div>

      <div className="studio-panel-inset mt-7 rounded-[1.8rem] border p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[1.05rem] font-semibold text-foreground">
            3. Choose AI Model
          </p>
          <SparklesIcon className="size-4 text-primary" />
        </div>

        <div className="mt-4 relative">
          <select
            value={selectedModel}
            onChange={(event) => {
              const selectedValue = event.target.value;
              // Strict Check Matrix: Agar custom string me disabled keyword ho toh block kardo
              if (selectedValue.includes("-disabled")) {
                const cleanLabel = openRouterImageModelLabels[selectedValue] || "This model";
                alert(`${cleanLabel} is currently inactive to protect credits. Please use the default FLUX engine.`);
                return;
              }
              selectModel(selectedValue);
            }}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-auto w-full appearance-none rounded-[1.2rem] border-border/35 bg-background/25 px-4 py-3 pr-11 font-medium focus:border-primary",
            )}
          >
            {openRouterImageModels.map((model) => (
              <option key={model} className="bg-[#3d3238]" value={model}>
                {openRouterImageModelLabels[model]}
              </option>
            ))}
          </select>

          <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Only image-edit-capable AI models are shown here, ensuring
          compatibility with your uploaded image.
        </p>
      </div>

      <p className="mt-6 max-w-2xl text-xl leading-8 text-muted-foreground">
        A first version will be generated right away. You can refine it further
        if needed.
      </p>

      <GenerateButton disabled={isGenerateDisabled} isLoading={isLoading} />

      <p className="mt-5 text-center text-lg text-muted-foreground">
        Styling is powered by AI image editing.
      </p>

      {error ? (
        <div className="mt-5 rounded-[1.3rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
    </section>
  );
}