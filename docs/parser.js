import { findReference } from './catalog.js?v=0.1.4';
const unknown = () => ({ value: null, origin: 'unknown', line: null });
const explicit = (value, line) => ({ value, origin: 'explicit', line });
const trim = (s) => s.replace(/\s+/g, ' ').trim();
const norm = (s) => trim(s).toLowerCase();
const pct = (s) => Number(s.replace(/,/g, ''));
const recognizedSections = new Set(['characters', 'character', 'core', 'core units', 'special', 'special units', 'rare', 'rare units', 'allies', 'mercenaries', 'lords', 'heroes']);
const gameFormats = ['Combined Arms', 'Battle March', 'Open War', 'Matched Play', 'Narrative Play'];
/** Comma split only at depth zero; honours `[]`, `()`, quotes, apostrophes. */
export function splitTopLevel(text, delimiter = ',') {
    const out = [];
    let depthRound = 0, depthSquare = 0, quote = '';
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            quote = quote ? '' : '"';
            continue;
        }
        if (quote)
            continue;
        if (c === '(')
            depthRound++;
        else if (c === ')')
            depthRound = Math.max(0, depthRound - 1);
        else if (c === '[')
            depthSquare++;
        else if (c === ']')
            depthSquare = Math.max(0, depthSquare - 1);
        else if (c === delimiter && depthRound === 0 && depthSquare === 0) {
            out.push(text.slice(start, i).trim());
            start = i + 1;
        }
    }
    out.push(text.slice(start).trim());
    return out.filter(Boolean);
}
function topLevelLastColon(s) {
    let p = 0, b = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '(')
            p++;
        else if (s[i] === ')')
            p = Math.max(0, p - 1);
        else if (s[i] === '[')
            b++;
        else if (s[i] === ']')
            b = Math.max(0, b - 1);
        else if (s[i] === ':' && p === 0 && b === 0)
            return i;
    }
    return -1;
}
function contentBetween(s, open, close, start) {
    let depth = 0;
    for (let i = start; i < s.length; i++) {
        if (s[i] === open)
            depth++;
        if (s[i] === close) {
            depth--;
            if (depth === 0)
                return { content: s.slice(start + 1, i), end: i };
        }
    }
    return null;
}
function parseTrailingCost(s) {
    const m = s.match(/\s*\[(\d[\d,]*)\s*pts?\]\s*$/i) || s.match(/\s*\((\d[\d,]*)\s*pts?\)\s*$/i);
    if (m)
        return { name: s.slice(0, m.index).trim(), points: pct(m[1]) };
    return { name: s.trim(), points: null };
}
function parseUnitHead(s, expectCost = true) {
    const stripped = s.replace(/^\*\*(.*?)\*\*$/, '$1').replace(/^\-\s+/, '').trim().replace(/:$/, '');
    const v = parseTrailingCost(stripped);
    if (expectCost && v.points === null)
        return null;
    let name = v.name, qty = null;
    const pm = name.match(/^(.*?)\s+\((\d+)\)$/);
    if (pm) {
        name = pm[1].trim();
        qty = Number(pm[2]);
    }
    else {
        const qm = name.match(/^(\d+)\s+(.+)$/);
        if (qm) {
            qty = Number(qm[1]);
            name = qm[2].trim();
        }
    }
    if (!name || /^\+|^\#/.test(name))
        return null;
    return { name, quantity: qty, points: v.points };
}
/** Old World Rankings on iOS can copy the complete roster as URI-escaped text.
 * Decode only convincing encoded multi-line rosters, not arbitrary URLs or pasted names.
 * The original input remains untouched in the saved import snapshot.
 */
export function normalizeImportText(text) {
    if (typeof text !== 'string') return { text, encoding: 'plain' };
    const candidate = text.trim();
    // Links, short URLs and ordinary text aren't decoded as army rosters.
    if (/^https?:\/\//i.test(candidate) || !/%0a|%0d/i.test(candidate) || !/%20|%3a/i.test(candidate))
        return { text, encoding: 'plain' };
    try {
        const decoded = decodeURIComponent(candidate);
        if (decoded !== candidate && /\n/.test(decoded) &&
            /(?:^|\n)\s*(?:player\s*:|characters\s*:|core\s*:|special\s*:|rare\s*:|built with battle builder|created with)/im.test(decoded))
            return { text: decoded, encoding: 'percent-encoded' };
    } catch {
        // Invalid %-escapes are preserved and handled by normal diagnostics.
    }
    return { text, encoding: 'plain' };
}
export function detectFormat(text, forced) {
    const s = normalizeImportText(text).text.replace(/\r\n/g, '\n');
    const l = s.split('\n').map(x => x.trim());
    const evidence = [];
    const footerOwb = /Created with\s+["“]Old World Builder/i.test(s);
    const footerIngude = /Created with\s+(?:\[)?Ingude/i.test(s);
    const footerNR = /Created with\s+newrecruit\.eu/i.test(s);
    const footerBattle = /Built with Battle Builder/i.test(s);
    let exporter = footerOwb ? 'old-world-builder' : footerIngude ? 'ingude' : footerNR ? 'new-recruit' : footerBattle ? 'battle-builder' : 'unknown';
    if (exporter !== 'unknown')
        evidence.push('exporter attribution');
    if (exporter === 'unknown') {
        if (l.some(v => /^-#\s*\(/.test(v)))
            exporter = 'old-world-builder';
        else if (l.some(v => /^\*\*.+\[\d+ pts\]\*\*$/.test(v)) && l.some(v => /^###\s/.test(v)))
            exporter = 'ingude';
        else if (l.some(v => /^#\s*\+\+/.test(v)) || l.some(v => /^•\s*\d+x\s/.test(v)))
            exporter = 'new-recruit';
        else if (l.some(v => /^Player:\s*/i.test(v)))
            exporter = 'battle-builder';
        else if (l.filter(v => /^\d[\d,]*\s+-\s+\S/.test(v)).length >= 2) {
            // Points-first text without a footer uses the same TOW grammar.
            // No particular exporter is proven, so retain medium confidence.
            exporter = 'new-recruit';
            evidence.push('points-first line structure (exporter not confirmed)');
        }
    }
    let layout = 'unknown';
    if (exporter === 'old-world-builder') {
        if (l.some(v => /^-#\s*\(/.test(v)))
            layout = l.some(v => /^##\s+.+\[\d+ pts\]/.test(v)) ? 'regular-discord' : 'compact-discord';
        else if (l.some(v => /^\+\+\s/.test(v)))
            layout = l.some(v => /^\(.*\)$/.test(v)) ? 'compact-text' : 'regular-text';
        else if (l.some(v => / - \d+$/.test(v)))
            layout = 'minimalist-text';
    }
    else if (exporter === 'ingude') {
        if (l.some(v => /^###\s/.test(v)))
            layout = 'markdown';
        else if (l.some(v => /^\+\+\s/.test(v)))
            layout = 'simple-text';
        else if (l.some(v => / - \d+$/.test(v)))
            layout = 'compact';
    }
    else if (exporter === 'new-recruit') {
        if (l.some(v => /^#\s*\+\+\s/.test(v)) || l.some(v => /^##\s+(Characters|Core|Rare|Special)/i.test(v)))
            layout = 'nr';
        else if (l.some(v => /^•\s*\d+x\s/.test(v)))
            layout = 'simple';
        else if (l.some(v => /^\d+\s+-\s+/.test(v)))
            layout = 'tow';
    }
    else if (exporter === 'battle-builder') {
        if (l.some(v => /^\s*•\s/.test(v)))
            layout = 'detailed';
        else if (l.some(v => /^\d+\s+-\s+/.test(v)))
            layout = 'tournament';
        else if (l.some(v => /^(Characters|Core|Special|Rare):$/i.test(v)))
            layout = 'compact';
    }
    const version = s.match(/Created with\s+newrecruit\.eu\s+v([\d.]+)/i)?.[1] ?? null;
    let confidence = layout === 'unknown' ? 'low' : evidence.length ? 'high' : 'medium';
    if (forced) {
        exporter = forced.exporter;
        layout = forced.layout;
        confidence = 'high';
        evidence.push('manual selection');
    }
    if (layout !== 'unknown')
        evidence.push('layout structural signature');
    return { exporter, layout, confidence, evidence, version };
}
function classify(name) {
    const n = norm(name);
    if (/^(general|battle standard bearer)$/.test(n))
        return 'role';
    if (/^wizard\b|^level\s+\d+\s+wizard|^wizard level \d+/.test(n))
        return 'wizard-level';
    if (/^(high magic|battle magic|dark magic|elementalism|illusion|daemonology)$/.test(n))
        return 'magic-lore';
    if (/^(on foot)$/.test(n))
        return 'mount-state';
    if (/(dragon|skycutter|chariot|steed|eagle|griffon|horse|roc)/.test(n))
        return 'mount-or-component';
    if (/^(full command|musician|standard bearer|champion|high helm|sea master|sentinel|high sister|master charioteer|master of arms|master of horse)$/.test(n))
        return 'command';
    if (/^(shield|shields|heavy armour|light armour|warbow|warbows|longbow|hand weapon|hand weapons|spear|thrusting spears|halberd|great weapon|great weapons)/.test(n))
        return 'equipment';
    return 'option';
}
function referenceFor(name, parentUnit, unit = false) {
    const r = findReference(name, unit ? 'unit' : 'selection', parentUnit);
    return r ? { id: r.id, url: r.url, type: r.type } : null;
}
let counter = 0;
function createSelection(input, line, parentUnit, kindOverride, owner = null) {
    const raw = input.trim();
    let working = raw, children = [];
    // Peel a top-level, trailing parenthesized, *priced nested item*: High Sister [42 pts] (Ruby Ring [35 pts]).
    let nestedBracket = null;
    let qualifier = null;
    const lastSq = working.lastIndexOf('[');
    if (lastSq >= 0 && working.endsWith(']')) {
        const v = contentBetween(working, '[', ']', lastSq);
        if (v && v.end === working.length - 1 && !/^\d[\d,]*\s*pts?$/i.test(v.content)) {
            nestedBracket = v.content.trim();
            working = working.slice(0, lastSq).trim();
        }
    }
    // `High Sister [42 pts] (Ruby Ring of Ruin [35 pts])`: nested parenthesized item after displayed own cost
    const pi = working.indexOf('(');
    if (pi > 0) {
        const par = contentBetween(working, '(', ')', pi);
        if (par && par.end === working.length - 1) {
            if (/\[\d[\d,]*\s*pts?\]$/.test(par.content) && /\[\d[\d,]*\s*pts?\]$/.test(working.slice(0, pi).trim())) {
                children.push(createSelection(par.content, line, parentUnit, undefined, working.slice(0, pi).trim()));
                working = working.slice(0, pi).trim();
            }
        }
    }
    const cost = parseTrailingCost(working);
    working = cost.name;
    if (nestedBracket)
        children.push(createSelection(nestedBracket, line, parentUnit, undefined, working));
    // Parentheses are not a generic nested item: they might indicate champion role, weapon equivalence or mount ownership.
    const qualifierMatch = working.match(/^(.*?)\s*\(([^()]*)\)$/);
    if (qualifierMatch) {
        qualifier = qualifierMatch[2].trim();
        working = qualifierMatch[1].trim();
    }
    const ref = referenceFor(working, parentUnit);
    const status = ref ? 'matched' : 'unmatched';
    const selection = { id: `s${++counter}`, name: working, raw, line, kind: kindOverride || classify(working), reportedPoints: cost.points, priceInterpretation: cost.points === null ? 'unknown' : 'displayed', children, reference: ref, matchStatus: status, qualifier, owner };
    return selection;
}
function splitSelections(content, line, unit, category) {
    const selections = splitTopLevel(content).map(part => createSelection(part, line, unit.name, category));
    unit.selections.push(...selections);
}
function parseSourceMeta(line, lineNum, result, allowArmyHeading) {
    const a = result.army;
    const nameHeading = line.match(/^={0,3}\s*(.+?)\s*\[(\d[\d,]*)\s*pts\]\s*$/i);
    // OWB/Ingude army headers are only parsed by caller when outside a section.
    if (allowArmyHeading && nameHeading && !/^\+/.test(line) && !/^\*\*/.test(line)) {
        a.name = explicit(nameHeading[1].trim(), lineNum);
        a.reportedPoints = explicit(pct(nameHeading[2]), lineNum);
        return true;
    }
    if (/^Warhammer:\s*The Old World,/i.test(line)) {
        const vals = line.split(',').map(x => x.trim());
        if (vals.length >= 2)
            a.faction = explicit(vals[1], lineNum);
        const rest = vals.slice(2);
        if (rest.length) {
            const last = rest[rest.length - 1];
            if (gameFormats.some(x => norm(x) === norm(last))) {
                a.gameFormat = explicit(last, lineNum);
                rest.pop();
            }
        }
        if (rest.length)
            a.composition = explicit(rest.join(', '), lineNum);
        return true;
    }
    if (/^Player:\s*/i.test(line)) {
        a.player = explicit(line.replace(/^Player:\s*/i, '').trim(), lineNum);
        return true;
    }
    if (/^Total:\s*\d/.test(line)) {
        const t = line.match(/^Total:\s*(\d[\d,]*)(?:\s*\/\s*(\d[\d,]*))?\s*pts?/i);
        if (t) {
            a.reportedPoints = explicit(pct(t[1]), lineNum);
            if (t[2])
                a.limitPoints = explicit(pct(t[2]), lineNum);
            return true;
        }
    }
    return false;
}
function sourceMetaHeader(line, lineNum, result) {
    const a = result.army;
    // New Recruit "High Elf Realms - The Twin-Star Host of Avelorn - [1999 pts]"
    if (result.format.exporter === 'new-recruit') {
        const nr = line.match(/^(.+?)\s+-\s+(.+?)\s+-\s+\[(\d[\d,]*)\s*pts\]$/i);
        if (nr) {
            a.faction = explicit(nr[1], lineNum);
            a.name = explicit(nr[2], lineNum);
            a.reportedPoints = explicit(pct(nr[3]), lineNum);
            return true;
        }
    }
    // Battle Builder "Marks Orges - High Elf Realms - Sea Guard Garrison (2599/2600)".
    if (result.format.exporter === 'battle-builder') {
        const bb = line.match(/^(.+?)\s+-\s+(.+?)\s+-\s+(.+?)\s+\((\d[\d,]*)(?:\s*\/\s*(\d[\d,]*))?\s*(?:Points)?\)$/i);
        if (bb) {
            a.name = explicit(bb[1], lineNum);
            a.faction = explicit(bb[2], lineNum);
            a.composition = explicit(bb[3], lineNum);
            a.reportedPoints = explicit(pct(bb[4]), lineNum);
            if (bb[5])
                a.limitPoints = explicit(pct(bb[5]), lineNum);
            return true;
        }
    }
    if (result.format.exporter === 'ingude' && line.includes('·')) {
        const bits = line.split('·').map(x => x.trim());
        if (bits.length === 2) {
            a.faction = explicit(bits[0], lineNum);
            const sub = bits[1].startsWith(bits[0] + ' - ') ? bits[1].slice(bits[0].length + 3) : bits[1];
            a.composition = explicit(sub, lineNum);
            return true;
        }
    }
    return false;
}
function newSection(result, name, pts, line) {
    const sec = { id: `sec${result.sections.length + 1}`, name: name.trim(), line, reportedPoints: pts === null ? unknown() : explicit(pts, line), unitIds: [] };
    result.sections.push(sec);
    return sec;
}
function newUnit(result, h, raw, line, section) {
    const r = referenceFor(h.name, '', true);
    const unit = { id: `u${result.units.length + 1}`, name: h.name, rawHeading: raw, line, sectionId: section?.id ?? null, quantity: h.quantity === null ? unknown() : explicit(h.quantity, line), reportedPoints: h.points === null ? unknown() : explicit(h.points, line), reference: r, matchStatus: r ? 'matched' : 'unmatched', selections: [], modelGroups: [] };
    result.units.push(unit);
    if (section)
        section.unitIds.push(unit.id);
    return unit;
}
function addUnitOrDiagnostic(result, raw, line, section, requireCost = true) {
    const h = parseUnitHead(raw, requireCost);
    if (!h) {
        result.diagnostics.push({ severity: 'error', code: 'UNPARSED_UNIT', line, message: `Could not interpret unit heading: ${raw}` });
        return null;
    }
    return newUnit(result, h, raw, line, section);
}
function parseBulletGroup(result, unit, raw, line) {
    const m = raw.match(/^•\s*(\d+)\s*[x×]\s+(.+)$/i);
    if (!m)
        return false;
    const n = Number(m[1]);
    const text = m[2].trim();
    // New Recruit TOW uses "• 11x Gor, Additional Hand Weapon", while
    // other exports may use "• 11x Gor: Additional Hand Weapon".
    const segments = splitTopLevel(text);
    const first = segments.shift() || '';
    const colon = topLevelLastColon(first);
    const core = (colon < 0 ? first : first.slice(0, colon)).trim();
    const parts = parseTrailingCost(core);
    const options = (colon < 0 ? [] : [first.slice(colon + 1).trim()]).concat(segments).filter(Boolean);
    const group = { id: `g${unit.id}-${unit.modelGroups.length + 1}`, name: parts.name, quantity: n, line, pointsPerModel: parts.points, selections: [], raw };
    group.selections = options.map(s => createSelection(s, line, unit.name, undefined, group.id));
    unit.modelGroups.push(group);
    return true;
}
function parseDetailedBullet(result, unit, s, line) {
    const raw = s.replace(/^\s*•\s*/, '').trim();
    const pos = topLevelLastColon(raw);
    if (pos >= 0) {
        const category = raw.slice(0, pos).trim();
        splitSelections(raw.slice(pos + 1), line, unit, category);
    }
    else
        unit.selections.push(createSelection(raw, line, unit.name));
}
function parseLineUnitOptions(s, result, ln, sec, scheme) {
    let h = null;
    let options = '';
    if (scheme === 'points-first') {
        const pm = s.match(/^(\d[\d,]*)\s+-\s+(.+)$/);
        if (!pm)
            return null;
        const all = splitTopLevel(pm[2]);
        h = parseUnitHead(all.shift() || '', false);
        options = all.join(', ');
        if (h)
            h.points = pct(pm[1]);
    }
    else if (scheme === 'points-last') {
        const pm = s.match(/^(.+?)\s+-\s+(\d[\d,]*)\s*$/);
        if (!pm)
            return null;
        const all = splitTopLevel(pm[1]);
        h = parseUnitHead(all.shift() || '', false);
        options = all.join(', ');
        if (h)
            h.points = pct(pm[2]);
    }
    else {
        // Battle Builder: "Name (32): option, option (466 pts)" or "Name: option (170 pts)"
        const p = s.indexOf(':');
        if (p < 0)
            return null;
        const rest = parseTrailingCost(s.slice(p + 1).trim());
        if (rest.points === null)
            return null;
        h = parseUnitHead(s.slice(0, p).trim(), false);
        options = rest.name;
        if (h)
            h.points = rest.points;
    }
    if (!h)
        return null;
    const u = newUnit(result, h, s, ln, sec);
    if (options)
        splitSelections(options, ln, u);
    return u;
}
function finish(result) {
    const reportedUnits = result.units.filter(u => u.reportedPoints.value !== null);
    const allUnitsHavePoints = reportedUnits.length === result.units.length && result.units.length > 0;
    if (allUnitsHavePoints)
        result.army.derivedPoints = { value: reportedUnits.reduce((sum, u) => sum + (u.reportedPoints.value || 0), 0), origin: 'derived', line: null };
    if (result.army.reportedPoints.value !== null && result.army.derivedPoints.value !== null && result.army.reportedPoints.value !== result.army.derivedPoints.value) {
        result.diagnostics.push({ severity: 'warning', code: 'ARMY_SUM_MISMATCH', line: result.army.reportedPoints.line, message: `Imported army total ${result.army.reportedPoints.value} differs from sum of displayed unit points ${result.army.derivedPoints.value}.` });
    }
    for (const s of result.sections) {
        const units = result.units.filter(u => u.sectionId === s.id);
        if (s.reportedPoints.value !== null && units.length > 0 && units.every(u => u.reportedPoints.value !== null)) {
            const sum = units.reduce((a, u) => a + (u.reportedPoints.value || 0), 0);
            if (sum !== s.reportedPoints.value)
                result.diagnostics.push({ severity: 'warning', code: 'SECTION_SUM_MISMATCH', line: s.line, message: `${s.name}: displayed ${s.reportedPoints.value}, sum of units ${sum}.` });
        }
    }
    for (const u of result.units) {
        if (u.modelGroups.length > 0) {
            const groupSum = u.modelGroups.reduce((a, b) => a + b.quantity, 0);
            if (u.quantity.value === null)
                u.quantity = { value: groupSum, origin: 'derived', line: null };
            else if (u.quantity.value !== groupSum)
                result.diagnostics.push({ severity: 'warning', code: 'MODEL_GROUP_SUM_MISMATCH', line: u.line, message: `${u.name}: heading quantity ${u.quantity.value}, grouped models ${groupSum}` });
        }
    }
    const flatten = (s) => s.flatMap(x => [x, ...flatten(x.children)]);
    const selectionList = result.units.flatMap(u => [...flatten(u.selections), ...u.modelGroups.flatMap(g => flatten(g.selections))]);
    result.stats = { unitCount: result.units.length, selectionCount: selectionList.length, modelGroupCount: result.units.reduce((a, u) => a + u.modelGroups.length, 0), matchedUnits: result.units.filter(u => u.matchStatus === 'matched').length, unmatchedUnits: result.units.filter(u => u.matchStatus === 'unmatched').length, matchedSelections: selectionList.filter(s => s.matchStatus === 'matched').length, unmatchedSelections: selectionList.filter(s => s.matchStatus !== 'matched').length, unparsedLines: result.diagnostics.filter(d => d.code.startsWith('UNPARSED') || d.code.startsWith('ORPHAN')).length };
    if (result.units.length === 0)
        result.diagnostics.push({ severity: 'warning', code: 'NO_UNITS', line: null, message: 'No unit headings were identified. Check the selected format or paste a complete export.' });
    if (result.format.exporter === 'unknown')
        result.diagnostics.unshift({ severity: 'warning', code: 'UNDETECTED_FORMAT', line: null, message: 'Format could not be determined. Select the exporter and layout manually.' });
    return result;
}

/** Preserve first source line number while joining soft-wrapped TOW entries.
 * An unindented points-first heading or a model-group bullet starts a new
 * logical record; following non-heading lines belong to that record only
 * until a blank line, footer, metadata line, or next record.
 */
function joinWrappedTowLines(rawLines) {
    const out = [];
    let active = null;
    for (let i = 0; i < rawLines.length; i++) {
        const raw = rawLines[i], line = i + 1, trimmed = raw.trim();
        const isUnit = /^\d[\d,]*\s+-\s+\S/.test(trimmed);
        const isGroup = /^•\s*\d+\s*[x×]\s+/i.test(trimmed);
        if (isUnit || isGroup) {
            active = { text: raw, line };
            out.push(active);
            continue;
        }
        if (!trimmed) {
            out.push({ text: raw, line });
            active = null;
            continue;
        }
        if (active && !/^(?:Created with|Built with|Player:|Total:|Warhammer:|\+\+|#)/i.test(trimmed)
            && !/^•/.test(trimmed)) {
            active.text += ' ' + trimmed;
            continue;
        }
        out.push({ text: raw, line });
        active = null;
    }
    return out;
}
/** Pure deterministic parser; does not perform legality checks, points verification or network calls. */
export function parseArmy(text, override) {
    counter = 0;
    const originalText = text;
    const normalized = normalizeImportText(text);
    const originalLines = normalized.text.replace(/\r\n?/g, '\n').split('\n');
    const format = detectFormat(normalized.text, override);
    const lines = format.exporter === 'new-recruit' && format.layout === 'tow'
        ? joinWrappedTowLines(originalLines)
        : originalLines.map((text, i) => ({ text, line: i + 1 }));
    const result = { schemaVersion: 1, format, originalText, inputEncoding: normalized.encoding,
        army: { name: unknown(), faction: unknown(), composition: unknown(), gameFormat: unknown(), player: unknown(), reportedPoints: unknown(), limitPoints: unknown(), derivedPoints: unknown() },
        sections: [], units: [], diagnostics: [], stats: { unitCount: 0, selectionCount: 0, modelGroupCount: 0, matchedUnits: 0, matchedSelections: 0, unmatchedSelections: 0, unmatchedUnits: 0, unparsedLines: 0 } };
    if (normalized.encoding === 'percent-encoded')
        result.diagnostics.push({ severity: 'info', code: 'URL_ENCODED_ROSTER_DECODED', line: null, message: 'Decoded URL-encoded list text for importing. The original clipboard text is preserved.' });
    let section = null, unit = null;
    let state = 'header';
    const kind = format.exporter;
    const isOwb = kind === 'old-world-builder', isIngude = kind === 'ingude', isNR = kind === 'new-recruit', isBattle = kind === 'battle-builder';
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].text, s = raw.trim(), ln = lines[i].line;
        if (!s || /^={3,}$/.test(s) || s === '---')
            continue;
        if (/(?:Created with|Built with)/i.test(s) && (/Old World Builder|newrecruit\.eu|Ingude|Battle Builder/i.test(s)))
            continue;
        if (/^\[?https?:\/\/(old-world-builder\.com|ingude\.com|oldworldrankings\.com)/i.test(s))
            continue;
        if (/^\*Created with/i.test(s))
            continue;
        // Markdown attribution is not meaningful army data.
        if (/^\[https?:\/\//.test(s))
            continue;
        // First try section headings. Can arrive in any order.
        let sm = s.match(/^\+\+\s+(.+?)\s+\[(\d[\d,]*)\s*pts\]\s+\+\+$/i) ||
            s.match(/^#{2,3}\s+(.+?)\s+\[(\d[\d,]*)\s*pts\]\s*$/i);
        if (sm && recognizedSections.has(norm(sm[1]))) {
            section = newSection(result, sm[1], pct(sm[2]), ln);
            unit = null;
            state = 'unit';
            continue;
        }
        if (isNR && /^#\s*\+\+\s+(.+?)\s+\+\+\s+\[\d[\d,]*\s*pts\]/.test(s)) {
            const fmt = s.match(/^#\s*\+\+\s+(.+?)\s+\+\+/);
            if (fmt)
                result.army.gameFormat = explicit(fmt[1], ln);
            continue;
        }
        if (isBattle && /^(CHARACTERS|CORE|SPECIAL|RARE|ALLIES|MERCENARIES):$/i.test(s)) {
            section = newSection(result, s.replace(':', ''), null, ln);
            unit = null;
            state = 'unit';
            continue;
        }
        if ((isIngude || isOwb) && /^###?\s+/.test(s)) {
            // OWB Markdown army header or Ingude Markdown army header
            const armyHeading = s.match(/^##\s+(.+?)\s+\[(\d[\d,]*)\s*pts\]$/i);
            if (armyHeading) {
                result.army.name = explicit(armyHeading[1], ln);
                result.army.reportedPoints = explicit(pct(armyHeading[2]), ln);
                continue;
            }
        }
        if (sourceMetaHeader(s, ln, result))
            continue;
        if (parseSourceMeta(s, ln, result, (isOwb || isIngude) && state === 'header' && section === null && unit === null && result.army.name.value === null)) {
            // Ignore heading resets when an actual unit heading is already open? Only supported on metadata lines.
            continue;
        }
        // Unlabelled points-first exports sometimes begin with a player or
        // team heading. Preserve it verbatim; don't infer a faction or country.
        if (isNR && format.layout === 'tow' && state === 'header' && section === null &&
            result.units.length === 0 && result.army.player.value === null &&
            !/^\d[\d,]*\s+-\s+\S/.test(s) && !/^•/.test(s)) {
            result.army.player = explicit(s, ln);
            continue;
        }
        if (isIngude && /^\*[^*]+\*$/.test(s) && !/^\*Created/.test(s)) {
            result.army.faction = explicit(s.slice(1, -1), ln);
            continue;
        }
        if (isIngude && state === 'header' && /^[A-Za-z][\w &'-]+$/.test(s) && !/^Hand weapon/i.test(s)) {
            result.army.faction = explicit(s, ln);
            continue;
        }
        // Lines in compact/flexible formats without section headings.
        if ((isOwb && (format.layout === 'minimalist-text' || format.layout === 'minimalist-discord')) || (isIngude && format.layout === 'compact')) {
            const u = parseLineUnitOptions(s, result, ln, section, 'points-last');
            if (u) {
                unit = u;
                state = 'unit';
                continue;
            }
        }
        if ((isNR && format.layout === 'tow') || (isBattle && format.layout === 'tournament')) {
            const u = parseLineUnitOptions(s, result, ln, section, 'points-first');
            if (u) {
                unit = u;
                state = 'unit';
                continue;
            }
        }
        if (isBattle && format.layout === 'compact' && s.includes(':')) {
            const u = parseLineUnitOptions(s, result, ln, section, 'bb-compact');
            if (u) {
                unit = u;
                state = 'unit';
                continue;
            }
        }
        // Discord OWB: `-# (...)` is options for immediately preceding unit
        if (isOwb && /^-#\s*\(/.test(s)) {
            if (unit) {
                const body = s.replace(/^-#\s*/, '').trim();
                if (body.startsWith('(') && body.endsWith(')'))
                    splitSelections(body.slice(1, -1), ln, unit);
                else
                    splitSelections(body, ln, unit);
            }
            else
                result.diagnostics.push({ severity: 'error', code: 'ORPHAN_SELECTION', line: ln, message: 'Discord options appeared before a unit.' });
            continue;
        }
        // OWB compact regular parentheses line belongs to immediately preceding heading.
        if (isOwb && format.layout === 'compact-text' && s.startsWith('(') && s.endsWith(')')) {
            if (unit)
                splitSelections(s.slice(1, -1), ln, unit);
            else
                result.diagnostics.push({ severity: 'error', code: 'ORPHAN_SELECTION', line: ln, message: 'Option block appeared before a unit.' });
            continue;
        }
        // New Recruit `• n x Model [pts]: ...` and Ingude/Battle bullet fields
        if (/^•\s*/.test(s)) {
            if (!unit) {
                result.diagnostics.push({ severity: 'error', code: 'ORPHAN_SELECTION', line: ln, message: `Model/selection line without a unit: ${s}` });
                continue;
            }
            if (isNR && parseBulletGroup(result, unit, s, ln))
                continue;
            parseDetailedBullet(result, unit, s, ln);
            continue;
        }
        // New Recruit detailed characters use `Archmage [500 pts]: options...`.
        // Parse the LEFT side before considering a trailing option's [points] as unit cost.
        if (isNR && format.layout === 'nr' && s.includes(':')) {
            const c = topLevelLastColon(s), before = s.slice(0, c), after = s.slice(c + 1);
            const h = parseUnitHead(before, true);
            if (h) {
                unit = newUnit(result, h, before, ln, section);
                if (after.trim())
                    splitSelections(after, ln, unit);
                state = 'unit';
                continue;
            }
        }
        // Markdown unit headings `**Unit [pts]**` or OWB `- Unit [pts]`, standard unmarked heading.
        let candidate = s;
        if (isOwb && /^\-\s+(?!#)/.test(s) && format.layout.includes('discord'))
            candidate = s.replace(/^\-\s+/, '');
        if (isIngude && /^\*\*.*\*\*$/.test(s))
            candidate = s.slice(2, -2);
        const unitCandidate = (isOwb && (format.layout === 'regular-text' || format.layout === 'compact-text' || format.layout.endsWith('discord'))) ||
            (isIngude && (format.layout === 'simple-text' || format.layout === 'markdown')) ||
            (isNR && (format.layout === 'nr' || format.layout === 'simple')) ||
            (isBattle && format.layout === 'detailed');
        if (unitCandidate) {
            const h = parseUnitHead(candidate, true);
            if (h && (!s.startsWith('-') || format.layout.endsWith('discord'))) {
                unit = newUnit(result, h, candidate, ln, section);
                state = 'unit';
                continue;
            }
        }
        // OWB/Ingude `- item`: equipment selection for existing unit.
        if ((isOwb || isIngude) && /^-\s+/.test(s)) {
            if (unit) {
                unit.selections.push(createSelection(s.slice(2), ln, unit.name));
            }
            else
                result.diagnostics.push({ severity: 'error', code: 'ORPHAN_SELECTION', line: ln, message: `Selection before unit: ${s}` });
            continue;
        }
        // NR character lines with inline options: `Archmage [500 pts]: Pure of Heart, ...`
        if (isNR && s.includes(':')) {
            const c = topLevelLastColon(s);
            const before = s.slice(0, c), after = s.slice(c + 1);
            const h = parseUnitHead(before, true);
            if (h) {
                unit = newUnit(result, h, before, ln, section);
                if (after.trim())
                    splitSelections(after, ln, unit);
                state = 'unit';
                continue;
            }
        }
        // Optional friendly fallback: if source cannot be detected, don't silently parse with a random grammar.
        // Treat a suspicious non-format line as a warning rather than discarding it.
        result.diagnostics.push({ severity: 'warning', code: 'UNPARSED_LINE', line: ln, message: `Unparsed line retained: ${s}` });
    }
    return finish(result);
}
