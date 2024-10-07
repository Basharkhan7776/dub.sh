import { LinkProps } from "@/lib/types";
import { formatRedisLink, redis } from "@/lib/upstash";

const CACHE_EXPIRATION = 60 * 60 * 24 * 7;

class LinkCache {
  async mset(links: (LinkProps & { webhookIds?: string[] })[]) {
    if (links.length === 0) {
      return;
    }

    const pipeline = redis.pipeline();

    const redisLinks = await Promise.all(
      links.map(async (link) => ({
        ...(await formatRedisLink(link)),
        key: link.key.toLowerCase(),
        domain: link.domain.toLowerCase(),
      })),
    );

    redisLinks.map(({ key, domain, ...redisLink }) => {
      pipeline.set(`${domain}:${key}`, JSON.stringify(redisLink), {
        ex: CACHE_EXPIRATION,
        nx: true,
      });
    });

    await pipeline.exec();
  }

  // TODO:
  // Fix the type
  async set(link: any) {
    const redisLink = await formatRedisLink(link);
    const cacheKey = `${link.domain}:${link.key}`.toLowerCase();

    const response = await redis.set(cacheKey, JSON.stringify(redisLink), {
      ex: CACHE_EXPIRATION,
      nx: true,
    });

    if (!response) {
      console.error("Failed to set link in cache", cacheKey);
    }

    return response;
  }
}

export const linkCache = new LinkCache();
