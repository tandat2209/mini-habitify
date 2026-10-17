"use client";

import Link from "next/link";
import {
  Cable,
  ChevronRight,
  LayoutTemplate,
  Palette,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SettingsMenu({
  theme,
  onTemplates,
  onAppearance,
}: {
  theme: string;
  onTemplates: () => void;
  onAppearance: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings data-icon="inline-start" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent data-theme={theme}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Make this space work for you.</DialogDescription>
        </DialogHeader>
        <nav aria-label="Settings" className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              setOpen(false);
              onTemplates();
            }}
          >
            <LayoutTemplate data-icon="inline-start" />
            Templates
            <ChevronRight data-icon="inline-end" className="ml-auto" />
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              setOpen(false);
              onAppearance();
            }}
          >
            <Palette data-icon="inline-start" />
            Appearance
            <ChevronRight data-icon="inline-end" className="ml-auto" />
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link href="/settings/connections">
              <Cable data-icon="inline-start" />
              Agent connections
              <ChevronRight data-icon="inline-end" className="ml-auto" />
            </Link>
          </Button>
        </nav>
      </DialogContent>
    </Dialog>
  );
}
