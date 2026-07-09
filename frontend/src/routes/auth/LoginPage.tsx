import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { services } from "@/services";
import { useAuth } from "@/stores/auth";
import { useToasts } from "@/stores/toast";
import { AuthShell } from "./AuthShell";

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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (data) => {
    try {
      const user = await services.auth.login(data);
      setSession(user);
      push(`Welcome back to ${user.shopName}`, "success");
      navigate("/dashboard/inventory");
    } catch {
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
            <button type="button" className="text-xs font-semibold text-primary hover:underline">
              Forgot password?
            </button>
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full rounded-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
