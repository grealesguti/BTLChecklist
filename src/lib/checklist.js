// Transcribed from BTL_CheckLIst/main.tex (BTL-TRAY-CHK-001 Rev. A – Draft).
// Steps renumbered 01–33: the .tex repeats 06, 26 and 29.
export const REVISION = 'BTL-TRAY-CHK-001 Rev. A (draft)';

const MANUAL_ROLLERS = 'https://cernbox.cern.ch/s/ncrrlCA8K80F5Tv';
const MANUAL_GROUNDING = 'https://cernbox.cern.ch/s/sHEXL3VeTG9RCM3';
const TIF_BOM = 'https://cernbox.cern.ch/files/spaces/eos/user/g/greales/TIF/TIF_ACTIVITITES_BOM.xlsx';

/**
 * Field types: text (max 100), long (max 1000, multiline), int/num (min..max),
 * select (options), person (registered name; `allowed` limits it to those names), url (https only), date (YYYY-MM-DD),
 * check (a tick, stored as 'Passed'; like every field it can't be cleared, record a failure as an exception).
 */
export const FIELDS = {
	workDates: { label: 'Work date', type: 'date' },
	bacTray: { label: 'BAC tray #', type: 'text' },
	// No longer entered (derived, see rollerOrientation()); kept so older records still display.
	rollerOrientation: { label: 'Roller orientation', type: 'text' },
	insertionSide: { label: 'Insertion location (±Z)', type: 'select', options: ['+Z', '-Z'] },
	cmsTray: { label: 'CMS tray (0–35)', type: 'int', min: 0, max: 35 },
	loopRevision: { label: 'Loop # / revision', type: 'text' },
	// TODO: replace "no. TBD" with the three commissioning test numbers.
	commTest1: { label: 'Commissioning test 1 (no. TBD) passed', type: 'check' },
	commTest2: { label: 'Commissioning test 2 (no. TBD) passed', type: 'check' },
	commTest3: { label: 'Commissioning test 3 (no. TBD) passed', type: 'check' },
	loopPressureTest: { label: 'Loop pressure test passed', type: 'check' },
	loopLeakTest: { label: 'Loop leak test passed', type: 'check' },
	foamLayers: { label: 'Foam layers in BTL modules', type: 'select', options: ['1', '2'] },
	// No longer entered (replaced by the three ticks); kept so older records still display.
	commissioningRef: { label: 'Commissioning test record', type: 'text' },

	// No longer entered; kept so older records still display.
	rollerDrawingRef: { label: 'Roller location / orientation drawing reference', type: 'text' },
	fastenerClarification: { label: 'Fastener reference / clarification', type: 'text' },

	scale1Kg: { label: 'Scale 1 reading (kg)', type: 'num', min: 0, max: 1000 },
	scale2Kg: { label: 'Scale 2 reading (kg)', type: 'num', min: 0, max: 1000 },
	finalLocation: { label: 'Final insertion location', type: 'text' },
	// No longer entered; kept so older records still display.
	scale1Id: { label: 'Scale 1 ID', type: 'text' },
	scale2Id: { label: 'Scale 2 ID', type: 'text' },
	orientationRef: { label: 'Orientation reference', type: 'text' },
	collisionEnd1: { label: 'Rotation collision check — end 1', type: 'person' },
	collisionEnd2: { label: 'Rotation collision check — end 2', type: 'person' },
	// No longer entered; kept so older records still display.
	scaffoldingRef: { label: 'Scaffolding sign-off reference', type: 'text' },
	scaffoldingSignedBy: { label: 'Scaffolding signed by', type: 'person', allowed: ['Guillermo Reales', 'Guntis Pikurs'] },
	reboundNotes: { label: 'Pull-out / rebound observations', type: 'long' },

	cernboxLink: { label: 'CERNbox file / folder link', type: 'url' },
	workLead: { label: 'Work lead', type: 'person' },
	reviewer: { label: 'Reviewer', type: 'person' },
	status: { label: 'Status', type: 'select', options: ['In progress', 'On hold', 'Complete'] }
};

export const allowedPerson = (def, p) => !def.allowed || def.allowed.some((n) => n.toLocaleLowerCase('en') === p.name.toLocaleLowerCase('en'));

export const HEADER_FIELDS =['workDates', 'bacTray', 'insertionSide', 'cmsTray', 'loopRevision', 'commTest1', 'commTest2', 'commTest3'];

