import { Check, Loader2, Phone, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { PayPalIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Modal";
import { formatKes } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { services } from "@/services";
import type { PaymentMethod } from "@/types";

type Stage =
  | { step: "choose" }
  | { step: "mpesa-phone" }
  | { step: "pending"; method: PaymentMethod }
  | { step: "paypal-approve" }
  | { step: "success"; method: PaymentMethod }
  | { step: "failed"; method: PaymentMethod };

export function PaymentSheet({
  open,
  onOpenChange,
  amount,
  defaultPhone,
  merchantName,
  merchantWhatsApp,
  orderReference,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  defaultPhone: string;
  merchantName: string;
  merchantWhatsApp: string;
  /** The order this payment is for — already created (pending) before the sheet opens. */
  orderReference: string;
  onPaid: (method: PaymentMethod) => void;
}) {
  const [stage, setStage] = useState<Stage>({ step: "choose" });
  const [method, setMethod] = useState<PaymentMethod>("mpesa");
  const [phone, setPhone] = useState(defaultPhone);

  // prefill with the customer's phone from the order form each time the sheet opens
  useEffect(() => {
    if (open && defaultPhone) setPhone(defaultPhone);
  }, [open, defaultPhone]);

  const reset = (next: boolean) => {
    onOpenChange(next);
    if (!next) setStage({ step: "choose" });
  };

  const startMpesa = async () => {
    setStage({ step: "pending", method: "mpesa" });
    try {
      const result = await services.payments.payWithMpesa(phone, amount);
      if (result.status === "paid") {
        setStage({ step: "success", method: "mpesa" });
        onPaid("mpesa");
      } else {
        setStage({ step: "failed", method: "mpesa" });
      }
    } catch {
      setStage({ step: "failed", method: "mpesa" });
    }
  };

  const startPaypal = async () => {
    setStage({ step: "pending", method: "paypal" });
    try {
      const result = await services.payments.payWithPaypal(amount);
      if (result.status === "paid") {
        setStage({ step: "success", method: "paypal" });
        onPaid("paypal");
      } else {
        setStage({ step: "failed", method: "paypal" });
      }
    } catch {
      setStage({ step: "failed", method: "paypal" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={reset} title="Complete Payment">
      {stage.step === "choose" && (
        <div className="space-y-4">
          <p className="text-center text-2xl font-extrabold text-ink">{formatKes(amount)}</p>

          {/* method toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-btn bg-stone-100 p-1">
            {(["mpesa", "paypal"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-[10px] text-sm font-bold transition-all",
                  method === m ? "bg-card text-ink shadow-soft" : "text-muted",
                )}
              >
                {m === "mpesa" ? (
                  <>
                    <Phone className="size-4 text-success" /> M-Pesa
                  </>
                ) : (
                  <>
                    <PayPalIcon className="size-4 text-facebook" /> PayPal
                  </>
                )}
              </button>
            ))}
          </div>

          {method === "mpesa" ? (
            <div className="space-y-3">
              <Input
                label="M-Pesa phone number"
                placeholder="+254 712 345 678"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Button
                size="lg"
                className="w-full"
                disabled={phone.replace(/\D/g, "").length < 9}
                onClick={startMpesa}
              >
                Send STK Prompt
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-sm text-muted">
                You'll be redirected to PayPal to approve this payment.
              </p>
              <button
                type="button"
                onClick={() => setStage({ step: "paypal-approve" })}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-[#FFC439] text-sm font-extrabold text-[#003087] transition-transform active:scale-[0.98]"
              >
                <PayPalIcon className="size-5" />
                Pay with PayPal
              </button>
            </div>
          )}
        </div>
      )}

      {stage.step === "paypal-approve" && (
        <div className="space-y-4 text-center">
          <div className="rounded-card border border-stone-200 bg-stone-50 p-5">
            <PayPalIcon className="mx-auto size-8 text-[#003087]" />
            <p className="mt-3 text-sm font-semibold text-ink">
              Approve payment of {formatKes(amount)} to {merchantName}?
            </p>
            <p className="mt-1 text-xs text-muted">PayPal sandbox — mock approval</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStage({ step: "choose" })}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={startPaypal}>
              Approve
            </Button>
          </div>
        </div>
      )}

      {stage.step === "pending" && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <Loader2 className="size-10 animate-spin text-primary" />
          <div>
            <p className="font-bold text-ink">
              {stage.method === "mpesa" ? "Check your phone" : "Talking to PayPal…"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {stage.method === "mpesa"
                ? "Enter your M-Pesa PIN on the STK prompt to complete payment."
                : "Confirming your payment…"}
            </p>
          </div>
        </div>
      )}

      {stage.step === "success" && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-success/10 animate-check-pop">
            <Check className="size-8 text-success" strokeWidth={3} />
          </div>
          <div>
            <p className="text-lg font-extrabold text-ink">Payment successful!</p>
            <p className="mt-1 text-sm text-muted">
              Order reference:{" "}
              <span className="font-mono font-bold text-ink">{orderReference}</span>
            </p>
          </div>
          <a
            href={`https://wa.me/${merchantWhatsApp}?text=${encodeURIComponent(
              `Hi! I just paid for my order ${orderReference}. Please confirm delivery details.`,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-bold text-whatsapp"
          >
            <WhatsAppIcon className="size-4" />
            Track via WhatsApp
          </a>
          <Button variant="dark" className="w-full" onClick={() => reset(false)}>
            Done
          </Button>
        </div>
      )}

      {stage.step === "failed" && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-danger/10">
            <RotateCcw className="size-7 text-danger" />
          </div>
          <p className="font-bold text-ink">Payment failed</p>
          <Button
            className="w-full"
            onClick={() =>
              stage.method === "mpesa" ? setStage({ step: "mpesa-phone" }) : startPaypal()
            }
          >
            Try again
          </Button>
        </div>
      )}

      {stage.step === "mpesa-phone" && (
        <div className="space-y-3">
          <Input
            label="M-Pesa phone number"
            placeholder="+254 712 345 678"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button size="lg" className="w-full" onClick={startMpesa}>
            Retry payment
          </Button>
        </div>
      )}
    </Sheet>
  );
}
