// Preheater assembly, part 3: the glued preheater clamps (../sensor, ../preheater) mounted on the pipes
// of the tray with the black PPS-CF pipe holder. Draft from the assembly photos (2026-11-19).
// Comes before the tray insertion checklist (insertion is always last).
import { NAMING, DEFECTS, TWO_PEOPLE, ESD_STEP, ptAlarm, keysOf, ohm } from '../sensor/checklist.js';
import { resAlarm } from '../preheater/checklist.js';
import { LINKS } from '../common.js';

export const REVISION = 'Pipe clamp and preheater assembly Rev. A (draft)';

export default {
	id: 'pipeclampandpreheaterassembly',
	title: 'Pipe clamp & preheater assembly',
	docTitle: 'Preheater assembly — pipe clamps and preheaters on the tray',
	unit: 'Tray',
	minPeople: 2,
	strictOrder: true,
	REVISION,
	FIELDS: {
		...ohm('ptMounted', 'PT1000 after mounting'),
		...ohm('resMounted', 'Resistor after mounting'),
		defects: { label: 'Defects found: clamp, what, action (write “none” if none)', type: 'long' }
	},
	HEADER_FIELDS: ['workDates'],
	refTables: [
		NAMING,
		{
			title: 'Fasteners',
			section: 1,
			head: ['Where', 'Fastener'],
			// TODO: confirm. Tray insertion step 07 lists M2.2×10 BOSSARD 3772865 and M2.2×14 BOSSARD 3772867.
			rows: [
				['Preheater against the resistors', 'M3×16 flat extra-low-head screw + M3 nut with nylon insert'],
				['Clamps into the PPS-CF pipe holder', 'M2×10 and M2×16 (photo names; to confirm against tray step 07)']
			]
		},
		DEFECTS
	],
	knownIssues: [
		{ type: 'Pipe tolerance: clamps do not fit, PPS-CF holder with a different tolerance needed', hint: 'Note which side and how much it is off; a holder with another tolerance is needed.' },
		{ type: 'Flat screw against the preheater needed (screw head too high)', hint: 'Use the M3×16 flat extra-low-head screw with a nylon-insert nut against the resistor.' },
		{ type: 'Wire pinched or snapped during mounting', hint: 'Decide repair with the work lead.' }
	],
	reminders: `${TWO_PEOPLE} ESD shoes or a grounded wrist strap at all times. The glued PT1000 wires are fragile: handle the clamps, never the wires, and never pinch a wire under a clamp or screw. Bend pipes only by hand, gently, never kink them.`,
	SECTIONS: [
		{
			title: '1. Safety and preparation',
			steps: [
				ESD_STEP,
				{ n: '02', text: 'Check the preheater gluing record of this tray is Complete (cured and inspected).', previous: true },
				{ n: '03', text: 'Collect the four glued preheater clamps 1A, 1B, 2A, 2B, the black PPS-CF pipe holder and the fasteners (table below). Check each clamp’s cable colours against the mapping table.', check2: true, images: ['sensor/ViewOfSensorsAndResistors.jpg', 'sensor/ViewOfPrintedWiringDiagramsInTheRoom.jpg'] }
			]
		},
		{
			title: '2. Assembly',
			steps: [
				{
					n: '04',
					text: 'Dry fit first: superpose the top and bottom aluminium clamps on the PPS-CF pipe holder, on both sides, without the preheaters or the side screws.',
					images: [{ f: 'BothSideAssemblyOfAluClampsOnPPSCFPipeHolder_SuperposedOnlyNoPreheaterOrSideScrews.jpg', caption: 'Dry fit on both sides: clamps superposed on the holder, no preheaters, no side screws', marks: [[30, 49, 'Left clamps superposed'], [49, 49, 'Black PPS-CF pipe holder'], [72, 49, 'Right clamps superposed']] }]
				},
				{
					n: '05',
					text: 'Right side: the bottom aluminium clamp only fits if the pipe is bent up slightly. Bend it gently by hand, just enough.',
					warn: 'Do not kink the pipe. Do not pull on the PT1000 wires.',
					check2: true,
					images: [
						{ f: 'RightSideAssemblyOfAluClampsOnPPSCFPipeHolder_SuperposedOnlyBottomAluClampOnlyPipeBendUpNeeded.jpg', caption: 'Right side, bottom clamp only: the pipe has to be bent up a little', marks: [[57, 57, 'Bottom aluminium clamp'], [62, 72, 'Pipe bent up slightly by hand']] },
						{ f: 'RightSideAssemblyOfAluClampsOnPPSCFPipeHolder_SuperposedOnly.jpg', caption: 'Right side with both clamps superposed', marks: [[61, 52, 'Top and bottom clamps superposed']] }
					]
				},
				{ n: '06', text: 'Put a drop of thermal paste under each preheater clamp.', images: ['tray/DropOfThermalPasteUnderPreheaterClamps.png'] },
				{
					n: '07',
					text: 'Mount the preheaters, each on its own clamp (mapping table, preheater clamps 204–207): M3×16 flat extra-low-head screws with nylon-insert nuts against the resistors; M2×10 and M2×16 screws into the PPS-CF holder.',
					check2: true,
					images: [
						{ f: 'FullAssemblyIntray1_flatextralowheadM3x16screwwithnyloninsertnutsagainstresistorsM2x10AndM2x16intoPPSCF.jpg', caption: 'Finished assembly in the tray (side view)', marks: [[34, 38, 'Resistor fixed with M3×16 flat screw + nylon nut'], [56, 44, 'PPS-CF pipe holder'], [75, 38, 'Second resistor']] },
						{ f: 'FullAssemblyIntray1_flatextralowheadM3x16screwwithnyloninsertnutsagainstresistorsM2x10AndM2x16intoPPSCFviewtop.jpg', caption: 'Finished assembly (top view)', marks: [[30, 59, 'Left preheater'], [46, 60, 'PPS-CF holder screws'], [60, 59, 'Right preheater']] }
					]
				},
				{ n: '08', text: 'Route the wires: no tension, none pinched under a clamp or screw, away from sharp edges; connect them as in the wiring diagram.', images: ['tray/RTDGluedOnPreheaterClamps.png', { f: 'tray/SnappedOffRTDFromPreheaterClamps.png', caption: 'TO AVOID: sensor snapped off its clamp', avoid: true }] }
			]
		},
		{
			title: '3. Electrical check and result',
			steps: [
				{ n: '09', text: 'Measure each PT1000 and each resistor at the connector side and record the values below.', fields: [...keysOf('ptMounted'), ...keysOf('resMounted')], alarm: (f) => ptAlarm('ptMounted')(f) || resAlarm('resMounted')(f), check2: true, links: [LINKS.resistorDatasheet] },
				{ n: '10', text: 'Visual inspection: all screws and nuts in place, clamps seated on the pipes, no kinked pipe, wires intact and not pinched. Upload photos of both sides and record any defect below.', photo: true, fields: ['defects'], check2: true }
			]
		}
	],
	REQUIRED_FOR_COMPLETION: ['workDates', 'workLead', 'reviewer']
};
