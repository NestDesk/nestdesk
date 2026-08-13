import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

const TENANT_DOCS_BUCKET = "tenant-documents";
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const DOC_COLUMN_MAP = {
  profile_photo: "profile_photo_path",
  govt_id_front: "govt_id_front_path",
  govt_id_back: "govt_id_back_path",
  alternate_id: "alternate_id_path",
} as const;

type DocType = keyof typeof DOC_COLUMN_MAP;
type TenantDocColumn = (typeof DOC_COLUMN_MAP)[DocType];

function isDocType(value: string): value is DocType {
  return value in DOC_COLUMN_MAP;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const parsedParams = z.object({ id: z.string().uuid() }).safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid tenant id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: owner, error: ownerError } = await admin
    .from("owners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (ownerError) {
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }
  if (!owner) {
    return NextResponse.json({ error: "Owner account not found." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form payload." }, { status: 400 });
  }

  const docType = String(formData.get("docType") ?? "").trim();
  const file = formData.get("file");
  if (!isDocType(docType)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are supported." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image is too large. Keep file size under 2 MB." },
      { status: 400 },
    );
  }

  const columnName: TenantDocColumn = DOC_COLUMN_MAP[docType];
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select(`id, ${columnName}`)
    .eq("id", parsedParams.data.id)
    .eq("owner_id", owner.id)
    .is("deleted_at", null)
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
  const objectPath = `${owner.id}/owner/${parsedParams.data.id}/${docType}/${Date.now()}-${crypto
    .randomUUID()
    .slice(0, 8)}.${safeExtension}`;

  const { error: uploadError } = await admin.storage
    .from(TENANT_DOCS_BUCKET)
    .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const previousPath = (tenant as Record<string, unknown>)[columnName] as
    | string
    | null;
  const { error: updateError } = await admin
    .from("tenants")
    .update({ [columnName]: objectPath, updated_at: new Date().toISOString() })
    .eq("id", tenant.id)
    .eq("owner_id", owner.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (previousPath) {
    await admin.storage.from(TENANT_DOCS_BUCKET).remove([previousPath]);
  }

  const { data: signed } = await admin.storage
    .from(TENANT_DOCS_BUCKET)
    .createSignedUrl(objectPath, 60 * 30);
  return NextResponse.json({
    success: true,
    docType,
    signedUrl: signed?.signedUrl ?? null,
  });
}
