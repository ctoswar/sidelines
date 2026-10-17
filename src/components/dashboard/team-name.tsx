"use client";

import { useEffect, useState } from "react";
import { DEFAULT_TEAM, fetchTeam, getTeam, subscribeToTeam } from "@/lib/team";

/**
 * The team's display name for the server-rendered workspace pages (Home, My
 * schedule) and the sidebar. The name lives in Postgres, so the neutral
 * placeholder renders first and is swapped in after the fetch — that keeps the
 * server HTML and the first client render identical. The subscription then
 * keeps it correct when the team is renamed, because the sidebar survives
 * client-side navigation within the workspace.
 */
export function TeamName() {
  const [name, setName] = useState(DEFAULT_TEAM.name);

  useEffect(() => {
    let alive = true;
    const sync = () => { if (alive) setName(getTeam().name); };
    fetchTeam()
      .then(sync)
      .catch(() => { /* keep the placeholder when the fetch fails */ });
    const unsubscribe = subscribeToTeam(sync);
    return () => { alive = false; unsubscribe(); };
  }, []);

  return <>{name}</>;
}