// BTST roller type per CMS tray: 9–26 are +X, 0–8 and 27–35 are −X, identically for −Z and +Z.
// +X layout is Images/RollerPositioning+X.png; −X is its left–right mirror.
export const ROLLER_IMAGE = 'RollerPositioning+X.png';
// Alarm: a single foam layer is not allowed in CMS trays 18–35. Takes the recorded field entries.
export const foamAlarm = (f) => f.foamLayers?.payload.value === '1' && f.cmsTray?.payload.value >= 18 && f.cmsTray.payload.value <= 35;
export const FOAM_ALARM = 'ALARM: only 1 foam layer recorded in the BTL modules, but CMS trays 18–35 need 2.';

export const rollerOrientation =(side, tray) => (side == null || tray == null ? null : tray >= 9 && tray <= 26 ? '+X' : '-X');

export const SECTIONS = [
	{
		title: '1. Identification and visual inspection',
		steps: [
			{ n: '01', text: 'Check the tray designation number and confirm commissioning tests have passed. Tick the three commissioning tests in the header. Check the loop pressure and leak tests have passed (TIF activities BOM).', requires: ['commTest1', 'commTest2', 'commTest3'], fields: ['loopPressureTest', 'loopLeakTest'], links: [{ label: 'TIF activities BOM', url: TIF_BOM }] },
			{ n: '02', text: 'Put the tray on the rotisserie. Check the orientation (180°) is correct for the power, LV and HV cables.' },
			{ n: '03', text: 'Visually inspect fiber pigtails against the referenced drawings.', images: ['FiberPathOnTray.png'] },
			{ n: '04', text: 'Check rollers are in place with the required orientation and location. Verify torque control to 0.6 N·m; washer 3.2 OD, 0.5 mm and flat-head screw.', links: [{ label: 'Roller manual', url: MANUAL_ROLLERS }] },
			{ n: '05', text: 'Check preheater sensors are not damaged. Check cabling colours against the referenced documentation.', images: ['RTDGluedOnPreheaterClamps.png', 'SnappedOffRTDFromPreheaterClamps.png'] },
			{ n: '06', text: 'Check the grounding braid according to the manual.', links: [{ label: 'Grounding manual', url: MANUAL_GROUNDING }], images: ['kaptonTapedContactsUnderGroundingBraid.png'] },
			{ n: '06a', text: 'Check the number of foam layers in the BTL modules (1 or 2).', warn: 'Trays CMS # 18–35 must have 2 layers.', fields: ['foamLayers'] }
		],
		fields: []
	},
	{
		title: '2. Assembly and service plate',
		steps: [
			{ n: '07', text: 'Add pipe clamps and preheaters. Fasteners: M2.2×10 BOSSARD 3772865, M2.2×14 BOSSARD 3772867 and M3×16 CBSTSE3-16, with M3 nuts with nylon threadlock inserts BOSSARD 1397176.', images: ['DropOfThermalPasteUnderPreheaterClamps.png'] },
			{ n: '08', text: 'Add the service plate. Check the service plate has the grounding insert nut SSFH-315SF-SUS.', warn: 'Retain the fiber holder, rollers and L profiles; do not lose these components.' },
			{ n: '09', text: 'Check the fiber holder and rollers are in the correct location for the service plate (M2.2×5 BOSSARD 1727702); fit / check L profiles (M2×4).' },
			{ n: '10', text: 'After adding the service plate, connect the fiber to it and connect / secure the cables with M3 standoffs.' },
			{ n: '11', text: 'Add manifold holders to the service plate (M2.2×6 BOSSARD 1727796).' },
			{ n: '12', text: 'Add Airex with double-sided Kapton; add four single-sided Kapton pieces to the edges.', warn: 'Do not press on the LYSO.' },
			// Former step 13, split into sub-steps so later step numbers (and their records) stay put.
			{ n: '13a', text: 'Before installation, clean the intermediate-beam grooves with isopropyl alcohol. Clean the beams in the BTST as well.' },
			{ n: '13b', text: 'Apply PTFE lubricant to both the intermediate beams and BTST beams, and to the sides of the Bosch profiles, before fitting the intermediate beams and sliders.', warn: 'Only if not done previously. Use the small nozzle, only in the groove — not sprayed from 1 m away.' },
			{ n: '13c', text: 'Add intermediate beams to the Bosch profiles; check the profile nuts are correctly rotated and properly seated in the grooves.', images: ['TorqueControlM4AndM8OfIntermediateBeams.png'] },
			{ n: '13d', text: 'Check the intermediate-beam screws are not lifting the black adapters or pushing against the profiles.', images: ['AvoidSpacesBTWBeamAdapterAndIntermediateBeam.png'] },
			{ n: '14', text: 'Start removing the ears from the Bosch profiles.', warn: 'Leave the last ear at the bottom in the pipe region.' },
			{ n: '15', text: 'Readjust the intermediate beams to the edge of the profile in the pipes region.', images: ['AdjustmentOfIntermediateBeams.png'] },
			{ n: '16', text: 'Add adapters to the BTST beams and add the pulling tool (M2.5×8).' },
			{ n: '17', text: 'Add the four tray spacers.' }
		],
		fields: ['fastenerClarification']
	},
	{
		title: '3. Weighing, transfer and insertion',
		steps: [
			{ n: '18', text: 'Turn the tray around and remove it from the rotisserie.' },
			{ n: '19', text: 'Weigh the tray using two scales. Record both readings below.', fields: ['scale1Kg', 'scale2Kg'] },
			{ n: '20', text: 'Position the tray on the lifting table.', warn: 'Before using the lifting table, block its wheels and verify it is secured.' },
			{ n: '21', text: 'Verify PTFE lubricant (Galaxus 12452644) has been applied to the sides of the Bosch profiles before fitting the sliders (step 13b). Position the nylon sliders on the sides of the Bosch profiles.' },
			{ n: '22', text: 'Position the tray in the insertion tool; tighten the sliders.', warn: 'Before using the insertion tool, check its wheels are locked.', images: ['CheckGroundingPointsToInsertionToolAndBTST.png'] },
			{ n: '23', text: 'Rotate the insertion tool to the final location with two people checking for collisions, one at each end. Record the location and their names below.', warn: 'Mark the slider locations before rotation (distance to be defined).', fields: ['finalLocation', 'collisionEnd1', 'collisionEnd2'], images: ['InsertionOrderOfSupertrays-Z.png'] },
			{ n: '24', text: 'Release the sliders and push the tray into location.' },
			{ n: '25', text: 'Adjust using the white knobs.', images: ['InsertionToolWhiteKnobsUsage.png'] },
			{ n: '26', text: 'Record who signed off the scaffolding below.', warn: 'Check the scaffolding has been signed off before pulling from inside it.', fields: ['scaffoldingSignedBy'] },
			{ n: '27', text: 'Pull from inside the scaffolding until the services region.' },
			{ n: '28', text: 'Push the services area into the tube; check carefully there is no interaction with the Airex.' },
			{ n: '29', text: 'Add the weighted plates on the insertion tool and push out the cradle. Record any unexpected behaviour below (write “none” if there was none).', warn: 'Rebound is expected if not done properly.', fields: ['reboundNotes'] },
			{ n: '30', text: 'Put the insertion tool back at the bottom.' },
			{ n: '31', text: 'Remove the Bosch profile.' },
			{ n: '32', text: 'Remove the pulling tool.' },
			{ n: '33', text: 'Store the intermediate beam and related components. Record the storage location in section 4.', images: ['TrayTestingInBTSTAfterInsertion.png'] }
		],
		fields: []
	}
];

