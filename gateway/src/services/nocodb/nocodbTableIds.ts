// Mutable singleton populated once at boot by initNocodbTables, then read by dataUrl.
// Lives in its own module so the populate-once-read-many contract is explicit.
export const nocodbTableIds: { map: Record<string, string> } = {
  map: {},
};
