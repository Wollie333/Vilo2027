"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Flag,
  CheckCircle,
  Trash2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  flagPostAction,
  unflagPostAction,
  removePostAction,
  reinstatePostAction,
  suspendPostAction,
  resumePostAction,
} from "./actions";

interface PostActionsProps {
  postId: string;
  status: string;
}

type ModerationAction = (
  postId: string,
) => Promise<{ success: true } | { success: false; error: string }>;

export function PostActions({ postId, status }: PostActionsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isFlagged = status === "flagged";
  const isCancelled = status === "cancelled";
  const isActive = status === "active";
  const isSuspended = status === "suspended";

  // Every moderation result is surfaced (RULES.md §4 — no click may feel dead).
  // These handlers used to discard the action's return value entirely, so a
  // failure — including an update that matched zero rows — looked exactly like a
  // success: nothing happened and nothing was said.
  function run(action: ModerationAction, successMessage: string) {
    startTransition(async () => {
      const res = await action(postId);
      if (res.success) {
        toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const handleFlag = () => run(flagPostAction, "Post flagged for review.");
  const handleUnflag = () => run(unflagPostAction, "Post approved.");
  const handleRemove = () => run(removePostAction, "Post removed.");
  const handleReinstate = () => run(reinstatePostAction, "Post reinstated.");
  const handleSuspend = () => run(suspendPostAction, "Post paused.");
  const handleResume = () => run(resumePostAction, "Post resumed.");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!isFlagged && isActive && (
          <DropdownMenuItem onClick={handleFlag}>
            <Flag className="mr-2 h-4 w-4 text-amber-600" />
            Flag for review
          </DropdownMenuItem>
        )}

        {isFlagged && (
          <DropdownMenuItem onClick={handleUnflag}>
            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
            Approve (unflag)
          </DropdownMenuItem>
        )}

        {isActive && (
          <DropdownMenuItem onClick={handleSuspend}>
            <PauseCircle className="mr-2 h-4 w-4 text-slate-600" />
            Pause (suspend)
          </DropdownMenuItem>
        )}

        {isSuspended && (
          <DropdownMenuItem onClick={handleResume}>
            <PlayCircle className="mr-2 h-4 w-4 text-green-600" />
            Resume post
          </DropdownMenuItem>
        )}

        {isCancelled && (
          <DropdownMenuItem onClick={handleReinstate}>
            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
            Reinstate post
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {!isCancelled && (
          <DropdownMenuItem onClick={handleRemove} className="text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Remove post
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
