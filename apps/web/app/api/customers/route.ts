import { createId } from "@/lib/api/create-id";
import { determineCustomerDiscount } from "@/lib/api/customers/determine-customer-discount";
import { transformCustomer } from "@/lib/api/customers/transform-customer";
import { DubApiError } from "@/lib/api/errors";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import { generateRandomName } from "@/lib/names";
import { isStored, storage } from "@/lib/storage";
import z from "@/lib/zod";
import {
  createCustomerBodySchema,
  CustomerEnrichedSchema,
  CustomerSchema,
  getCustomersQuerySchemaExtended,
} from "@/lib/zod/schemas/customers";
import { DiscountSchemaWithDeprecatedFields } from "@/lib/zod/schemas/discount";
import { prisma } from "@dub/prisma";
import { nanoid, R2_URL } from "@dub/utils";
import {
  Customer,
  Discount,
  Link,
  Partner,
  Program,
  ProgramEnrollment,
} from "@prisma/client";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";

interface CustomerResponse extends Customer {
  link: Link & {
    programEnrollment: ProgramEnrollment & {
      program: Program & {
        defaultDiscount: Discount;
      };
      partner: Partner;
      discount: Discount | null;
    };
  };
}

// GET /api/customers – Get all customers
export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const {
      email,
      externalId,
      search,
      includeExpandedFields,
      page,
      pageSize,
      customerIds,
    } = getCustomersQuerySchemaExtended.parse(searchParams);

    const customers = (await prisma.customer.findMany({
      where: {
        ...(customerIds
          ? {
              id: { in: customerIds },
            }
          : {}),
        projectId: workspace.id,
        ...(email
          ? { email }
          : externalId
            ? { externalId }
            : search
              ? {
                  OR: [
                    { email: { startsWith: search } },
                    { externalId: { startsWith: search } },
                    { name: { startsWith: search } },
                  ],
                }
              : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...(includeExpandedFields
        ? {
            include: {
              link: {
                include: {
                  programEnrollment: {
                    include: {
                      program: {
                        include: {
                          defaultDiscount: true,
                        },
                      },
                      partner: {
                        select: {
                          id: true,
                          name: true,
                          email: true,
                          image: true,
                        },
                      },
                      discount: true,
                    },
                  },
                },
              },
            },
          }
        : {}),
    })) as CustomerResponse[];

    const discounts: Map<string, Discount | null> = new Map();

    if (includeExpandedFields) {
      const firstPurchases = await prisma.commission.findMany({
        where: {
          customerId: {
            in: customers.map((customer) => customer.id),
          },
          type: "sale",
        },
        select: {
          customerId: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        distinct: ["customerId"],
      });

      const firstPurchaseMap = new Map(
        firstPurchases.map((purchase) => [purchase.customerId, purchase]),
      );

      customers.forEach((customer) => {
        discounts.set(
          customer.id,
          determineCustomerDiscount({
            customerLink: customer.link,
            firstPurchase: firstPurchaseMap.get(customer.id),
          }),
        );
      });
    }

    const processedCustomers = customers.map((customer) => {
      return {
        ...customer,
        discount: discounts.get(customer.id),
      };
    });

    const responseSchema = includeExpandedFields
      ? CustomerEnrichedSchema.merge(
          z.object({
            discount: DiscountSchemaWithDeprecatedFields,
          }),
        )
      : CustomerSchema;

    return NextResponse.json(
      responseSchema.array().parse(processedCustomers.map(transformCustomer)),
    );
  },
  {
    requiredPlan: [
      "business",
      "business plus",
      "business extra",
      "business max",
      "advanced",
      "enterprise",
    ],
  },
);

// POST /api/customers – Create a customer
export const POST = withWorkspace(
  async ({ req, workspace }) => {
    const { email, name, avatar, externalId } = createCustomerBodySchema.parse(
      await parseRequestBody(req),
    );

    const customerId = createId({ prefix: "cus_" });
    const finalCustomerName = name || email || generateRandomName();
    const finalCustomerAvatar =
      avatar && !isStored(avatar)
        ? `${R2_URL}/customers/${customerId}/avatar_${nanoid(7)}`
        : avatar;

    try {
      const customer = await prisma.customer.create({
        data: {
          id: customerId,
          name: finalCustomerName,
          email,
          avatar: finalCustomerAvatar,
          externalId,
          projectId: workspace.id,
          projectConnectId: workspace.stripeConnectId,
        },
      });

      if (avatar && !isStored(avatar) && finalCustomerAvatar) {
        waitUntil(
          storage.upload(
            finalCustomerAvatar.replace(`${R2_URL}/`, ""),
            avatar,
            {
              width: 128,
              height: 128,
            },
          ),
        );
      }

      return NextResponse.json(
        CustomerSchema.parse(transformCustomer(customer)),
        {
          status: 201,
        },
      );
    } catch (error) {
      if (error.code === "P2002") {
        throw new DubApiError({
          code: "conflict",
          message: "A customer with this external ID already exists.",
        });
      }

      throw new DubApiError({
        code: "unprocessable_entity",
        message: error.message,
      });
    }
  },
  {
    requiredPlan: [
      "business",
      "business plus",
      "business extra",
      "business max",
      "advanced",
      "enterprise",
    ],
  },
);
