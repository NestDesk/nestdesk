"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(_data: LoginForm) {
    try {
      // TODO: wire to Supabase auth in Week 1 Day 3
      await new Promise((r) => setTimeout(r, 1000));
      toast.success("Logged in successfully");
    } catch {
      toast.error("Invalid credentials");
    }
  }

  return (
    <Card className="w-full rounded-3xl border border-white/10 bg-white/10 shadow-2xl shadow-black/30 backdrop-blur-2xl dark:bg-white/5">
      <CardHeader className="space-y-4 pb-4 pt-8">
        <div className="flex justify-center">
          <div className="glow-ring flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-400">
            <Building2 className="h-7 w-7 text-white drop-shadow" />
          </div>
        </div>
        <div className="text-center">
          <CardTitle className="text-2xl font-bold text-white">
            Welcome back
          </CardTitle>
          <CardDescription className="text-white/60">
            Sign in to your NestDesk account
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-white/80">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-white/80">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-white/40">
          Don&apos;t have an account?{" "}
          <a
            href="#"
            className="font-medium text-white/70 underline underline-offset-2 hover:text-white"
          >
            Contact us
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
