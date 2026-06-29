"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  Copy,
  MoreHorizontal,
  RefreshCw,
  Share2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  cancelRequestAction,
  duplicateRequestAction,
  extendRequestAction,
  markFulfilledAction,
  reopenRequestAction,
} from "../../actions";

interface PostActionsProps {
  postId: string;
  status: string;
}

export function PostActions({ postId, status }: PostActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showFulfilledDialog, setShowFulfilledDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [fulfilledVia, setFulfilledVia] = useState<
    "vilo_booking" | "ota" | "direct" | "other"
  >("vilo_booking");

  function handleExtend() {
    startTransition(async () => {
      const result = await extendRequestAction(postId);
      if (result.success) {
        router.refresh();
      }
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateRequestAction(postId);
      if (result.success && "data" in result && result.data?.id) {
        router.push(`/portal/looking-for/${result.data.id}`);
      }
    });
  }

  function handleShare() {
    const url = `${window.location.origin}/looking-for/${postId}`;
    navigator.clipboard.writeText(url);
    // Could add toast notification here
  }

  function handleMarkFulfilled() {
    startTransition(async () => {
      const result = await markFulfilledAction(postId, fulfilledVia);
      if (result.success) {
        setShowFulfilledDialog(false);
        router.refresh();
      }
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelRequestAction(postId);
      if (result.success) {
        setShowCancelDialog(false);
        router.push("/portal/looking-for");
      }
    });
  }

  function handleReopen() {
    startTransition(async () => {
      const result = await reopenRequestAction(postId);
      if (result.success) {
        router.refresh();
      }
    });
  }

  const isActive = status === "active";
  const canExtend = isActive || status === "expired";
  const canReopen = status === "fulfilled" || status === "cancelled";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canExtend && (
            <DropdownMenuItem onClick={handleExtend} disabled={isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Extend by 7 days
            </DropdownMenuItem>
          )}
          {canReopen && (
            <DropdownMenuItem onClick={handleReopen} disabled={isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Re-open request
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleDuplicate} disabled={isPending}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Copy link
          </DropdownMenuItem>
          {isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowFulfilledDialog(true)}>
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                Mark as fulfilled
              </DropdownMenuItem>
            </>
          )}
          {(isActive || status === "draft") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowCancelDialog(true)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Cancel request
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Fulfilled Dialog */}
      <Dialog open={showFulfilledDialog} onOpenChange={setShowFulfilledDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Fulfilled</DialogTitle>
            <DialogDescription>
              How did you fulfill this request?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={fulfilledVia}
              onValueChange={(v) => setFulfilledVia(v as typeof fulfilledVia)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vilo_booking">
                  Booked through Wielo
                </SelectItem>
                <SelectItem value="ota">
                  Booked on another platform (Airbnb, Booking.com, etc.)
                </SelectItem>
                <SelectItem value="direct">
                  Booked directly with host
                </SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFulfilledDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleMarkFulfilled} disabled={isPending}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this request? Hosts will no longer
              be able to send you quotes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep request
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
