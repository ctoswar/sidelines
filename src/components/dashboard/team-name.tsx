"use client";

import { useEffect, useState } from "react";
import { getTeam, subscribeToTeam } from "@/lib/demo-store";
import { MY_TEAM } from "@/lib/mock-data";

/**
 * The team's display name for the server-rendered workspace pages (Home, My
 * schedule) and the sidebar. The stored name only lives in localStorage, so
 * the seeded default renders first and is swapped in after mount — that keeps
 * the server HTML and the first client render identical. The subscription then
 * keeps it correct when the team is renamed, because the sidebar survives
 * client-side navigation within the workspace.
 */
export function TeamName() {
  const [name, setName] = useState(MY_TEAM);

  useEffect(() => {
    const sync = () => setName(getTeam().name);
    sync();
    return subscribeToTeam(sync);
  }, []);

  return <>{name}</>;
}
