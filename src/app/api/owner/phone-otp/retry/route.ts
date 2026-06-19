import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { retryOwnerPhoneOtp } from "../../../../../lib/otp/service";
import { createClient } from "../../../../../lib/supabase/server";

const retrySchema = z.object({
  reqId: z.string().min(1, "Request ID is required."),
  retryChannel: z.union([z.string(), z.number()]).optional().default("11"), // e.g. "11" for SMS, "12" for WhatsApp
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  try {
    const result = await retryOwnerPhoneOtp({
      reqId: parsed.data.reqId,
      retryChannel: parsed.data.retryChannel,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retry OTP." },
      { status: 400 },
    );
  }
}
