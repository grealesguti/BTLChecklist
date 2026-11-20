import { sectionFields, COMPLETION_FIELDS } from '#lib/checklists/common.js';
import { describe, fieldText, statusText, activePeople } from '#lib/server/state.js';

const utc = (iso) => iso.slice(0, 16).replace('T', ' ') + ' UTC';
export const fileSafe = (s) => s.replace(/[^A-Za-z0-9._-]/g, '_');

/** Excel-friendly CSV: UTF-8 BOM, quoted cells, formula-looking cells neutralised. */
export function toCsv(rows) {
	const cell = (v) => {
		let s = String(v ?? '');
		if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
		return '"' + s.replace(/"/g, '""') + '"';
	};
	return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function logCsv(tray, state, cl, exportedBy) {
	const rows = [
		[cl.unit, tray.designation],
		['Checklist', tray.checklist_rev],
		['Exported (UTC)', new Date().toISOString()],
		['Exported by', exportedBy],
		[],
		['Entry #', 'Time (UTC)', 'Name', 'Access email', 'Type', 'Item', 'Value', 'Comment / remarks', 'Revision', 'Supersedes entry #', 'Reason for revision', 'Current'],
		['', tray.created_at, tray.created_by_name, tray.email, 'Record', 'Record created', tray.designation, '', 1, '', '', 'yes']
	];
	for (const e of state.log) {
		const d = describe(e, cl);
		rows.push([e.id, e.at, e.person_name, e.email, d.type, d.item, d.value, d.note, e.rev, e.supersedes ?? '', e.payload.reason ?? '', e.current ? 'yes' : 'superseded']);
	}
	return toCsv(rows);
}

export function summaryCsv(trays, cl) {
	return toCsv([
		[cl.unit, 'Status', 'Steps passed', 'Steps total', 'People involved', ...cl.HEADER_FIELDS.map((k) => cl.FIELDS[k].label), ...cl.derived.map((d) => d.label), 'Work lead', 'Reviewer', 'Created (UTC)', 'Last activity (UTC)'],
		...trays.map(({ tray, state, passed }) => [
			tray.designation,
			statusText(state),
			passed,
			cl.STEPS.length,
			activePeople(state).map((a) => a.payload.name).join('; '),
			...cl.HEADER_FIELDS.map((k) => fieldText(state.fields[k])),
			...cl.derived.map((d) => d.value(state.fields) ?? ''),
			fieldText(state.fields.workLead),
			fieldText(state.fields.reviewer),
			tray.created_at,
			state.log.at(-1)?.at ?? tray.created_at
		])
	]);
}

// Every user value goes through this: no LaTeX command can be injected.
const TEX = { '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', $: '\\$', '&': '\\&', '#': '\\#', '^': '\\textasciicircum{}', _: '\\_', '%': '\\%', '~': '\\textasciitilde{}', '<': '\\textless{}', '>': '\\textgreater{}', '|': '\\textbar{}', '[': '{[}', ']': '{]}' };
export const texEscape = (s) => String(s ?? '').replace(/[\\{}$&#^_%~<>|[\]]/g, (c) => TEX[c]).replace(/\n/g, ' \\newline ');

const BOX = '\\(\\square\\)';
const TICK = '\\(\\boxtimes\\)';

export function recordTex(tray, state, cl) {
	const e = texEscape;
	const rev = (a) => (a && a.rev > 1 ? ` \\textit{(rev.~${a.rev})}` : '');
	const field = (k) => e(fieldText(state.fields[k])) + rev(state.fields[k]);
	const by = (a) => (a ? `${e(a.person_name)}\\newline ${e(a.at.slice(0, 10))}${a.payload.checkedByName ? `\\newline 2nd: ${e(a.payload.checkedByName)}` : ''}` : '');
	const fieldRows = (keys) => keys.map((k) => `${e(cl.FIELDS[k].label)} & ${field(k)}\\\\\\hline`).join('\n');
	const derivedRows = (at) => cl.derived.filter((d) => d.at === at).map((d) => `${e(d.label)} (automatic) & ${e(d.value(state.fields) ?? '')}\\\\\\hline\n`).join('');
	const stepDerived = (s) => s.steps.flatMap((st) => cl.derived.filter((d) => d.at === st.n)).map((d) => `${e(d.label)} (automatic) & ${e(d.value(state.fields) ?? '')}\\\\\\hline\n`).join('');
	const refTable = (t) => `\\head{${e(t.title)}}
\\begin{tabularx}{\\textwidth}{|${t.head.map(() => 'X').join('|')}|}\\hline
${t.head.map((h) => `\\textbf{${e(h)}}`).join(' & ')}\\\\\\hline
${t.rows.map((r) => r.map(e).join(' & ') + '\\\\\\hline').join('\n')}
\\end{tabularx}`;
	const stepTable = (steps) => `\\begin{longtable}{|p{8mm}|p{102mm}|p{16mm}|p{30mm}|}
\\hline\\textbf{No.}&\\textbf{Action / check}&\\textbf{Result}&\\textbf{Name / date}\\\\\\hline\\endhead
${steps
	.map((st) => {
		const a = state.steps[st.n];
		const r = a?.payload.result;
		const text = e(st.text) + (st.warn ? ` \\textbf{${e(st.warn)}}` : '') + (st.links ?? []).map((l) => ` \\url{${l.url}}`).join('') +
			(a?.payload.comment ? `\\newline\\textit{Comment: ${e(a.payload.comment)}}` : '');
		return `${st.n} & ${text} & ${r === 'P' ? TICK : BOX}~P ${r === 'F' ? TICK : BOX}~F${rev(a)} & ${by(a)}\\\\\\hline`;
	})
	.join('\n')}
\\end{longtable}`;

	const sections = cl.SECTIONS.map((s) => `\\head{${e(s.title)}}
${stepTable(s.steps)}
${sectionFields(s).length || stepDerived(s) ? `\\begin{tabularx}{\\textwidth}{|p{60mm}|X|}\\hline
${fieldRows(sectionFields(s))}
${stepDerived(s)}\\end{tabularx}` : ''}`).join('\n\n');

	const people = Object.values(state.involved);
	const log = state.log
		.map((a) => {
			const d = describe(a, cl);
			const tag = a.current ? '' : ' \\textit{[superseded]}';
			const revTag = a.rev > 1 ? `rev.~${a.rev}, replaces \\#${a.supersedes}` + (a.payload.reason ? `: ${e(a.payload.reason)}` : '') : '';
			return `${a.id} & ${e(a.at.slice(0, 16).replace('T', ' '))} & ${e(a.person_name)} & ${e(d.item)}: ${e(d.value)}${d.note ? ' -- ' + e(d.note) : ''}${tag} & ${revTag}\\\\\\hline`;
		})
		.join('\n');

	return `% Generated by the BTL tray checklist web app. All recorded values are escaped.
\\documentclass[10pt,a4paper]{article}
\\usepackage[margin=17mm]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{lmodern,tabularx,longtable,array,amssymb,xcolor,fancyhdr,textcomp}
\\usepackage{hyperref}
\\definecolor{blue}{RGB}{25,65,90}
\\newcommand{\\head}[1]{\\par\\vspace{2mm}{\\large\\bfseries\\color{blue}#1}\\par\\vspace{1mm}}
\\pagestyle{fancy}\\fancyhf{}
\\fancyhead[L]{\\small ${e(tray.checklist_rev)}}
\\fancyhead[R]{\\small ${e(cl.docTitle)}}
\\fancyfoot[L]{\\small ${e(cl.unit)} designation: ${e(tray.designation)}}
\\fancyfoot[R]{\\small Page \\thepage}
\\setlength{\\headheight}{14pt}\\setlength{\\parindent}{0pt}
\\renewcommand{\\arraystretch}{1.1}
\\setlength{\\tabcolsep}{3pt}
\\begin{document}
{\\LARGE\\bfseries\\color{blue}${e(cl.docTitle)}}\\\\[3mm]
\\textbf{Assembly and integration record}\\quad Exported ${e(utc(new Date().toISOString()))}. Entries marked \\textit{(rev.~N)} were revised; see the log at the end.\\\\[3mm]
\\begin{tabularx}{\\textwidth}{|p{60mm}|X|}\\hline
${e(cl.unit)} designation number & ${e(tray.designation)}\\\\\\hline
${fieldRows(cl.HEADER_FIELDS)}
${derivedRows('header')}\\end{tabularx}

\\head{People involved}
\\begin{tabularx}{\\textwidth}{|X|X|p{40mm}|}\\hline
\\textbf{Name} & \\textbf{Role} & \\textbf{Added by / date}\\\\\\hline
${people.map((a) => `${e(a.payload.name)}${a.payload.active ? '' : ' \\textit{(not involved)}'} & ${e(a.payload.role)}${rev(a)} & ${by(a)}\\\\\\hline`).join('\n') || ' & & \\\\\\hline'}
\\end{tabularx}

${sections}

${cl.refTables.map(refTable).join('\n\n')}

${cl.T.components ? `\\head{${e(cl.T.components)}}
\\begin{tabularx}{\\textwidth}{|p{50mm}|p{20mm}|X|p{30mm}|}\\hline
\\textbf{Component} & \\textbf{Accounted} & \\textbf{Location / remarks} & \\textbf{Name / date}\\\\\\hline
${Object.entries(cl.COMPONENTS)
	.map(([k, label]) => {
		const a = state.components[k];
		return `${e(label)} & ${a?.payload.accounted ? TICK : BOX}${rev(a)} & ${e(a?.payload.remarks)} & ${by(a)}\\\\\\hline`;
	})
	.join('\n')}
\\end{tabularx}` : ''}

\\head{${e(cl.T.exceptions)}}
\\begin{tabularx}{\\textwidth}{|p{10mm}|X|X|p{30mm}|}\\hline
\\textbf{Step} & \\textbf{Issue} & \\textbf{Action / recheck result} & \\textbf{Name / date}\\\\\\hline
${state.exceptions.map((a) => `${e(a.payload.step)} & ${e(a.payload.issue)} & ${e(a.payload.action)}${rev(a)} & ${by(a)}\\\\\\hline`).join('\n') || ' & & & \\\\\\hline'}
\\end{tabularx}

\\head{${e(cl.T.completion)}}
\\begin{tabularx}{\\textwidth}{|p{60mm}|X|}\\hline
${fieldRows(COMPLETION_FIELDS)}
\\end{tabularx}

\\newpage
\\head{Appendix: full entry log (including superseded entries)}
{\\footnotesize
\\begin{longtable}{|p{8mm}|p{24mm}|p{28mm}|p{70mm}|p{34mm}|}
\\hline\\textbf{\\#}&\\textbf{Time (UTC)}&\\textbf{Name}&\\textbf{Entry}&\\textbf{Revision}\\\\\\hline\\endhead
${log || ' & & & & \\\\\\hline'}
\\end{longtable}}
\\end{document}
`;
}
