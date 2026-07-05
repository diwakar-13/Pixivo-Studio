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
import { ACCEPTED_SOURCE_IMAGE_MIME_TYPES } from "@/lib/constant";
import { getStylePreset } from "@/lib/style-presents";
import { uploadBufferToImageKit } from "@/lib/imagekit";

export const runtime = "nodejs";

async function inferImageSize(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) {
      return "1024x1024";
    }
    const aspectRatio = metadata.width / metadata.height;
    if (aspectRatio > 1.08) return "1536x1024";
    if (aspectRatio < 0.92) return "1024x1536";
    return "1024x1024";
  } catch {
    return "1024x1024";
  }
}

export async function POST(request) {
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

  const body = await request.json();
  const { model, originalFileName, sourceImageUrl, sourceMimeType, styleSlug } =
    body;

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
  const imageSize = await inferImageSize(imageBuffer);

  const prompt = [
    `Using the input reference image located at: ${sourceImageUrl}`,
    preset.prompt,
    "CRITICAL REQUIREMENT: You MUST preserve the exact gender, facial structure, haircut, identity, and expression of the person in the provided reference image.",
    "If the person in the image is a boy, the output MUST be a boy. If the person is a girl, the output MUST be a girl. Do not switch genders under any circumstance.",
    "Do not add extra people, duplicate subjects, extra limbs, or change the background context drastically.",
  ].join("\n\n");

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "Missing OPENROUTER_API_KEY." },
      { status: 500 },
    );
  }

  try {
    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: sourceImageUrl } },
              ],
            },
          ],
        }),
      },
    );

    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      throw new Error(`OpenRouter API error: ${errText}`);
    }

    const result = await openRouterResponse.json();

    let imageBase64 = null;
    let directUrl = null;

    // Standard Parsing
    if (result.choices?.[0]?.message?.content) {
      const content = result.choices[0].message.content.trim();
      if (content.startsWith("http")) {
        directUrl = content;
      } else {
        try {
          const parsedContent = JSON.parse(content);
          const targetObj = Array.isArray(parsedContent)
            ? parsedContent[0]
            : parsedContent;
          const extractedUrl =
            targetObj?.image_url?.url ||
            targetObj?.url ||
            targetObj?.image ||
            targetObj?.b64Json;

          if (extractedUrl?.startsWith("http")) {
            directUrl = extractedUrl;
          } else if (extractedUrl) {
            imageBase64 = extractedUrl
              .replace(/^data:image\/[a-z]+;base64,/, "")
              .trim();
          }
        } catch {
          if (content.includes("data:image") || content.length > 500) {
            imageBase64 = content
              .replace(/^data:image\/[a-z]+;base64,/, "")
              .trim();
          }
        }
      }
    }

    if (!directUrl && !imageBase64 && result.data?.[0]) {
      imageBase64 = result.data[0].b64Json || null;
      directUrl = result.data[0].url || null;
    }

    if (!directUrl && !imageBase64 && result.results?.[0]) {
      directUrl = result.results[0].url || null;
      imageBase64 = result.results[0].b64Json || null;
    }

    // Regex Fallback
    if (!directUrl && !imageBase64) {
      const stringifiedResult = JSON.stringify(result);
      const urlMatches = stringifiedResult.match(/https?:\/\/[^\s"'<>\\,]+/g);
      if (urlMatches) {
        const validLink = urlMatches.find(
          (url) =>
            !url.includes("openrouter.ai") &&
            (url.includes(".png") ||
              url.includes(".jpg") ||
              url.includes("storage") ||
              url.includes("generation") ||
              url.includes("usercontent")),
        );
        if (validLink) directUrl = validLink;
      }

      if (!directUrl) {
        const base64Match = stringifiedResult.match(/[A-Za-z0-9+/]{1000,}/g);
        if (base64Match) imageBase64 = base64Match[0];
      }
    }

    let resultBuffer = null;
    if (imageBase64 && imageBase64.length > 200) {
      resultBuffer = Buffer.from(imageBase64, "base64");
    } else if (directUrl && directUrl.startsWith("http")) {
      const res = await fetch(directUrl);
      if (res.ok) {
        resultBuffer = Buffer.from(await res.arrayBuffer());
      }
    }

    if (!resultBuffer) {
      return NextResponse.json(
        { error: `Exact structure not recognized.` },
        { status: 422 },
      );
    }

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

    Sentry.logger.info("generation.completed", {
      generationId: savedGeneration.id,
      styleSlug: preset.slug,
      model,
    });

    return NextResponse.json({
      imageBase64: imageBase64 || resultBuffer.toString("base64"),
      mimeType: "image/png",
      promptUsed: prompt,
      style: { slug: preset.slug, label: preset.label },
      model,
      savedGeneration,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Image generation failed. Please try again." },
      { status: 500 },
    );
  }
}
