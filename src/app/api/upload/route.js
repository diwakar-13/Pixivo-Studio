import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUploadAuthParams } from "@imagekit/next/server";

import * as Sentry from "@sentry/nextjs";
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    Sentry.logger.info("imagekit.upload_auth_issued");

    const { token, expire, signature } = getUploadAuthParams({
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
    });
    return NextResponse.json({
      token,
      expire,
      signature,
      publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
    });
  } catch (error) {
    console.error("ImageKit Auth Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate ImageKit upload credentials.",
      },
      { status: 500 },
    );
  }
}
