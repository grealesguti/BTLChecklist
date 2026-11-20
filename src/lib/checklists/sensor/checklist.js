// Preheater assembly, part 1: PT1000 sensors glued into the aluminium preheater clamps of one tray,
// on the tray's cradle (red holders on the Bosch profiles). Source: docs/Manual_PreheaterAssembly…pptx
// (2026-07-23) + procedure description and photos (2026-11-19). A tray has 4 clamps 1A, 1B, 2A, 2B
// (one PT1000 and one resistor each) for 2 pipes. Next: ../preheater (same tray designation).
// Step options (see README): photo, check2 (named second person), alarm(fields) (blocks Pass), wait.
// strictOrder: gluing cannot be undone, so each step passes only after all earlier ones.
import { LINKS } from '../common.js';

export const REVISION = 'Preheater sensor gluing Rev. A (draft)';

export const CLAMPS = ['1A', '1B', '2A', '2B'];
export const keysOf = (prefix) => CLAMPS.map((c) => `${prefix}${c}`);
const clampOf = (key) => key.slice(-2);
export const ohm = (prefix, what) =>
	Object.fromEntries(keysOf(prefix).map((k) => [k, { label: `${what}, clamp ${clampOf(k)} (Ω)`, type: 'num', min: 0, max: 1000000 }]));

/** Blocks Pass when a recorded value is outside [lo, hi]. */
export const rangeAlarm = (prefix, what, lo, hi, hint) => (f) => {
	const bad = keysOf(prefix).filter((k) => f[k] && (f[k].payload.value < lo || f[k].payload.value > hi));
	return bad.length ? `ALARM: ${what} of clamp ${bad.map(clampOf).join(', ')} out of range (${lo}–${hi} Ω${hint}). Check wires and part; Fail the step and record the defect.` : null;
};
// PT1000: 1000 Ω at 0 °C, ≈1078 Ω at 20 °C. Outside this band at room temperature = broken wire, short or wrong part.
export const PT_RANGE = [1000, 1200];
export const ptAlarm = (prefix) => rangeAlarm(prefix, 'PT1000', ...PT_RANGE, ' at room temperature');

export const GLUE_FIELDS = {
	glueLot: { label: 'DP490 cartridge lot', type: 'text' },
	glueExpiry: { label: 'DP490 expiry date', type: 'date', noDefault: true, notPast: true },
	defects: { label: 'Defects found: clamp, what, action (write “none” if none)', type: 'long' }
};

// Shown with the result inspection (section index 2) of the preheater checklists. A defect = Fail the step.
export const DEFECTS = {
	title: 'Known defects and what to do',
	section: 2,
	open: true,
	head: ['Defect', 'Action'],
	rows: [
		['PT1000 wire snapped / PT1000 or resistor out of range', 'Fail the step; note which clamp. Repair decided with the work lead.'],
		['Bad gluing: no glue visible in the sensor groove', 'Fail the step; note where. Repair decided with the work lead.'],
		['Glue cured in the pipe groove', 'Prevent it: press the Kapton flat before pushing glue; clean before curing if it happens. After curing: Fail and decide with the work lead.'],
		['Resistor hole and aluminium clamp hole do not match — small mismatch', 'Drill the resistor by hand to match the clamp hole. Record it in the defects field.'],
		['Resistor hole and aluminium clamp hole do not match — large mismatch', 'Cut both off, resolder and reglue. Fail the step and record it.'],
		['Sensor or resistor on the wrong clamp (wire colours)', 'Stop before gluing if possible. After curing: Fail the step and decide with the work lead.']
	]
};

export const TWO_PEOPLE = 'Two people for every step where possible: the second checks the first, to catch errors. Steps marked “second check” need the checker’s name.';

