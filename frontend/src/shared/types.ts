/** Common domain types shared across features. Extended as pages are ported. */

/** Equipment dropdown selection (chiller / cooling_tower / pump / …). */
export interface Equipment {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

/** One model assignment from /api/v1/models `tasks` map. */
export interface ModelTask {
  model: string;
  label?: string;
  purpose?: string;
  maker?: string;
  flag?: string;
  params?: string;
  kind?: string;
}

/** Roster payload from /api/v1/models. */
export interface ModelRoster {
  tasks?: Record<string, ModelTask>;
  [key: string]: unknown;
}
