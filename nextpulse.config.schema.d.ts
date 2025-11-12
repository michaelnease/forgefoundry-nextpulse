import { z } from "zod";
export declare const nextpulseConfigSchema: any;
export type NextPulseConfig = z.infer<typeof nextpulseConfigSchema>;
export declare const defaultConfig: NextPulseConfig;
