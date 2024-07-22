"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { OAuthAppProps } from "@/lib/types";
import { useRemoveIntegrationModal } from "@/ui/modals/remove-integration-modal";
import { ThreeDots } from "@/ui/shared/icons";
import {
  BlurImage,
  Button,
  LoadingSpinner,
  MaxWidthWrapper,
  Popover,
  TokenAvatar,
} from "@dub/ui";
import { cn, fetcher } from "@dub/utils";
import { ChevronLeft, Trash } from "lucide-react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import AddEditIntegrationForm from "../../add-edit-integration-form";
import AppCredentials from "./credentials";

export default function IntegrationManagePageClient({
  integrationId,
}: {
  integrationId: string;
}) {
  const searchParams = useSearchParams();
  const { slug, id: workspaceId } = useWorkspace();
  const [openPopover, setOpenPopover] = useState(false);
  const { data: integration, isLoading } = useSWR<OAuthAppProps>(
    `/api/oauth/apps/${integrationId}?workspaceId=${workspaceId}`,
    fetcher,
  );

  const { RemoveIntegrationModal, setShowRemoveIntegrationModal } =
    useRemoveIntegrationModal({
      integration,
    });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!integration) {
    return notFound();
  }

  return (
    <>
      <MaxWidthWrapper className="my-10 grid max-w-screen-lg gap-8">
        <RemoveIntegrationModal />
        <Link
          href={`/${slug}/integrations/manage`}
          className="flex items-center gap-x-1"
        >
          <ChevronLeft className="size-4" />
          <p className="text-sm font-medium text-gray-500">Integrations</p>
        </Link>
        <div className="flex justify-between">
          <div className="flex items-center gap-x-3">
            <div className="rounded-md border border-gray-200 bg-gradient-to-t from-gray-100 p-2">
              {integration.logo ? (
                <BlurImage
                  src={integration.logo}
                  alt={`Logo for ${integration.name}`}
                  className="size-8 rounded-full border border-gray-200"
                  width={20}
                  height={20}
                />
              ) : (
                <TokenAvatar id={integration.clientId} className="size-8" />
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-700">{integration.name}</p>
              <p className="text-sm text-gray-500">{integration.description}</p>
            </div>
          </div>

          <Popover
            align="end"
            content={
              <div className="grid w-screen gap-px p-2 sm:w-48">
                <Button
                  text="Remove Integration"
                  variant="danger-outline"
                  icon={<Trash className="h-4 w-4" />}
                  className="h-9 justify-start px-2"
                  onClick={() => {
                    setShowRemoveIntegrationModal(true);
                  }}
                />
              </div>
            }
            openPopover={openPopover}
            setOpenPopover={setOpenPopover}
          >
            <button
              onClick={() => setOpenPopover(!openPopover)}
              className={cn(
                "flex h-10 items-center rounded-md border px-1.5 outline-none transition-all",
                "border-gray-200 bg-white text-gray-900 placeholder-gray-400",
                "focus-visible:border-gray-500 data-[state=open]:border-gray-500 data-[state=open]:ring-4 data-[state=open]:ring-gray-200",
              )}
            >
              <ThreeDots className="h-5 w-5 text-gray-500" />
            </button>
          </Popover>
        </div>
      </MaxWidthWrapper>

      <MaxWidthWrapper className="max-w-screen-lg space-y-10">
        <AppCredentials
          clientId={integration.clientId}
          clientSecret={searchParams.get("client_secret") || null}
        />
        <AddEditIntegrationForm integration={integration} />
      </MaxWidthWrapper>
    </>
  );
}
