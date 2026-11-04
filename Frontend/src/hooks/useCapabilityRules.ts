"use client";

import { useEffect, useState } from "react";
import { getCapabilities } from "@/lib/api/agentHound";
import { logger } from "@/lib/logger";

export type RulesByVerb = ReadonlyMap<string, readonly string[]>;

let request: Promise<RulesByVerb> | null = null;

function loadRules(): Promise<RulesByVerb> {
  request ??= getCapabilities().then(
    ({ capabilities }) => new Map(capabilities.map((c) => [c.verb, c.evaluated_by])),
    (err) => {
      request = null;
      throw err;
    },
  );
  return request;
}

export function resetCapabilityRules() {
  request = null;
}

export function useCapabilityRules(): RulesByVerb | null {
  const [rules, setRules] = useState<RulesByVerb | null>(null);
  useEffect(() => {
    let active = true;
    loadRules().then(
      (loaded) => active && setRules(loaded),
      (err) => logger.error("Capability catalog failed", err),
    );
    return () => {
      active = false;
    };
  }, []);
  return rules;
}
