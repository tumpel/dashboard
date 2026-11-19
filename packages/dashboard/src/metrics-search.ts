import { MetricBucketSchema } from "@tumpel/schemas";
import { z } from "zod";
import { RANGES, STATS } from "./metrics";

export const SPLITS = ["harness", "startKind", "hostId", "model", "harnessVersion", "none"] as const;

export const MetricsSearchSchema = z.object({
  metric: z.array(z.string()).catch([]),
  range: z.array(z.enum(RANGES)).catch([]),
  from: z.array(z.string()).max(1).catch([]),
  to: z.array(z.string()).max(1).catch([]),
  back: z.array(z.string()).max(2).catch([]),
  bucket: z.array(MetricBucketSchema).catch([]),
  stat: z.array(z.enum(STATS)).catch([]),
  filter: z.array(z.string()).catch([]),
  groupBy: z.array(z.string()).max(2).catch([]),
  split: z.array(z.enum(SPLITS)).catch([]),
  at: z.array(z.string()).catch([]),
  group: z.array(z.string()).catch([]),
});

export type MetricsSearch = z.infer<typeof MetricsSearchSchema>;

export const EMPTY_SEARCH: MetricsSearch = MetricsSearchSchema.parse({});
