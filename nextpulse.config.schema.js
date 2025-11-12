import { z } from "zod";
export const nextpulseConfigSchema = z.object({
    enabled: z.boolean().default(true),
    overlayPosition: z.enum(["bottomRight", "bottomLeft", "topRight", "topLeft"]).default("bottomRight"),
    openBrowserOnStart: z.boolean().default(false),
});
export const defaultConfig = {
    enabled: true,
    overlayPosition: "bottomRight",
    openBrowserOnStart: false,
};
