import { Redis } from "@upstash/redis";

// Reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from env.
// REST-based Redis: works from short-lived serverless functions (no persistent socket).
export const redis = Redis.fromEnv();
