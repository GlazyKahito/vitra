"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { simulateDeviceTickAction, rotateDeviceKeyAction } from "@/app/actions/devices";

export interface DeviceActionsProps {
  deviceId: string;
  simulated: boolean;
  canManage: boolean;
  isAdmin: boolean;
}

export function DeviceActions({ deviceId, simulated, canManage, isAdmin }: DeviceActionsProps) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function tick() {
    setError(null);
    setMsg(null);
    start(async () => {
      const res = await simulateDeviceTickAction(deviceId);
      if (res.ok) {
        setMsg("Simulated event recorded.");
        router.refresh();
      } else setError(res.error);
    });
  }

  function rotate() {
    setError(null);
    start(async () => {
      const res = await rotateDeviceKeyAction(deviceId);
      setConfirmOpen(false);
      if (res.ok) {
        setKey(res.plaintextKey);
        setCopied(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  async function copy() {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {simulated ? (
          <Button variant="secondary" size="sm" onClick={tick} loading={pending} disabled={!canManage} leading={<RadioTower className="size-4" />}>
            Simulate tick
          </Button>
        ) : (
          <span className="t-mono text-[11px] text-fg-4">Hardware device: no simulation.</span>
        )}
        <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(true)} disabled={!isAdmin} leading={<KeyRound className="size-4" />} title={isAdmin ? undefined : "admin only"}>
          Rotate ingest key
        </Button>
        {!canManage ? <span className="t-mono text-[11px] text-fg-4">requires devices.manage</span> : !isAdmin ? <span className="t-mono text-[11px] text-fg-4">key rotation: admin only</span> : null}
      </div>
      {msg ? (
        <p className="text-[12px] text-fg-3" role="status">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p className="text-[12px] text-fault" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        eyebrow="Ingest key"
        title="Rotate this device's key?"
        description="The current key stops working immediately. Any device still using it will receive 401 on /api/ingest until it is reconfigured."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={rotate} loading={pending}>
              Rotate key
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-fg-2">Only a scrypt hash is stored. The new key is shown once, in the next dialog.</p>
      </Dialog>

      <Dialog open={key !== null} onClose={() => setKey(null)} dismissible={false} eyebrow="Ingest key" title="New key — shown once" description="Copy it into the device's configuration now. It cannot be retrieved later; rotating again is the only recovery.">
        <div className="flex items-center gap-2">
          <code className="t-mono flex-1 break-all rounded-[var(--radius-sm)] border border-line-strong bg-ink-1 px-3 py-2 text-[12.5px] text-fg">{key}</code>
          <Button variant="secondary" size="sm" onClick={copy} leading={<Copy className="size-4" />}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => setKey(null)}>
            I have stored it
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
