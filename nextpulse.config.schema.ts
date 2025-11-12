import { z } from "zod";

export const nextpulseConfigSchema = z.object({
  enabled: z.boolean().default(true),
  overlayPosition: z.enum(["bottomRight", "bottomLeft", "topRight", "topLeft"]).default("bottomRight"),
  openBrowserOnStart: z.boolean().default(false),
});

export type NextPulseConfig = z.infer<typeof nextpulseConfigSchema>;

export const defaultConfig: NextPulseConfig = {
  enabled: true,
  overlayPosition: "bottomRight",
  openBrowserOnStart: false,
};

