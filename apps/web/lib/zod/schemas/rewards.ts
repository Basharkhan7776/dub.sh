import { CommissionType, EventType } from "@dub/prisma/client";
import { z } from "zod";
import { getPaginationQuerySchema, maxDurationSchema } from "./misc";

export const COMMISSION_TYPES = [
  {
    value: "one-off",
    label: "One-off",
    description: "Pay a one-time payout",
  },
  {
    value: "recurring",
    label: "Recurring",
    description: "Pay an ongoing payout",
  },
] as const;

export const RewardSchema = z.object({
  id: z.string(),
  event: z.nativeEnum(EventType),
  name: z.string().nullish(),
  description: z.string().nullish(),
  type: z.nativeEnum(CommissionType),
  amount: z.number(),
  maxDuration: z.number().nullish(),
  maxRewardAmount: z.number().nullable(),
  partnersCount: z.number().nullish(),
});

export const createOrUpdateRewardSchema = z.object({
  workspaceId: z.string(),
  programId: z.string(),
  event: z.nativeEnum(EventType),
  type: z.nativeEnum(CommissionType).default("flat"),
  amount: z.number().min(0),
  maxDuration: maxDurationSchema,
  partnerIds: z.array(z.string()).nullish(),
  maxRewardAmount: z.number().nullish(),
});

export const createRewardSchema = createOrUpdateRewardSchema.superRefine(
  (data) => {
    if (data.event !== EventType.sale) {
      data.maxDuration = 0;
      data.type = "flat";
    }
  },
);

export const updateRewardSchema = createOrUpdateRewardSchema
  .omit({
    event: true,
  })
  .merge(
    z.object({
      rewardId: z.string(),
    }),
  );

export const rewardPartnersQuerySchema = z
  .object({
    rewardId: z.string(),
  })
  .merge(
    getPaginationQuerySchema({
      pageSize: 25,
    }),
  );
