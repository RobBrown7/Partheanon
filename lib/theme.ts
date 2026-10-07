export const themes=["dark","light","system"] as const;
export type Theme=typeof themes[number];
export function validTheme(value:unknown):Theme{return themes.includes(value as Theme)?value as Theme:"dark";}
