import {
  countGenerationsSince,
  createGeneration,
  utcMonthStart,
} from "@/db/generations";
import { getMonthlyGenerationLimit } from "@/lib/generation-quota";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import sharp from "sharp";

import * as Sentry from "@sentry/nextjs";
import { openrouter } from "@/lib/openRouter";
import { ACCEPTED_SOURCE_IMAGE_MIME_TYPES } from "@/lib/constant";
import { getStylePreset } from "@/lib/style-presents";
import { uploadBufferToImageKit } from "@/lib/imagekit";
export const runtime = "nodejs";
/**
 * inferImageSize reads width and height from the uploaded image (via sharp), computes aspect ratio,
 * and returns one of the allowed `size` values for OpenAI image edits.
 */

async function inferImageSize(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();

    if (!metadata.width || !metadata.height) {
      return "1024x1024";
    }

    const aspectRatio = metadata.width / metadata.height;

    if (aspectRatio > 1.08) return "1536x1024"; // this means that the input image is wider than it is tall
    if (aspectRatio < 0.92) return "1024x1536"; // this means that the input image is taller than it is wide
    return "1024x1024"; // this means that the input image is square
  } catch (error) {
    return "1024x1024";
  }
}

export async function POST(req) {
  const { userId, has } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const monthlyLimit = getMonthlyGenerationLimit(has);
  const usedThisMonth = await countGenerationsSince(userId, utcMonthStart());

  if (usedThisMonth >= monthlyLimit) {
    Sentry.logger.warn("generation.quota_exceeded", {
      limit: monthlyLimit,
      used: usedThisMonth,
    });

    return NextResponse.json(
      {
        error: `Monthly generation limit reached (${monthlyLimit} images). Upgrade your plan or try again next month.`,
        code: "QUOTA_EXCEEDED",
        limit: monthlyLimit,
        used: usedThisMonth,
      },
      { status: 429 },
    );
  }

  if (!openrouter) {
    return NextResponse.json(
      { error: "Missing OPENROUTER_API_KEY." },
      { status: 500 },
    );
  }

  const { model, originalFileName, sourceImageUrl, sourceMimeType, styleSlug } =
    await req.json();

  if (!sourceImageUrl) {
    return NextResponse.json(
      { error: "Please upload an image first." },
      { status: 400 },
    );
  }

  if (
    typeof sourceMimeType !== "string" ||
    !ACCEPTED_SOURCE_IMAGE_MIME_TYPES.has(sourceMimeType)
  ) {
    return NextResponse.json(
      { error: "Only JPG, PNG, and WEBP files are supported." },
      { status: 400 },
    );
  }

  if (typeof styleSlug !== "string") {
    return NextResponse.json(
      { error: "Please choose a style." },
      { status: 400 },
    );
  }

  if (!model) {
    return NextResponse.json(
      { error: "Please choose a model." },
      { status: 400 },
    );
  }

  const preset = getStylePreset(styleSlug);
  if (!preset) {
    return NextResponse.json(
      { error: "Unknown style preset." },
      { status: 400 },
    );
  }

  const imageResponse = await fetch(sourceImageUrl);
  if (!imageResponse.ok) {
    return NextResponse.json(
      { error: "Could not fetch the uploaded source image." },
      { status: 404 },
    );
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  //   const imageSize = await inferImageSize(imageBuffer);

  const prompt = [
    preset.prompt,
    "Do not add extra people, extra limbs, duplicate subjects, or change the overall camera angle.",
  ].join("\n\n");

  try {
    const result = await openrouter.images.generate({
      imageGenerationRequest: {
        model,
        prompt,
        input_references: [
          {
            type: "image_url",
            image_url: {
              url: sourceImageUrl,
            },
          },
        ],
      },
    });
    if (!result.data?.length) {
      return NextResponse.json(
        {
          error: "Image could not be generated",
        },
        {
          status: 500,
        },
      );
    }
    const imageBase64 = result.data[0].b64Json;
    if (!imageBase64) {
      return NextResponse.json(
        { error: "Generated image is empty." },
        { status: 500 },
      );
    }

    const resultBuffer = Buffer.from(imageBase64, "base64");

    const { url: resultImageUrl } = await uploadBufferToImageKit({
      buffer: resultBuffer,
      fileName: `${preset.slug}-result.png`,
      folder: `/users/${userId}/results`,
      mimeType: "image/png",
    });

    const savedGeneration = await createGeneration({
      clerkUserId: userId,
      originalFileName:
        typeof originalFileName === "string" ? originalFileName : null,
      sourceImageUrl,
      resultImageUrl,
      styleSlug: preset.slug,
      styleLabel: preset.label,
      model,
      promptUsed: prompt,
    });
    return NextResponse.json({
      //   imageBase64, 
      resultImageUrl,
      mimeType: "image/png",
      promptUsed: prompt,
      style: { slug: preset.slug, label: preset.label },
      model,
      savedGeneration,
    });
  } catch (error) {
    console.error("Generate Image Error:", error);

    return NextResponse.json(
      {
        error: error.message || "Image generation failed",
      },
      {
        status: 500,
      },
    );
  }
}
