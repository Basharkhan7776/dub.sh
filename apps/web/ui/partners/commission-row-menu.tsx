import { updateCommissionStatusAction } from "@/lib/actions/partners/update-commission-status";
import { mutatePrefix } from "@/lib/swr/mutate";
import useWorkspace from "@/lib/swr/use-workspace";
import { CommissionResponse } from "@/lib/types";
import { Button, Icon, Popover, useCopyToClipboard } from "@dub/ui";
import {
  CircleCheck,
  CircleHalfDottedClock,
  Dots,
  Duplicate,
  InvoiceDollar,
  ShieldAlert,
  User,
} from "@dub/ui/icons";
import { cn } from "@dub/utils";
import { Row } from "@tanstack/react-table";
import { Command } from "cmdk";
import { useAction } from "next-safe-action/hooks";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function CommissionRowMenu({ row }: { row: Row<CommissionResponse> }) {
  const { id: workspaceId } = useWorkspace();
  const { programId } = useParams() as { programId: string };
  const [isOpen, setIsOpen] = useState(false);

  const { executeAsync } = useAction(updateCommissionStatusAction, {
    onSuccess: async () => {
      await mutatePrefix([
        "/api/commissions",
        `/api/programs/${programId}/payouts`,
      ]);
    },
  });

  const updateStatus = (status: "pending" | "duplicate" | "fraud") => {
    toast.promise(
      executeAsync({
        workspaceId: workspaceId!,
        commissionId: row.original.id,
        status,
      }),
      {
        loading: "Updating sale status...",
        success: "Sale status updated",
        error: "Failed to update sale status",
      },
    );
  };

  const isPaid = row.original.status === "paid";

  const [copiedCustomerId, copyCustomerIdToClipboard] = useCopyToClipboard();
  const [copiedInvoiceId, copyInvoiceIdToClipboard] = useCopyToClipboard();

  return (
    <Popover
      openPopover={isOpen}
      setOpenPopover={setIsOpen}
      content={
        <Command tabIndex={0} loop className="pointer-events-auto">
          <Command.List className="flex w-screen flex-col gap-1 text-sm focus-visible:outline-none sm:w-auto sm:min-w-[180px]">
            <Command.Group className="p-1.5">
              {["duplicate", "fraud"].includes(row.original.status) ? (
                <MenuItem
                  icon={CircleHalfDottedClock}
                  label="Mark as pending"
                  onSelect={() => {
                    updateStatus("pending");
                    setIsOpen(false);
                  }}
                />
              ) : (
                <>
                  <MenuItem
                    icon={Duplicate}
                    label="Mark as duplicate"
                    onSelect={() => {
                      updateStatus("duplicate");
                      setIsOpen(false);
                    }}
                    disabled={isPaid}
                  />
                  <MenuItem
                    icon={ShieldAlert}
                    label="Mark as fraud"
                    onSelect={() => {
                      updateStatus("fraud");
                      setIsOpen(false);
                    }}
                    disabled={isPaid}
                  />
                </>
              )}
            </Command.Group>
            {row.original.invoiceId && (
              <>
                <Command.Separator className="w-full border-t border-neutral-200" />
                <Command.Group className="p-1.5">
                  {row.original.customer?.externalId && (
                    <MenuItem
                      icon={copiedCustomerId ? CircleCheck : User}
                      label="Copy customer ID"
                      onSelect={() => {
                        copyCustomerIdToClipboard(
                          row.original.customer!.externalId!, // can safely assert cause we check for externalId above
                        );
                        toast.success("Customer ID copied to clipboard");
                      }}
                    />
                  )}
                  <MenuItem
                    icon={copiedInvoiceId ? CircleCheck : InvoiceDollar}
                    label="Copy invoice ID"
                    onSelect={() => {
                      copyInvoiceIdToClipboard(row.original.invoiceId!);
                      toast.success("Invoice ID copied to clipboard");
                    }}
                  />
                </Command.Group>
              </>
            )}
          </Command.List>
        </Command>
      }
      align="end"
    >
      <Button
        type="button"
        className="h-8 whitespace-nowrap px-2"
        variant="outline"
        icon={<Dots className="h-4 w-4 shrink-0" />}
      />
    </Popover>
  );
}

function MenuItem({
  icon: IconComp,
  label,
  onSelect,
  disabled,
}: {
  icon: Icon;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <Command.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-md p-2 text-sm text-neutral-600",
        "data-[selected=true]:bg-neutral-100",
        disabled && "cursor-not-allowed opacity-50",
      )}
      onSelect={onSelect}
      disabled={disabled}
    >
      <IconComp className="size-4 shrink-0 text-neutral-500" />
      {label}
    </Command.Item>
  );
}
