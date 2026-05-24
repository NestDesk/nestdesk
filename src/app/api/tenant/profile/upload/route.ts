import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_DOCS_BUCKET = "tenant-documents";
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const DOC_COLUMN_MAP: Record<string, string> = {
  profile_photo: "profile_photo_path",
  aadhar_front: "aadhar_front_path",
  aadhar_back: "aadhar_back_path",
  alternate_id: "alternate_id_path",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form payload." }, { status: 400 });
  }

  const docType = String(formData.get("docType") ?? "").trim();
  const file = formData.get("file");

  const columnName = DOC_COLUMN_MAP[docType];
  if (!columnName) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are supported." },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image is too large. Keep file size under 2 MB." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select(`id, ${columnName}`)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const extension = file.name.includes(".")
    ? (file.name.split(".").pop()?.toLowerCase() ?? "jpg")
    : "jpg";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
  const objectPath = `${user.id}/${docType}/${Date.now()}-${crypto
    .randomUUID()
    .slice(0, 8)}.${safeExtension}`;

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(TENANT_DOCS_BUCKET)
    .upload(objectPath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const previousPath = (tenant as Record<string, unknown>)[columnName];

  const { error: updateError } = await admin
    .from("tenants")
    .update({
      [columnName]: objectPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenant.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (typeof previousPath === "string" && previousPath.length > 0) {
    await admin.storage.from(TENANT_DOCS_BUCKET).remove([previousPath]);
  }

  const { data: signed } = await admin.storage
    .from(TENANT_DOCS_BUCKET)
    .createSignedUrl(objectPath, 60 * 30);

  return NextResponse.json({
    success: true,
    docType,
    path: objectPath,
    signedUrl: signed?.signedUrl ?? null,
  });
}
