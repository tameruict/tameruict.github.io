import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const writeups = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/writeups",
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(180),
    platform: z.string(),
    category: z.string(),
    difficulty: z.enum(["Easy", "Medium", "Hard", "Insane"]),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    language: z.enum(["vi", "en"]),
    translationKey: z.string(),
    draft: z.boolean().default(false),
    featured: z.boolean().optional(),
    cover: z.string().optional(),
  }),
});

export const collections = { writeups };