// Shared first steps of the gluing checklists (numbers 01–02 in each).
export const ESD_STEP = { n: '01', text: 'ESD: everyone handling parts wears ESD shoes or a grounded wrist strap. Check the grounding before starting.', warn: 'Detector units are on this and the neighbouring trays: no ungrounded handling.', links: [LINKS.cernSafety] };
export const SAFETY_STEPS = [
	ESD_STEP,
	{ n: '02', text: 'Protect the neighbouring detector units from glue: cover them with ESD-safe foil, or slide them out of the way; mark the work area. Upload a photo.', warn: 'Glue must not fall on any other location.', photo: true, images: ['preheater/step1prepositioningofresistorsinjig_attentiontopintoavoidthemsliding.jpg'] }
];

// Mixing errors are the commonest bad-bond cause with two-part cartridges.
export const GLUE_PREP =
	'Check the DP490 two-component cartridge: within its expiry date and with enough glue left for all four clamps (cartridges run out: have a spare cartridge and spare nozzles ready). The two components must only mix inside the mixing nozzle: keep the outlets clean and capped, never mix them by hand. Fit a NEW mixing nozzle, dispense and discard the first bead until the glue comes out evenly mixed (black). Record the lot and expiry below.';
export const GLUE_WORKLIFE = 'Working time ≈90 min (3M): if the glue in the nozzle starts to thicken, fit a new nozzle and purge again. Mixing nozzles (and tips) are single use: discard them after use, never reuse. Gloves on; see the safety data sheet.';
export const GLUE_LINKS = [LINKS.dp490Tds, LINKS.dp490Page];

// From the manual, page 2 "Pre-heater resistor-sensor clamp mapping" (docs/…pdf; picture
// Manual_p2_ClampMappingNamesAndCableColours.jpg). Checked identical to the printed sheet in the room.
export const NAMING = {
	title: 'Clamp mapping: names and cable colours (manual page 2)',
	section: 0,
	open: true,
	head: ['Clamp', 'Preheater (resistor) cable colour', 'Sensor (PT1000) cable colour', 'Preheater clamp'],
	rows: [
		['1A', 'Black-violet', 'White/gray + brown/gray', '204'],
		['1B', 'Red-blue', 'White/blue + brown/blue', '207'],
		['2A', 'Yellow-green', 'Yellow/black + green/black', '206'],
		['2B', 'Pink-gray', 'White/orange + pink/brown', '205']
	]
};

