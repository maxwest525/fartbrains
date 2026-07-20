import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Mail, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const ProfileInner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) toast.error(error.message);
      setDisplayName(data?.display_name ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    const trimmed = displayName.trim();
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email ?? "",
        display_name: trimmed || null,
      });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
  };

  return (
    <div className="min-h-dvh px-5 pt-6 pb-10 max-w-md mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground press mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="text-2xl font-semibold tracking-tight mb-1">Profile</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Your account details.
      </p>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> Email
          </Label>
          <Input value={user?.email ?? ""} disabled readOnly />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="display_name"
            className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"
          >
            <UserIcon className="h-3.5 w-3.5" /> Display name{" "}
            <span className="normal-case text-muted-foreground/70">(optional)</span>
          </Label>
          <Input
            id="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What should we call you?"
            maxLength={80}
            disabled={loading}
          />
        </div>

        <Button
          onClick={onSave}
          disabled={loading || saving}
          className="w-full rounded-full h-11"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
};

const Profile = () => (
  <ProtectedRoute>
    <ProfileInner />
  </ProtectedRoute>
);

export default Profile;
