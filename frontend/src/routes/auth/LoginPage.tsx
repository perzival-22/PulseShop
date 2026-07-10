import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { services } from "@/services";
import { useAuth } from "@/stores/auth";
import { useToasts } from "@/stores/toast";
import { AuthShell } from "./AuthShell";
import { GoogleButton } from "./GoogleButton";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const push = useToasts((s) => s.push);
  const setSession = useAuth((s) => s.setSession);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const [resetting, setResetting] = useState(false);

  const onForgotPassword = async () => {
    const email = getValues("email")?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      push("Enter your email above first");
      return;
    }
    setResetting(true);
    try {
      await services.auth.resetPassword(email);
      push("Check your inbox for a password reset link", "success");
    } catch {
      push("Couldn't send the reset email — try again", "danger");
    } finally {
      setResetting(false);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const user = await services.auth.login(data);
      setSession(user);
      if (user.accountType === "merchant") {
        push(`Welcome back to ${user.shopName}`, "success");
        navigate("/dashboard/inventory");
      } else {
        push("Welcome back", "success");
        navigate("/shops");
      }
    } catch (err) {
      if (err instanceof Error && /email not confirmed/i.test(err.message)) {
        push("Please confirm your email first — check your inbox", "danger");
        return;
      }
      push("Couldn't sign you in. Check your details and try again.", "danger");
    }
  });

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your shop HQ."
      footer={
        <>
          New to PulseShop?{" "}
          <Link to="/signup" className="font-bold text-primary">
            Create your shop
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          inputMode="email"
          placeholder="you@shop.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <div className="space-y-1.5">
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="text-right">
            <button
              type="button"
              onClick={onForgotPassword}
              disabled={resetting}
              className="text-xs font-semibold text-primary hover:underline disabled:opacity-60"
            >
              {resetting ? "Sending…" : "Forgot password?"}
            </button>
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full rounded-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
          Sign in
        </Button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs font-semibold text-muted">
        <div className="h-px flex-1 bg-white/60" />
        or
        <div className="h-px flex-1 bg-white/60" />
      </div>
      <GoogleButton intent="login" label="Continue with Google" />
    </AuthShell>
  );
}
