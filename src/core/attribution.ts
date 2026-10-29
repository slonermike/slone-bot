/** Parse ATTRIBUTION.md into sections the launcher can render. Tiny on purpose: headings, paragraphs, pipe tables. */
export interface CreditsSection {
  heading: string;
  paragraphs: string[];
  table: { head: string[]; rows: string[][] } | null;
}

export function parseAttribution(md: string): CreditsSection[] {
  const sections: CreditsSection[] = [];
  let cur: CreditsSection = { heading: '', paragraphs: [], table: null };
  const flush = () => {
    if (cur.heading || cur.paragraphs.length || cur.table) sections.push(cur);
  };
  const lines = md.split(/\r?\n/);
  let para: string[] = [];
  const endPara = () => {
    if (para.length) cur.paragraphs.push(para.join(' ').trim());
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      endPara();
      flush();
      cur = { heading: h[1]!.trim(), paragraphs: [], table: null };
      continue;
    }
    if (line.trim().startsWith('|')) {
      endPara();
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const next = lines[i + 1] ?? '';
      if (!cur.table && /^\s*\|?[\s:|-]+\|?\s*$/.test(next) && next.includes('-')) {
        cur.table = { head: cells(line), rows: [] };
        i++;
      } else if (cur.table) {
        cur.table.rows.push(cells(line));
      }
      continue;
    }
    if (line.trim() === '') endPara();
    else para.push(line.replace(/^[-*]\s+/, '').trim());
  }
  endPara();
  flush();
  return sections;
}
