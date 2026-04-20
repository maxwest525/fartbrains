-- 1. Add columns to folders
ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ NULL;

-- Backfill updated_at for existing rows
UPDATE public.folders SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = now();

-- 2. Trigger: auto-touch folders.updated_at on folder UPDATE
DROP TRIGGER IF EXISTS folders_set_updated_at ON public.folders;
CREATE TRIGGER folders_set_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Function: when an idea is inserted/updated/deleted, bump its folder(s) updated_at
CREATE OR REPLACE FUNCTION public.touch_folder_on_idea_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.folder_id IS NOT NULL THEN
      UPDATE public.folders SET updated_at = now() WHERE id = OLD.folder_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.folder_id IS NOT NULL THEN
      UPDATE public.folders SET updated_at = now() WHERE id = NEW.folder_id;
    END IF;
    RETURN NEW;
  ELSE -- UPDATE
    IF NEW.folder_id IS DISTINCT FROM OLD.folder_id THEN
      IF OLD.folder_id IS NOT NULL THEN
        UPDATE public.folders SET updated_at = now() WHERE id = OLD.folder_id;
      END IF;
      IF NEW.folder_id IS NOT NULL THEN
        UPDATE public.folders SET updated_at = now() WHERE id = NEW.folder_id;
      END IF;
    ELSIF NEW.folder_id IS NOT NULL THEN
      UPDATE public.folders SET updated_at = now() WHERE id = NEW.folder_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS ideas_touch_folder ON public.ideas;
CREATE TRIGGER ideas_touch_folder
  AFTER INSERT OR UPDATE OR DELETE ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_folder_on_idea_change();