import { NextResponse } from "next/server";
import { openrouter } from "@/lib/openRouter";

export async function GET() {
  try {
    const result = await openrouter.images.generate({
      imageGenerationRequest: {
        model: "black-forest-labs/flux.2-klein-4b",
        prompt: "A cute cat wearing sunglasses",
      },
    });

    

    return NextResponse.json(result);
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }
}
