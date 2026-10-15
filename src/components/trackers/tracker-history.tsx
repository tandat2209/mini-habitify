"use client";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HistoryContent, type HistoryProps } from "./history-content";
export function TrackerHistory(props: HistoryProps & { theme: string }) {
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) props.onClose();
      }}
    >
      <DialogContent data-theme={props.theme} className="dialog-scroll">
        <DialogHeader>
          <DialogTitle>{props.tracker.name}</DialogTitle>
          <DialogDescription>
            {props.tracker.archived_at
              ? "Archived · your history is preserved"
              : `${props.tracker.type} · ${props.tracker.goal_period} progress`}
          </DialogDescription>
        </DialogHeader>
        <Button asChild variant="outline" size="sm">
          <Link href={`/today/trackers/${props.tracker.id}`}>
            Open full history
          </Link>
        </Button>
        <HistoryContent {...props} />
      </DialogContent>
    </Dialog>
  );
}
