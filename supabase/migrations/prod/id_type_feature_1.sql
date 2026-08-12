-- Add generic government ID fields without touching legacy Aadhaar data
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS govt_id_type TEXT,
  ADD COLUMN IF NOT EXISTS govt_id_number TEXT,
  ADD COLUMN IF NOT EXISTS govt_id_number_hash TEXT,
  ADD COLUMN IF NOT EXISTS govt_id_last4 TEXT,
  ADD COLUMN IF NOT EXISTS govt_id_front_path TEXT,
  ADD COLUMN IF NOT EXISTS govt_id_back_path TEXT;

-- Backfill existing Aadhaar records into the generic fields so old tenants remain valid
UPDATE public.tenants
SET
  govt_id_type = COALESCE(govt_id_type, CASE
    WHEN aadhar_number IS NOT NULL AND aadhar_number <> '' THEN 'Aadhaar'
    ELSE NULL
  END),
  govt_id_number = COALESCE(govt_id_number, aadhar_number),
  govt_id_last4 = COALESCE(govt_id_last4, aadhar_last4)
WHERE
  govt_id_type IS NULL
  OR govt_id_number IS NULL
  OR govt_id_last4 IS NULL;

-- Optional: keep old data safe while allowing a generic ID uniqueness check when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_govt_id_number_hash_unique
ON public.tenants(govt_id_number_hash)
WHERE govt_id_number_hash IS NOT NULL
  AND deleted_at IS NULL;

-- Helpful validation view for checking the migration result
SELECT
 * 
FROM public.tenants

ORDER BY updated_at DESC;


