/**
 * Active service adapter. Phase 5 swaps this single import for the
 * real API adapter (services/api) with zero component changes.
 */
import { mockServices } from "./mock";
import type { Services } from "./types";

export const services: Services = mockServices;
export type { ProductInput, Services } from "./types";
