"use client";

import { useTransition } from "react";
import { MoreHorizontal, Flag, CheckCircle, Trash2 } from "lucide-react";

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
} from "./actions";

interface PostActionsProps {
  postId: string;
  status: string;
}

export function PostActions({ postId, status }: PostActionsProps) {
  const [isPending, startTransition] = useTransition();

  const isFlagged = status === "flagged";
  const isCancelled = status === "cancelled";
  const isActive = status === "active";

  function handleFlag() {
    startTransition(async () => {
      await flagPostAction(postId);
    });
  }

  function handleUnflag() {
    startTransition(async () => {
      await unflagPostAction(postId);
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removePostAction(postId);
    });
  }

  function handleReinstate() {
    startTransition(async () => {
      await reinstatePostAction(postId);
    });
  }

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
