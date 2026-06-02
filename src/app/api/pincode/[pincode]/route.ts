import { NextRequest, NextResponse } from "next/server";
import https from "https";

const PINCODE_REGEX = /^\d{6}$/;

function fetchPincodeData(pincode: string) {
  return new Promise<string>((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.postalpincode.in",
        path: `/pincode/${encodeURIComponent(pincode)}`,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        agent: new https.Agent({ rejectUnauthorized: false }),
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { pincode: string } },
) {
  const pincode = String(params.pincode ?? "").trim();
  if (!PINCODE_REGEX.test(pincode)) {
    return NextResponse.json(
      { error: "Enter a valid 6-digit pincode." },
      { status: 400 },
    );
  }

  try {
    const raw = await fetchPincodeData(pincode);
    const json = JSON.parse(raw) as Array<{
      Status?: string;
      PostOffice?: Array<{ Name?: string; District?: string; State?: string }>;
    }>;

    const first = json?.[0];
    if (!first || first.Status !== "Success" || !Array.isArray(first.PostOffice)) {
      return NextResponse.json(
        { error: "No postal data found for this pincode." },
        { status: 404 },
      );
    }

    const postOffice = first.PostOffice[0];
    if (!postOffice) {
      return NextResponse.json(
        { error: "No postal data found for this pincode." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      city: postOffice.District?.trim() ?? "",
      state: postOffice.State?.trim() ?? "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to resolve pincode right now.",
      },
      { status: 502 },
    );
  }
}