export default {
	id: 'sensor',
	title: 'Sensor gluing (PT1000)',
	docTitle: 'Preheater assembly — PT1000 sensor gluing',
	unit: 'Tray',
	minPeople: 2,
	strictOrder: true,
	REVISION,
	FIELDS: { ...GLUE_FIELDS, ...ohm('ptBefore', 'PT1000 before gluing'), ...ohm('ptAfter', 'PT1000 after curing') },
	HEADER_FIELDS: ['workDates'],
	refTables: [NAMING, DEFECTS],
	// Problems found later (Issues page): known types and what is usually done.
	knownIssues: [
		{ type: 'Glue cured in the pipe groove (not cleaned during curing)', hint: 'Prevent: press the Kapton flat before gluing and clean any glue in the pipe groove before it cures. If cured: decide with the work lead.' },
		{ type: 'PT1000 wire snapped', hint: 'Usually the wire was not glued up to the coloured insulation. Decide repair with the work lead.' },
		{ type: 'PT1000 out of range / no signal', hint: 'Measure at the connector and at the sensor; record values.' },
		{ type: 'Glue mess: tip separated from the mixing nozzle', hint: 'Superglue joint not cured or not pull-tested. Note which clamps/units got glue and what was cleaned.' },
		{ type: 'Glue ran out during gluing', hint: 'Note which clamps were glued with which cartridge (lots), and whether a clamp got a partial fill.' }
	],
	reminders: `${TWO_PEOPLE} ESD shoes or a grounded wrist strap at all times; neighbouring detector units covered with ESD-safe foil or slid out. PT1000 wires are fragile once glued: never leave bare metal wire outside the glue, and keep the wires under as little tension as possible. Do not move the cradle during the 24 h cure.`,
	SECTIONS: [
		{
			title: '1. Safety and preparation',
			steps: [
				...SAFETY_STEPS,
				// TODO: confirm the cleaning agent with the work lead (IPA as in the tray checklist).
				{ n: '03', text: 'Clean the grooves and bonding surfaces of the aluminium clamps with isopropyl alcohol and lint-free wipes; let them dry. Wear gloves and do not touch the bonding surfaces afterwards.' },
				{ n: '04', text: 'Preposition the four clamps 1A, 1B, 2A, 2B on the cradle, sensor groove on top, each next to the PT1000 with its cable colour (mapping table). Measure each PT1000 with a multimeter and record the values below.', fields: keysOf('ptBefore'), alarm: ptAlarm('ptBefore'), check2: true, images: [
					{ f: 'Manual_p2_ClampMappingNamesAndCableColours.jpg', caption: 'Manual page 2: clamp names 1A/1B/2A/2B, cable colours and preheater clamps 204–207' },
					{ f: 'Manual_p3_PositionClampsWithSensorsAndKapton.jpg', caption: 'Manual page 3: position the clamps with the sensors (groove on top, check cable colours)' },
					'PrepositioningOfSensorsAndClampsToAvoidWrongWiring.jpg', 'ViewOfPrintedWiringDiagramsInTheRoom.jpg', 'NOTPROCEDURAL_ViewOfColourCodeWithClampPerSide.jpg', 'ViewOfSensorsAndResistors.jpg', 'HoldingStencilsOnBoschProfiles.jpg'] },
				{ n: '05', text: GLUE_PREP, warn: GLUE_WORKLIFE, fields: ['glueLot', 'glueExpiry'], links: GLUE_LINKS },
				// Sub-step: keeps the later step numbers (and any records) unchanged.
				{
					n: '05b',
					text: 'Glue gun: two-component cartridge + new mixing nozzle + 1.3 mm green tip glued onto the mixing nozzle with superglue, fitted at the mark on the syringe. Let the superglue cure, then pull gently on the tip: it must not move. Clean the tip.',
					warn: 'If the tip separates from the mixing nozzle during gluing, glue goes everywhere: stop, wipe immediately, fit a new nozzle + tip. Discard nozzle and tip after use.',
					check2: true,
					images: [
						{ f: 'Manual_GlueGunCartridgeMixingNozzleAndGreenTip.jpg', caption: 'Glue gun with the DP490 cartridge; mixing nozzle with the green 1.3 mm tip', marks: [[38, 50, 'Glue gun'], [64, 64, 'DP490 two-component cartridge: enough glue left?'], [87, 64, 'Mixing nozzle: components mix only in here (single use)'], [92, 42, 'Superglue joint: green 1.3 mm tip on the mixing nozzle (pull test)']] },
						{ f: 'Manual_p4_GlueTheSensors.jpg', caption: 'Manual page 4: glue the sensors' }
					]
				},
				{ n: '06', text: 'First apply Kapton on the sensor side of each clamp (extra Kapton area around the groove). Do not cover the screw holes. Leave the syringe hole at the back open until the glue is applied.', images: ['Manual_KaptonFirstThenSensorInRedAreaHeatShrinkTouchingKapton.png'] },
				{ n: '07', text: 'Then slide each PT1000 into the groove of its clamp (red area) on the Kapton: fully inside the groove, heat shrink touching the Kapton. Tape the sensors to the cradle until gluing; no red supports under the Kapton layer.', warn: 'Wire tension can pull a sensor out of its groove: leave slack.', images: [{ f: 'Manual_p3_PositionClampsWithSensorsAndKapton.jpg', caption: 'Manual page 3: Kapton first, then the sensor in the red area, heat shrink touching the Kapton' }, 'PrepositioningOfSensorsAndClampsToAvoidWrongWiringViewFromFront_SensorsCanBeTensionedAndDecoiupleFromKapton.jpg', 'TOAVOID_sensorscuringwithziptie_sensorsslidingoutduetotension.jpg'] },
				{ n: '08', text: 'Visual inspection before gluing: each sensor in the right clamp (cable colour ↔ clamp, mapping table), fully in the groove, on the Kapton. Upload a photo.', photo: true, check2: true }
			]
		},
		{
			title: '2. Gluing',
			steps: [
				{ n: '09', text: 'Press the Kapton flat, then introduce the 1.3 mm tip into the back hole of the sensor. Watching the front, push glue until there is an excess, preferably reaching the heat shrink.', warn: 'Glue must not run into the pipe groove: if it does, clean it before it cures. Watch the tip–nozzle joint while pushing.', images: [{ f: 'Manual_p4_GlueTheSensors.jpg', caption: 'Manual page 4: tip in the back hole, push until the excess reaches the heat shrink' }, 'TOAVOID_sensorscuredwithglueinthepipegroove_cleanbeforeifithappens_presskaptontoavoidbeforepressingglue.jpg'] },
				{ n: '10', text: 'Add an extra drop of DP490 where the wires leave the sensor, so the glue covers them up to the coloured insulation. Upload a photo.', warn: 'No bare metal wire may stay exposed: unglued PT1000 wires have already snapped.', photo: true, check2: true },
				{ n: '11', text: 'Cover the syringe hole with Kapton. Check the glue does not go beyond the Kapton area.' },
				{ n: '12', text: 'Join the clamps in pairs, 1A with 1B and 2A with 2B, pressed together and fixed to the cradle with the 2 red holders (2.2 self-tapping screw and M3×10 screw), so the shape is kept during curing.', images: [{ f: 'Manual_p5_CuringPairsOnRedHolders.jpg', caption: 'Manual page 5: curing with the clamp pairs fixed together and to the cradle' }, 'SingleSideOfBosh2aluclampspressedagainsteachotherwithziptiecuring.jpg', 'SensorsAfterGluingInTheJigDuringCuringWithZipTies4plates2and2ontopofeachothertokeeptheshape.png'] },
				{ n: '13', text: 'Route the wires with as little tension as possible.', images: ['TOAVOID_sensorscuringwithziptie_sensorsslidingoutduetotension.jpg'] },
				{ n: '14', text: 'Tighten a zip tie to press the clamps against the cradle. Upload a photo of the set-up, then pass this step right away: the 24 h cure timer starts at this Pass.', photo: true, images: ['SensorsAfterGluingInTheJigDuringCuringWithZipTies4plates2and2ontopofeachothertokeeptheshapeViewOnTheBoschProfiles.png'] }
			]
		},
		{
			title: '3. Curing and result',
			steps: [
				{ n: '15', text: 'Leave to cure on the cradle for at least 24 h.', wait: { after: '14', hours: 24 } },
				{ n: '16', text: 'Cut the zip tie, release the clamps from the cradle and remove the Kapton carefully.', warn: 'Handle by the clamps, never by the wires.' },
				{ n: '17', text: 'Visual inspection of the result: each sensor fully bonded in its groove, no glue in the pipe groove, glue up to the coloured insulation (no bare wire), wires intact, no glue on neighbouring units. Measure each PT1000 again. Upload a photo of each clamp and record any defect below (defects table).', photo: true, fields: [...keysOf('ptAfter'), 'defects'], alarm: ptAlarm('ptAfter'), check2: true, images: ['SensorsAfterGluingAndCuringAfterRemovingFromtheJig.png', 'SensorsAfterGluingAndCuringAfterRemovingFromtheJigN2.png'] }
			]
		}
	],
	REQUIRED_FOR_COMPLETION: ['workDates', 'glueLot', 'glueExpiry', 'workLead', 'reviewer']
};
