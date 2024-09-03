import { DYNADOT_API_KEY, DYNADOT_BASE_URL } from "./constants";

export const searchDomains = async ({ domain }: { domain: string }) => {
  const searchParams = new URLSearchParams({
    key: DYNADOT_API_KEY,
    domain0: domain,
    domain1: domain,
    command: "search",
    show_price: "1",
    currency: "USD",
  });

  const response = await fetch(
    `${DYNADOT_BASE_URL}?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to search domains: ${response.statusText}`);
  }

  return await response.json();
};
