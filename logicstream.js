/**
 * LogicStream.js v1.0 - Standalone Swimlane & Flowchart Renderer
 * Usage:
 *   <script src="logicstream.js"></script>
 *   <pre class="logicstream">
 *     Direction: Vertical
 *     Lanes: ユーザー, サーバー
 *     ...
 *   </pre>
 */
(function (global) {
    'use strict';

    const SVG_NS = 'http://www.w3.org/2000/svg';

    const SIZE_CONFIGS = {
        small:  { nodeW: 110, nodeH: 42, font: 10, gap: 65,  header: 34, colW: 150, marginL: 90,  phaseW: 40 },
        medium: { nodeW: 160, nodeH: 60, font: 12, gap: 105, header: 44, colW: 210, marginL: 110, phaseW: 50 },
        large:  { nodeW: 210, nodeH: 80, font: 15, gap: 145, header: 54, colW: 270, marginL: 130, phaseW: 60 }
    };

    const PALETTES = {
        blue:   { hexBg: '#eff6ff', hexBorder: '#3b82f6', hexText: '#1e3a8a' },
        green:  { hexBg: '#f0fdf4', hexBorder: '#22c55e', hexText: '#14532d' },
        red:    { hexBg: '#fef2f2', hexBorder: '#ef4444', hexText: '#7f1d1d' },
        yellow: { hexBg: '#fefce8', hexBorder: '#eab308', hexText: '#713f12' },
        purple: { hexBg: '#faf5ff', hexBorder: '#a855f7', hexText: '#581c87' },
        orange: { hexBg: '#fff7ed', hexBorder: '#f97316', hexText: '#7c2d12' }
    };

    function getColorInfo(c) {
        const def = { hexBg: '#ffffff', hexBorder: '#1e293b', hexText: '#0f172a', opacity: 1 };
        if (!c || typeof c !== 'string' || c.toLowerCase() === 'default') return def;
        const low = c.toLowerCase().replace(/\s+/g, '');
        if (low.startsWith('rgba')) {
            const p = low.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
            if (p) {
                return {
                    hexBg: `rgb(${p[1]},${p[2]},${p[3]})`,
                    hexBorder: '#94a3b8',
                    hexText: '#1e293b',
                    opacity: parseFloat(p[4]) || 1
                };
            }
        }
        return PALETTES[low] ? Object.assign({}, def, PALETTES[low]) : Object.assign({}, def, { hexBg: c, hexBorder: '#94a3b8' });
    }

    function el(tag, attrs, parent) {
        const node = document.createElementNS(SVG_NS, tag);
        if (attrs) {
            for (const [k, v] of Object.entries(attrs)) {
                if (v !== undefined && v !== null) {
                    node.setAttribute(k, String(v));
                }
            }
        }
        if (parent) parent.appendChild(node);
        return node;
    }

    function appendMultilineText(parent, text, x, y, fontSize, color, rotate = false) {
        const lines = String(text || '').split(/<br\s*\/?>|\n/i);
        const totalHEm = (lines.length - 1) * 1.35;
        const attrs = {
            x, y,
            'font-size': fontSize,
            fill: color,
            'font-weight': '700',
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            'font-family': "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif"
        };
        if (rotate) {
            attrs.transform = `rotate(-90, ${x}, ${y})`;
        }
        const textEl = el('text', attrs, parent);
        lines.forEach((line, i) => {
            const tspan = el('tspan', {
                x,
                dy: i === 0 ? `-${totalHEm / 2}em` : '1.35em'
            }, textEl);
            tspan.textContent = line;
        });
        return textEl;
    }

    function appendShape(parent, type, w, h, stroke, fill) {
        if (type === 'circle') {
            return el('circle', {
                cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2,
                fill, stroke, 'stroke-width': '2.2'
            }, parent);
        }
        if (type === 'decision') {
            return el('polygon', {
                points: `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`,
                fill, stroke, 'stroke-width': '2.2'
            }, parent);
        }
        if (type === 'database') {
            const g = el('g', null, parent);
            el('path', {
                d: `M 0,10 C 0,-5 ${w},-5 ${w},10 L ${w},${h - 10} C ${w},${h + 5} 0,${h + 5} 0,${h - 10} Z`,
                fill, stroke, 'stroke-width': '2.2'
            }, g);
            el('path', {
                d: `M 0,10 C 0,22 ${w},22 ${w},10`,
                fill: 'none', stroke, 'stroke-width': '2'
            }, g);
            return g;
        }
        if (type === 'note') {
            const g = el('g', null, parent);
            el('path', {
                d: `M 0,0 L ${w - 15},0 L ${w},15 L ${w},${h} L 0,${h} Z`,
                fill, stroke, 'stroke-width': '2.2'
            }, g);
            el('path', {
                d: `M ${w - 15},0 V 15 H ${w}`,
                fill: 'none', stroke, 'stroke-width': '2'
            }, g);
            return g;
        }
        if (type === 'stadium') {
            return el('rect', {
                width: w, height: h, rx: h / 2,
                fill, stroke, 'stroke-width': '2.2'
            }, parent);
        }
        if (type === 'point') {
            return el('circle', {
                cx: w / 2, cy: h / 2, r: 6,
                fill: stroke, stroke: '#ffffff', 'stroke-width': '2'
            }, parent);
        }
        return el('rect', {
            width: w, height: h, rx: 6,
            fill, stroke, 'stroke-width': '2.2'
        }, parent);
    }

    function calculateOrthogonalPath(st, en, sa, ea, offset = 0, hasArrow = true) {
        const isV = (a) => a === 't' || a === 'b';
        const isH = (a) => a === 'l' || a === 'r';
        const adjustedEn = { x: en.x, y: en.y };
        const arrowLength = hasArrow ? 7 : 0;

        if (ea === 't') adjustedEn.y -= arrowLength;
        else if (ea === 'b') adjustedEn.y += arrowLength;
        else if (ea === 'l') adjustedEn.x -= arrowLength;
        else if (ea === 'r') adjustedEn.x += arrowLength;

        if (isV(sa) && isV(ea)) {
            const midY = Math.round((st.y + adjustedEn.y) / 2) + offset;
            return [st, { x: st.x, y: midY }, { x: adjustedEn.x, y: midY }, adjustedEn];
        }
        if (isH(sa) && isH(ea)) {
            const midX = Math.round((st.x + adjustedEn.x) / 2) + offset;
            return [st, { x: midX, y: st.y }, { x: midX, y: adjustedEn.y }, adjustedEn];
        }
        if (isV(sa) && isH(ea)) {
            if (offset === 0) return [st, { x: st.x, y: adjustedEn.y }, adjustedEn];
            const tempY = adjustedEn.y + offset;
            return [st, { x: st.x, y: tempY }, { x: adjustedEn.x, y: tempY }, adjustedEn];
        }
        if (isH(sa) && isV(ea)) {
            if (offset === 0) return [st, { x: adjustedEn.x, y: st.y }, adjustedEn];
            const tempX = adjustedEn.x + offset;
            return [st, { x: tempX, y: st.y }, { x: tempX, y: adjustedEn.y }, adjustedEn];
        }
        return [st, adjustedEn];
    }

    /**
     * LogicStream DSL パーサー
     */
    function parseDSL(inputText) {
        const lanes = [], phases = [], steps = [], flows = [], actives = [];
        let dir = 'Vertical';
        let title = '';

        String(inputText || '').split('\n').forEach(line => {
            const l = line.trim();
            if (!l || l.startsWith('//') || l.startsWith('#')) return;

            if (l.startsWith('Title:')) {
                title = l.replace('Title:', '').trim();
            } else if (l.startsWith('Direction:')) {
                dir = l.includes('Horizontal') ? 'Horizontal' : 'Vertical';
            } else if (l.startsWith('Lanes:')) {
                lanes.push(...l.replace('Lanes:', '').split(',').map(s => s.trim()).filter(Boolean));
            } else if (l.startsWith('Step:')) {
                const p = l.replace('Step:', '').split('|').map(s => s.trim());
                if (p.length >= 2) {
                    steps.push({
                        id: p[0],
                        lane: p[1],
                        type: p[2] || 'process',
                        color: p[3] || 'default',
                        label: p[4] || '',
                        rowIdx: p[5] ? parseInt(p[5], 10) : steps.length + 1
                    });
                }
            } else if (l.startsWith('Flow:')) {
                const p = l.replace('Flow:', '').split('|').map(s => s.trim());
                const c = p[0] || '';
                let f = '', t = '';
                if (c.includes('==>')) [f, t] = c.split('==>');
                else if (c.includes('-.->')) [f, t] = c.split('-.->');
                else if (c.includes('-->')) [f, t] = c.split('-->');
                else if (c.includes('---')) [f, t] = c.split('---');

                if (f && t) {
                    let anchors = null, offset = 0, label = null, labelOffsetX = 0, labelOffsetY = 0;
                    let argIdx = 1;

                    if (p[argIdx] && p[argIdx].startsWith('(')) {
                        const match = p[argIdx].match(/^\(([^,]+),\s*([^)]+)\)(?:\s*([+-]?\d+))?/);
                        if (match) {
                            anchors = `(${match[1].trim()}, ${match[2].trim()})`;
                            if (match[3]) offset = parseInt(match[3], 10);
                        } else {
                            anchors = p[argIdx];
                        }
                        argIdx++;
                    }
                    if (p[argIdx]) {
                        const offsetMatch = p[argIdx].match(/^\((-?\d+),\s*(-?\d+)\)$/);
                        if (offsetMatch && argIdx > 1) {
                            labelOffsetX = parseInt(offsetMatch[1], 10);
                            labelOffsetY = parseInt(offsetMatch[2], 10);
                        } else {
                            label = p[argIdx];
                        }
                        argIdx++;
                    }
                    if (p[argIdx]) {
                        const offsetMatch = p[argIdx].match(/^\((-?\d+),\s*(-?\d+)\)$/);
                        if (offsetMatch) {
                            labelOffsetX = parseInt(offsetMatch[1], 10);
                            labelOffsetY = parseInt(offsetMatch[2], 10);
                        }
                    }

                    flows.push({
                        from: f.trim(),
                        to: t.trim(),
                        label,
                        linkType: c.includes('==>') ? 'thick' : (c.includes('-.->') ? 'dotted' : (c.includes('---') ? 'line' : 'arrow')),
                        anchors,
                        offset,
                        labelOffsetX,
                        labelOffsetY
                    });
                }
            } else if (l.startsWith('Phase:')) {
                const p = l.replace('Phase:', '').split('|').map(s => s.trim());
                if (p.length >= 2) {
                    const r = p[1].split(',').map(s => s.trim());
                    phases.push({ label: p[0], startStep: r[0], endStep: r[1] || r[0], color: p[2] || 'default' });
                }
            } else if (l.startsWith('Active:')) {
                const p = l.replace('Active:', '').split('|').map(s => s.trim());
                if (p.length >= 2) {
                    const r = p[1].split(',').map(s => s.trim());
                    actives.push({ lane: p[0], startStep: r[0], endStep: r[1] || r[0] });
                }
            }
        });

        // 未定義レーンの自動補完
        steps.forEach(s => {
            if (s.lane && !lanes.includes(s.lane)) lanes.push(s.lane);
        });

        return { title, lanes, phases, steps, flows, actives, dir };
    }

    /**
     * SVG 要素を生成して返す
     */
    function renderSVG(dslText, options = {}) {
        const config = parseDSL(dslText);
        const sizeMode = options.size && SIZE_CONFIGS[options.size] ? options.size : 'medium';
        const sCfg = SIZE_CONFIGS[sizeMode];
        const titleText = options.title || config.title || '';
        const titleHeight = titleText ? 60 : 0;
        const maxRowNum = Math.max(...config.steps.map(s => s.rowIdx), 1);

        const rowHeights = {};
        config.steps.forEach(s => {
            const lc = String(s.label || '').split(/<br\s*\/?>|\n/i).length;
            const ch = s.type === 'point' ? 16 : (sCfg.nodeH + (lc - 1) * (sCfg.font * 1.4));
            if (!rowHeights[s.rowIdx] || rowHeights[s.rowIdx] < ch) rowHeights[s.rowIdx] = ch;
        });

        const rowYOffsets = {};
        let curY = 75 + titleHeight;
        for (let r = 1; r <= maxRowNum + 2; r++) {
            rowYOffsets[r] = curY;
            curY += (rowHeights[r] || sCfg.nodeH) + sCfg.gap;
        }

        const colWidths = {};
        config.steps.forEach(s => {
            const maxL = Math.max(...String(s.label || '').split(/<br\s*\/?>|\n/i).map(l => l.length), 1);
            const cw = s.type === 'point' ? 16 : Math.max(sCfg.nodeW, maxL * sCfg.font * 0.85 + 40);
            if (!colWidths[s.rowIdx] || colWidths[s.rowIdx] < cw) colWidths[s.rowIdx] = cw;
        });

        const colXOffsets = {};
        let curX = 110;
        for (let r = 1; r <= maxRowNum + 2; r++) {
            colXOffsets[r] = curX;
            curX += (colWidths[r] || sCfg.nodeW) + sCfg.gap;
        }

        const counts = {};
        config.steps.forEach(s => {
            if (!counts[s.lane]) counts[s.lane] = {};
            counts[s.lane][s.rowIdx] = (counts[s.lane][s.rowIdx] || 0) + 1;
        });
        const phaseOffset = config.phases.length > 0 ? (config.dir === 'Horizontal' ? 32 : sCfg.phaseW) : 0;
        const laneMap = {};
        let curLaneX = phaseOffset + 30 + (config.dir === 'Horizontal' ? titleHeight : 0);
        config.lanes.forEach(lane => {
            const maxC = Math.max(...Object.values(counts[lane] || { 0: 1 }), 1);
            const w = maxC * sCfg.colW;
            laneMap[lane] = { x: curLaneX, width: w };
            curLaneX += w;
        });
        const totalLaneW = curLaneX;

        const cellCounts = {};
        const layout = config.steps.map(s => {
            const metric = laneMap[s.lane] || { x: 0, width: sCfg.colW };
            const key = `${s.lane}-${s.rowIdx}`;
            const idx = cellCounts[key] || 0;
            cellCounts[key] = idx + 1;
            const offX = (idx + 0.5) * sCfg.colW;

            const lc = String(s.label || '').split(/<br\s*\/?>|\n/i).length;
            const maxL = Math.max(...String(s.label || '').split(/<br\s*\/?>|\n/i).map(l => l.length), 1);
            const ch = s.type === 'point' ? 16 : (sCfg.nodeH + (lc - 1) * (sCfg.font * 1.4));
            const cw = s.type === 'point' ? 16 : Math.max(sCfg.nodeW, maxL * sCfg.font * 0.85 + 40);

            let cx, cy;
            if (config.dir === 'Horizontal') {
                cx = Math.round(colXOffsets[s.rowIdx] + cw / 2);
                cy = Math.round(metric.x + offX);
            } else {
                cx = Math.round(metric.x + offX);
                cy = Math.round(rowYOffsets[s.rowIdx] + ch / 2);
            }

            let rw = cw / 2, rh = ch / 2;
            if (s.type === 'circle') rw = rh = Math.max(cw, ch) / 2;
            else if (s.type === 'point') rw = rh = 8;

            return Object.assign({}, s, {
                cx, cy, rw, rh,
                anc: {
                    top:    { x: cx, y: cy - rh },
                    bottom: { x: cx, y: cy + rh },
                    left:   { x: cx - rw, y: cy },
                    right:  { x: cx + rw, y: cy }
                }
            });
        });

        const getLyt = (id) => layout.find(l => l.id === id);

        const boardW = config.dir === 'Horizontal'
            ? (layout.length > 0 ? Math.max(...layout.map(l => l.cx + l.rw)) + 120 : 600)
            : Math.max(totalLaneW + 40, 400);
        const boardH = config.dir === 'Horizontal'
            ? Math.max(totalLaneW + 40, 400)
            : (layout.length > 0 ? Math.max(...layout.map(l => l.cy + l.rh)) + 110 : 400);

        const svg = el('svg', {
            xmlns: SVG_NS,
            width: boardW,
            height: boardH,
            viewBox: `0 0 ${boardW} ${boardH}`,
            style: 'background:#ffffff; max-width:100%; height:auto; display:block; border-radius:12px;'
        });

        // Defs (Arrow markers)
        const defs = el('defs', null, svg);
        const mArrow = el('marker', { id: 'ls-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto' }, defs);
        el('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#334155' }, mArrow);
        const mThick = el('marker', { id: 'ls-thick-arrow', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '5', markerHeight: '5', orient: 'auto' }, defs);
        el('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#334155' }, mThick);

        // Title
        if (titleText) {
            const tx = config.dir === 'Horizontal' ? sCfg.header + 30 : (phaseOffset + 30);
            const tNode = el('text', {
                x: tx, y: 38, 'font-size': 22, 'font-weight': '900', fill: '#1e293b',
                'font-family': "'Noto Sans JP', sans-serif"
            }, svg);
            tNode.textContent = titleText;
        }

        // Phases Background
        config.phases.forEach(p => {
            const s = getLyt(p.startStep);
            const e = getLyt(p.endStep) || s;
            if (!s) return;
            const c = getColorInfo(p.color);
            if (config.dir === 'Horizontal') {
                el('rect', {
                    x: s.cx - s.rw - 20, y: titleHeight,
                    width: (e.cx - s.cx) + s.rw * 2 + 40, height: boardH - titleHeight,
                    fill: c.hexBg, 'fill-opacity': c.opacity
                }, svg);
            } else {
                el('rect', {
                    x: 0, y: s.cy - s.rh - 20,
                    width: boardW, height: (e.cy - s.cy) + s.rh * 2 + 40,
                    fill: c.hexBg, 'fill-opacity': c.opacity
                }, svg);
            }
        });

        // Active Bars
        config.actives.forEach(act => {
            const metric = laneMap[act.lane];
            const s = getLyt(act.startStep);
            const e = getLyt(act.endStep) || s;
            if (!metric || !s || !e) return;
            if (config.dir === 'Horizontal') {
                const x1 = Math.min(s.cx - s.rw, e.cx - e.rw) - 10;
                const x2 = Math.max(s.cx + s.rw, e.cx + e.rw) + 10;
                el('rect', {
                    x: x1, y: metric.x + metric.width / 2 - 10, width: x2 - x1, height: 20, rx: 6,
                    fill: '#3b82f6', 'fill-opacity': '0.14', stroke: '#3b82f6', 'stroke-width': '1.2', 'stroke-dasharray': '3,3'
                }, svg);
            } else {
                const y1 = Math.min(s.cy - s.rh, e.cy - e.rh) - 10;
                const y2 = Math.max(s.cy + s.rh, e.cy + e.rh) + 10;
                el('rect', {
                    x: metric.x + metric.width / 2 - 10, y: y1, width: 20, height: y2 - y1, rx: 6,
                    fill: '#3b82f6', 'fill-opacity': '0.14', stroke: '#3b82f6', 'stroke-width': '1.2', 'stroke-dasharray': '3,3'
                }, svg);
            }
        });

        // Lane Grid Lines
        config.lanes.forEach((lane, i) => {
            const metric = laneMap[lane];
            if (!metric || i === 0) return;
            if (config.dir === 'Horizontal') {
                el('line', { x1: 0, y1: metric.x, x2: boardW, y2: metric.x, stroke: '#cbd5e1', 'stroke-dasharray': '5,5', 'stroke-width': '1.2' }, svg);
            } else {
                el('line', { x1: metric.x, y1: 0, x2: metric.x, y2: boardH, stroke: '#cbd5e1', 'stroke-dasharray': '5,5', 'stroke-width': '1.2' }, svg);
            }
        });

        // Flow Anchor Usage (Multi-flow offset dispersion)
        const usage = {};
        const saMap = { top: 't', bottom: 'b', left: 'l', right: 'r', t: 't', b: 'b', l: 'l', r: 'r' };
        const stMap = { t: 'top', b: 'bottom', l: 'left', r: 'right' };

        const flowMeta = config.flows.map((f, i) => {
            const s = getLyt(f.from), e = getLyt(f.to);
            if (!s || !e) return null;
            let saN = config.dir === 'Horizontal' ? 'right' : 'bottom';
            let eaN = config.dir === 'Horizontal' ? 'left' : 'top';
            if (f.anchors) {
                const m = f.anchors.replace(/[()]/g, '').split(',');
                if (m.length >= 2) {
                    saN = m[0].trim().split(' ')[0].toLowerCase();
                    eaN = m[1].trim().split(' ')[0].toLowerCase();
                }
            } else if (e.rowIdx < s.rowIdx) {
                saN = config.dir === 'Horizontal' ? 'top' : 'left';
                eaN = config.dir === 'Horizontal' ? 'top' : 'left';
            }
            const sa = saMap[saN] || (config.dir === 'Horizontal' ? 'r' : 'b');
            const ea = saMap[eaN] || (config.dir === 'Horizontal' ? 'l' : 't');
            const srcKey = `${f.from}-${sa}`;
            const dstKey = `${f.to}-${ea}`;
            if (!usage[srcKey]) usage[srcKey] = [];
            usage[srcKey].push(i);
            if (!usage[dstKey]) usage[dstKey] = [];
            usage[dstKey].push(i);
            return { s, e, sa, ea, srcKey, dstKey };
        });

        const getDispersion = (idx, total, maxSpan) => {
            if (total <= 1) return 0;
            const dist = Math.min(18, maxSpan / total);
            return (idx - (total - 1) / 2) * dist;
        };

        // Render Flows
        config.flows.forEach((f, i) => {
            const meta = flowMeta[i];
            if (!meta) return;
            const { s, e, sa, ea, srcKey, dstKey } = meta;
            const st = Object.assign({}, s.anc[stMap[sa]]);
            const en = Object.assign({}, e.anc[stMap[ea]]);

            const srcList = usage[srcKey] || [];
            const dstList = usage[dstKey] || [];
            const srcOff = getDispersion(srcList.indexOf(i), srcList.length, sa === 't' || sa === 'b' ? s.rw * 1.5 : s.rh * 1.5);
            const dstOff = getDispersion(dstList.indexOf(i), dstList.length, ea === 't' || ea === 'b' ? e.rw * 1.5 : e.rh * 1.5);

            if (sa === 't' || sa === 'b') st.x += srcOff; else st.y += srcOff;
            if (ea === 't' || ea === 'b') en.x += dstOff; else en.y += dstOff;

            const hasArrow = f.linkType !== 'line';
            const pts = calculateOrthogonalPath(st, en, sa, ea, f.offset || 0, hasArrow);
            const pathData = 'M ' + pts.map(p => `${Math.round(p.x)} ${Math.round(p.y)}`).join(' L ');

            el('path', {
                d: pathData,
                stroke: '#334155',
                'stroke-width': f.linkType === 'thick' ? 4 : 2,
                'stroke-dasharray': f.linkType === 'dotted' ? '6,6' : null,
                fill: 'none',
                'stroke-linejoin': 'round',
                'marker-end': !hasArrow ? null : (f.linkType === 'thick' ? 'url(#ls-thick-arrow)' : 'url(#ls-arrow)')
            }, svg);

            if (f.label) {
                const lx = (pts.length >= 3 ? Math.round((pts[1].x + pts[2].x) / 2) : Math.round((pts[0].x + pts[1].x) / 2)) + (f.labelOffsetX || 0);
                const ly = (pts.length >= 3 ? Math.round((pts[1].y + pts[2].y) / 2) - 8 : Math.round((pts[0].y + pts[1].y) / 2) - 8) + (f.labelOffsetY || 0);

                el('rect', {
                    x: lx - (f.label.length * (sCfg.font - 2) * 0.55) - 6,
                    y: ly - (sCfg.font * 0.7),
                    width: (f.label.length * (sCfg.font - 2) * 1.1) + 12,
                    height: sCfg.font * 1.4,
                    rx: 4, fill: '#ffffff', 'fill-opacity': '0.92'
                }, svg);

                const lbl = el('text', {
                    x: lx, y: ly, 'font-size': sCfg.font - 2, 'font-weight': 'bold', fill: '#475569',
                    'text-anchor': 'middle', 'dominant-baseline': 'middle',
                    'font-family': "'Noto Sans JP', sans-serif"
                }, svg);
                lbl.textContent = f.label;
            }
        });

        // Render Nodes
        layout.forEach(s => {
            const c = getColorInfo(s.color);
            const g = el('g', { transform: `translate(${Math.round(s.cx - s.rw)}, ${Math.round(s.cy - s.rh)})` }, svg);
            appendShape(g, s.type, s.rw * 2, s.rh * 2, c.hexBorder, c.hexBg);
            if (s.type !== 'point') {
                appendMultilineText(g, s.label, s.rw, s.rh, sCfg.font, c.hexText, false);
            }
        });

        // Phase Headers
        config.phases.forEach(p => {
            const s = getLyt(p.startStep);
            const e = getLyt(p.endStep) || s;
            if (!s) return;
            const c = getColorInfo(p.color);
            if (config.dir === 'Horizontal') {
                const rx = s.cx - s.rw - 20;
                const rw = (e.cx - s.cx) + s.rw * 2 + 40;
                el('rect', { x: rx, y: titleHeight, width: rw, height: phaseOffset, fill: c.hexBorder, 'fill-opacity': '0.1' }, svg);
                el('rect', { x: rx, y: titleHeight, width: rw, height: 4, fill: c.hexBorder }, svg);
                appendMultilineText(svg, p.label, rx + rw / 2, titleHeight + phaseOffset / 2 + 2, sCfg.font, c.hexText, false);
            } else {
                const ry = s.cy - s.rh - 20;
                const rh = (e.cy - s.cy) + s.rh * 2 + 40;
                el('rect', { x: 0, y: ry, width: phaseOffset, height: rh, fill: c.hexBorder, 'fill-opacity': '0.1' }, svg);
                el('rect', { x: 0, y: ry, width: 4, height: rh, fill: c.hexBorder }, svg);
                appendMultilineText(svg, p.label, phaseOffset / 2, ry + rh / 2, sCfg.font, c.hexText, true);
            }
        });

        // Lane Headers & Footers
        config.lanes.forEach(lane => {
            const metric = laneMap[lane];
            if (!metric) return;
            if (config.dir === 'Horizontal') {
                el('rect', { x: 0, y: metric.x, width: sCfg.header, height: metric.width, fill: '#2563eb', stroke: '#1d4ed8', 'stroke-width': '1' }, svg);
                appendMultilineText(svg, lane, sCfg.header / 2, metric.x + metric.width / 2, sCfg.font + 1, '#ffffff', true);

                const footerX = boardW - sCfg.header;
                el('rect', { x: footerX, y: metric.x, width: sCfg.header, height: metric.width, fill: '#2563eb', stroke: '#1d4ed8', 'stroke-width': '1' }, svg);
                appendMultilineText(svg, lane, footerX + sCfg.header / 2, metric.x + metric.width / 2, sCfg.font + 1, '#ffffff', true);
            } else {
                el('rect', { x: metric.x, y: titleHeight, width: metric.width, height: sCfg.header, fill: '#2563eb', stroke: '#1e40af', 'stroke-width': '1' }, svg);
                appendMultilineText(svg, lane, metric.x + metric.width / 2, titleHeight + sCfg.header / 2, sCfg.font + 1, '#ffffff', false);

                const footerY = boardH - sCfg.header;
                el('rect', { x: metric.x, y: footerY, width: metric.width, height: sCfg.header, fill: '#2563eb', stroke: '#1e40af', 'stroke-width': '1' }, svg);
                appendMultilineText(svg, lane, metric.x + metric.width / 2, footerY + sCfg.header / 2, sCfg.font + 1, '#ffffff', false);
            }
        });

        return svg;
    }

    /**
     * ページ内の .logicstream 要素を自動スキャンしてSVGに変換する
     */
    function init(options = {}) {
        const selector = options.selector || '.logicstream, pre.language-logicstream, code.language-logicstream';
        const targets = document.querySelectorAll(selector);

        targets.forEach(target => {
            if (target.dataset.lsProcessed === 'true') return;
            const rawText = target.textContent || '';
            const sizeAttr = target.dataset.size || options.size || 'medium';
            const titleAttr = target.dataset.title || options.title || '';

            const svgElement = renderSVG(rawText, { size: sizeAttr, title: titleAttr });
            const wrapper = document.createElement('div');
            wrapper.className = 'logicstream-diagram';
            wrapper.style.overflowX = 'auto';
            wrapper.appendChild(svgElement);

            target.dataset.lsProcessed = 'true';
            // pre > code 構造の場合は親の pre ごと置換
            if (target.tagName === 'CODE' && target.parentElement && target.parentElement.tagName === 'PRE') {
                target.parentElement.replaceWith(wrapper);
            } else {
                target.replaceWith(wrapper);
            }
        });
    }

    // グローバルAPI公開
    global.LogicStream = {
        init,
        renderSVG,
        parseDSL
    };

    // DOM読み込み完了時に自動実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
    } else {
        init();
    }
})(window);