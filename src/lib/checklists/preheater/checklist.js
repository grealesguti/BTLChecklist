// Preheater assembly, part 2: resistors glued on top of the aluminium clamps that already carry the
// PT1000s (../sensor), in the blue 3D-printed jig on the tray's red holders. Same tray designation as
// the sensor gluing record; step 03 needs that record Complete.
// Images: { f, caption, marks: [[x%, y%, label]] } (numbered markers + legend); see README.
import { LINKS } from '../common.js';
import { GLUE_FIELDS, NAMING, DEFECTS, TWO_PEOPLE, SAFETY_STEPS, GLUE_PREP, GLUE_WORKLIFE, GLUE_LINKS, ptAlarm, rangeAlarm, keysOf, ohm } from '../sensor/checklist.js';

export const REVISION = 'Preheater resistor gluing Rev. A (draft)';

// Marking "221 30 / 3300 1%" (Bourns PWR221T-30, 330 Ω 1 %) read on the assembly photos.
// TODO: confirm the part number; ±3 % leaves room for multimeter leads.
export const RES_RANGE = [320, 340];
export const resAlarm = (prefix) => rangeAlarm(prefix, 'Resistor', ...RES_RANGE, ', nominal 330 Ω');

export default {
	id: 'preheater',
	title: 'Preheater gluing (resistors)',
	docTitle: 'Preheater assembly — resistor gluing',
	unit: 'Tray',
	minPeople: 2,
	strictOrder: true,
	REVISION,
	FIELDS: { ...GLUE_FIELDS, ...ohm('resBefore', 'Resistor before gluing'), ...ohm('resAfter', 'Resistor after curing'), ...ohm('ptAfter', 'PT1000 after resistor gluing') },
	HEADER_FIELDS: ['workDates'],
	refTables: [NAMING, DEFECTS],
	knownIssues: [
		{ type: 'Broken pin in the jig: resistor slid, holes not aligned with the aluminium clamp', hint: 'Small slide: drill through the resistor by hand. Too large: remake the whole assembly (cut, solder a new sensor and heater, reglue). Repair the jig before reuse.' },
		{ type: 'Resistor out of range / no signal', hint: 'Measure at the connector and at the resistor; record values.' }
	],
	reminders: `${TWO_PEOPLE} ESD shoes or a grounded wrist strap at all times; neighbouring detector units covered with ESD-safe foil or slid out. The glued PT1000 wires are fragile: handle the clamps, never the wires. Tape the outer edge of each resistor so wire tension cannot lift it. Zip ties only on top of the stack.`,
	SECTIONS: [
		{
			title: '1. Safety and preparation',
			steps: [
				...SAFETY_STEPS,
				{ n: '03', text: 'Check the sensor gluing record of this tray is Complete (cured and inspected).', previous: true },
				{ n: '04', text: 'Check the blue resistor jig: all 3D-printed positioning pins present and intact, magnets of the second and third layers in place.', warn: 'A missing pin lets the resistor slide in one direction and misaligns it with the aluminium clamp. Do not use the jig until it is repaired.', check2: true },
				// TODO: confirm the cleaning agent with the work lead.
				{ n: '05', text: 'Clean the top of the aluminium clamps and the bonding side of the resistors with isopropyl alcohol and lint-free wipes; let them dry. Wear gloves and do not touch the bonding surfaces afterwards.' },
				{
					n: '06',
					text: 'Put each resistor in its pocket of the blue jig, next to its own clamp (cable colours, mapping table), pushed against the pins so it cannot slide. Check each one against the datasheet, measure it and record the values below.',
					fields: keysOf('resBefore'),
					alarm: resAlarm('resBefore'),
					check2: true,
					links: [LINKS.resistorDatasheet],
					images: [{ f: 'step1prepositioningofresistorsinjig_attentiontopintoavoidthemsliding.jpg', caption: 'Resistors prepositioned in the blue jigs; neighbouring trays covered with foil, work area taped off', marks: [[50, 27, 'Resistor in its pocket, against the pins'], [32, 74, 'Second jig, same check'], [18, 30, 'Neighbouring tray covered with foil'], [76, 62, 'Barrier tape around the work area']] }]
				},
				{ n: '07', text: GLUE_PREP, warn: GLUE_WORKLIFE, fields: ['glueLot', 'glueExpiry'], links: GLUE_LINKS }
			]
		},
		{
			title: '2. Gluing',
			steps: [
				{
					n: '08',
					text: 'Tape Kapton over the outer edge of each resistor so it cannot move up during gluing. The Kapton also covers the hole that must be opened again after curing.',
					images: [{ f: 'step2attachkaptontoavoidthemmovingupduringgluing_tapingholethatwillneedtobeopenedlateronaftercuring.jpg', caption: 'Kapton strips holding the resistors down in both jigs', marks: [[30, 40, 'Kapton strips over the resistors'], [80, 40, 'Same on the second jig']] }]
				},
				{ n: '09', text: 'Visual inspection before gluing: each resistor in the pocket of its own clamp (mapping table), against all its pins, aligned, taped. Upload a photo.', photo: true, check2: true },
				{
					n: '10',
					text: 'Place the 0.2 mm glue stencil (second layer, positioned by its magnets and pin) and spread a thin layer of DP490 on top of each resistor with a spatula, only inside the openings. Upload a photo of the glue layer.',
					photo: true,
					links: GLUE_LINKS,
					images: [{ f: 'step3_glueappliedontopofsecondlayerof0.2mmwithspatulapositioningwithmagnetsandpin.jpg', caption: 'Thin glue layer spread through the 0.2 mm stencil', marks: [[57, 26, 'Glue only inside the opening'], [65, 35, 'Magnet positioning the stencil'], [25, 78, 'Second jig: same']] }]
				},
				{ n: '11', text: 'Remove the glue stencil.' },
				{ n: '12', text: 'Lay the clamps, already pressure-fitted on the second layer (positioned by its magnets), on top of the resistors. Check each clamp sits on its own resistor (mapping table: preheater clamps 204–207).' },
				{
					n: '13',
					text: 'Place the third layer (with magnets) on top to apply pressure; tighten zip ties on top of the stack only. Upload a photo of the stack, then pass this step right away: the cure timer starts at this Pass.',
					photo: true,
					images: [{ f: 'ClosedJigDuringCuringAndZipTieShowingTooltothencutit.jpg', caption: 'Closed jig curing with a zip tie; cutter used later to open it', marks: [[51, 62, 'Zip tie on top of the stack only'], [76, 56, 'Flush cutter (only to open after curing)']] }]
				}
			]
		},
		{
			title: '3. Curing and result',
			steps: [
				// TODO: confirm the minimum time; "overnight" taken as 12 h.
				{ n: '14', text: 'Leave to cure overnight (at least 12 h).', wait: { after: '13', hours: 12 } },
				{
					n: '15',
					text: 'Cut the zip tie and open the jig. Take the preheaters out: if one sticks, press it from the back through the hole in the (grey) jig. Never force them out. Remove the Kapton and open the taped hole.',
					warn: 'Handle by the clamps, never by the wires.',
					images: [
						{ f: 'ResultAfterOpeningtheJigAfterCuring.jpg', caption: 'Jig opened after curing', marks: [[47, 58, 'Glued preheater clamps still in the jig']] },
						{ f: 'ExtractedPreheatersgluedaftercuring_seeholeinstencil to pressfrombackifneededfromgrayprint_donoforcethemout.jpg', caption: 'Extracting the preheaters: push from the back through the jig hole, do not force', marks: [[52, 84, 'Hole to press from the back'], [45, 63, 'Preheater lifted out by the clamp']] }
					]
				},
				{ n: '16', text: 'Visual inspection of the result: each resistor aligned with its clamp, resistor hole matching the aluminium clamp hole, fully bonded; PT1000 and resistor wires intact; no glue on neighbouring units. Measure every resistor and PT1000 again. Upload a photo of each clamp and record any defect below (defects table).', photo: true, fields: [...keysOf('resAfter'), ...keysOf('ptAfter'), 'defects'], alarm: (f) => resAlarm('resAfter')(f) || ptAlarm('ptAfter')(f), check2: true }
			]
		}
	],
	REQUIRED_FOR_COMPLETION: ['workDates', 'glueLot', 'glueExpiry', 'workLead', 'reviewer']
};
