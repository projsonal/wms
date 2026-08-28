
export const EQUIPMENT_ABBREVIATIONS: Record<string, string> = {
  ont: 'Optical Network Terminal',
  olt: 'Optical Line Terminal',
  odc: 'Optical Distribution Cabinet',
  odp: 'Optical Distribution Point',
  ups: 'Uninterruptible Power Supply',
  poe: 'Power over Ethernet',
  ap: 'Access Point',
  router: 'Router',
  switch: 'Switch Jaringan',
  modem: 'Modem',
  hub: 'Hub Jaringan',
  splitter: 'Splitter Optik',
  patchcord: 'Kabel Patch (Patch Cord)',
  pigtail: 'Kabel Pigtail',
};

export function resolveEquipmentAbbreviation(text?: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  const match = trimmed.match(/^([A-Za-z]+)/);
  if (!match) return null;
  const abbr = match[1].toLowerCase();
  const full = EQUIPMENT_ABBREVIATIONS[abbr];
  return full ? `${match[1].toUpperCase()} (${full})` : null;
}
