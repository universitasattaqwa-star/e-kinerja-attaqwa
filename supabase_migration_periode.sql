-- 1. Create Periode Table
CREATE TABLE IF NOT EXISTS public.periode (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_periode TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add periode_id to Submissions (Null allowed for historical backwards-compatibility if any)
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS periode_id UUID REFERENCES public.periode(id) ON DELETE SET NULL;

-- 3. Create Function and Trigger to Ensure Only One Active Period
CREATE OR REPLACE FUNCTION public.ensure_single_active_periode()
RETURNS TRIGGER AS $$
BEGIN
    -- If this record is being set to active
    IF NEW.is_active = true THEN
        -- Set all other records to inactive
        UPDATE public.periode 
        SET is_active = false 
        WHERE id != NEW.id AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_single_active_periode ON public.periode;
CREATE TRIGGER trigger_single_active_periode
BEFORE INSERT OR UPDATE OF is_active
ON public.periode
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_active_periode();

-- 4. Enable RLS
ALTER TABLE public.periode ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Everyone can read periods
CREATE POLICY "Allow public read access to periode" ON public.periode
    FOR SELECT USING (true);

-- Allow authenticated full access to periode
CREATE POLICY "Allow authenticated full access to periode" ON public.periode
    FOR ALL USING (auth.role() = 'authenticated');