// A step's own `fields` are shown inside the step and, with `requires`, must be recorded before it can pass.
export const stepNeeds = (st) => [...(st.requires ?? []), ...(st.fields ?? [])];
// Every field belonging to a section, in step order, for the printable record / export.
export const sectionFields = (section) => [...section.steps.flatMap((st) => st.fields ?? []), ...section.fields];

export const STEPS = SECTIONS.flatMap((s) => s.steps);
export const STEP_BY_N = Object.fromEntries(STEPS.map((s) => [s.n, s]));

export const COMPONENTS = {
	intermediateBeams: 'Intermediate beam(s)',
	intermediateBeamScrews: 'Intermediate beam M8 screws',
	boschProfiles: 'Bosch profile(s)',
	insertionSliders: 'Bosch insertion tool sliders, with screws and nuts',
	removedEars: 'Removed ears / related components'
};

export const FASTENERS = [
	['Rollers', '0.6 N·m; washer 3.2 OD, 0.5 mm; flat-head screw'],
	['Pipe clamps / preheaters', 'M2.2×10, M2.2×14, M3×16; M3 nylon-insert nuts'],
	['Service-plate roller / holder location', 'M2.2×6 (step 09 says M2.2×5 — to confirm)'],
	['L profiles', 'M2×4'],
	['Cable connection / support', 'M3 standoffs'],
	['Manifold holders', 'M2.2×6'],
	['BTST adapters / pulling tool', 'M2.5×8']
];

export const REQUIRED_FOR_COMPLETION = ['workDates', 'insertionSide', 'cmsTray', 'commTest1', 'commTest2', 'commTest3', 'scale1Kg', 'scale2Kg', 'finalLocation', 'scaffoldingSignedBy', 'workLead', 'reviewer'];
