import { useMemo, useState } from "react";

import type { AdminGuildDirectoryEntry } from "../../runtime/admin-types";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface GuildPickerProps {
  id: string;
  value: string;
  guildDirectory: AdminGuildDirectoryEntry[] | null;
  loadError: string | null;
  onChange: (nextGuildId: string) => void;
}

export function GuildPicker({
  id,
  value,
  guildDirectory,
  loadError,
  onChange,
}: GuildPickerProps) {
  const [query, setQuery] = useState("");

  const filteredGuilds = useMemo(() => {
    if (!guildDirectory) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return guildDirectory;
    }

    return guildDirectory.filter((guild) =>
      guild.label.toLowerCase().includes(normalizedQuery)
    );
  }, [guildDirectory, query]);

  if (loadError) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>Guild ID</Label>
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter a guild ID"
        />
        <p className="text-xs text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${id}-query`}>Server</Label>
        <Input
          id={`${id}-query`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter servers"
          disabled={!guildDirectory}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id}>Server</Label>
        <select
          id={id}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={!guildDirectory}
        >
          <option value="">
            {guildDirectory ? "— select a server —" : "Loading servers…"}
          </option>
          {filteredGuilds.map((guild) => (
            <option key={guild.guildId} value={guild.guildId}>
              {guild.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
