"use strict";
/* ===========================================================================
   content.js: EVERYTHING YOU MIGHT WANT TO EDIT LIVES HERE.
   Questions, answers, hints, lab notebook text, passcodes, learning goals,
   sources, team credits and timer settings. You do not need to touch game.js.
   Tip: keep quotes balanced, keep the commas between items, and save often.
   =========================================================================== */

/* ---- 1. Game settings ---- */
const GAME = {
  title: 'Escaping the Tremor',
  course: 'LIFE SCI 2CC3',
  group: 'Group 4',
  credits: 'Cristian L., Dhishan D., Jaanusan E., and Nicholas N.',
  timeMinutes: 30,        // length of the countdown
  hintCostMinutes: 1,     // time removed from the clock per hint
  // Text on the opening page. {minutes} is replaced by timeMinutes.
  lede: 'You are a neuroscience research team trapped inside a virtual laboratory. Ten rooms of Parkinson’s disease puzzles stand between you and the exit, and you have {minutes} minutes.',
  story1: 'Your team has been asked to investigate Patient 07, a fictional 67-year-old with symptoms of Parkinson’s disease. The moment you enter the virtual neuroscience laboratory, the security doors lock behind you.',
  story2: 'To escape, work through the patient’s diagnostic data in order: find the brain structures, trace the disease mechanism, sort the symptoms, reason through the clinical case, and choose the treatment. Each solved room reveals a passcode for the next door. Solve the last room and the final key releases the laboratory.',
  audience: 'Undergraduate science students aged 18–25 with first-year biology and basic neuroscience.',
  players: 'Teams of 2–4 work best. It is also playable solo.',
  // Colours (hex). Used only if you change them in the Google Sheet; the defaults live in styles.css.
  colors: {},
  // Google Sheet ID or link. Leave empty to use this file only. A ?sheet=... in the game URL overrides this.
  sheetId: ''
};
let TIME_LIMIT = GAME.timeMinutes * 60 * 1000;
let HINT_COST = GAME.hintCostMinutes * 60 * 1000;

/* ---- 2. Crossword layout (room 6). Each entry: a = answer, r/c = start row/column,
        d = A (across) or D (down), n = clue number, clue = the clue text.
        If you change a word, the grid positions must still cross correctly. ---- */
const CW = { h: 15, w: 12, entries: [
    {"a": "STRIATUM", "r": 0, "c": 3, "d": "A", "clue": "Caudate plus putamen, the target of the nigrostriatal pathway", "n": 2},
    {"a": "DOPAMINE", "r": 3, "c": 0, "d": "A", "clue": "Neurotransmitter released by nigrostriatal neurons", "n": 4},
    {"a": "LEVODOPA", "r": 7, "c": 3, "d": "A", "clue": "Dopamine precursor drug, first-line therapy", "n": 6},
    {"a": "SYNUCLEIN", "r": 9, "c": 0, "d": "A", "clue": "Alpha-___, the protein that aggregates in Lewy bodies", "n": 7},
    {"a": "THALAMUS", "r": 11, "c": 4, "d": "A", "clue": "Relay nucleus inhibited by GPi, which drives motor cortex", "n": 8},
    {"a": "CARBIDOPA", "r": 13, "c": 2, "d": "A", "clue": "Drug paired with levodopa to protect it outside the brain", "n": 9},
    {"a": "BRADYKINESIA", "r": 0, "c": 0, "d": "D", "clue": "Slowness of movement, required for a Parkinson diagnosis", "n": 1},
    {"a": "TREMOR", "r": 0, "c": 4, "d": "D", "clue": "Resting ___ of 4-6 Hz, often pill-rolling", "n": 3},
    {"a": "NEUROMELANIN", "r": 3, "c": 6, "d": "D", "clue": "Dark pigment that gives the substantia nigra its name", "n": 5}
  ] };

/* ---- 3. The 10 rooms. Order in this list = order in the game.
        type: hotspot | match | multi | sequence | sort | crossword | quiz
        code: 4-digit passcode revealed when the room is solved
        hints: two hints per room (each costs time in timed mode)
        notebook: explanation shown after solving (basic HTML: <p>, <b>, <ul>, <li>) ---- */
const STAGES = [
  { room: 'Pigment Wing', title: 'The Dark Nucleus', kind: 'Hotspot', goal: 'Locate the substantia nigra', type: 'hotspot', code: '3719',
    story: 'Patient 07’s scan shows reduced signal in a dark, pigmented band of the midbrain. The first door lock shows a cross-section and waits for you to point.',
    prompt: 'Click the substantia nigra on this schematic cross-section of the midbrain.',
    cfg: { svg: midbrainSVG, correct: ['sn'], names: {
      tectum: 'That is the superior colliculus, part of the tectum (the roof of the midbrain). It helps orient the eyes and head toward visual stimuli. It is dorsal, far from the substantia nigra.',
      red: 'That is the red nucleus, an iron-rich nucleus that relays motor signals toward the spinal cord. It sits just dorsal to the substantia nigra, so you are close.',
      crus: 'That is the crus cerebri (cerebral peduncle). It is pale because it is white matter carrying descending cortical axons. It lies ventral to the substantia nigra.',
      pag: 'That is the cerebral aqueduct, ringed by the periaqueductal gray (involved in pain modulation). It is a midline structure.',
      vta: 'That is the ventral tegmental area (VTA). It is also dopaminergic, but it feeds reward circuits and is relatively spared in Parkinson’s disease. Look more laterally.' } },
    hints: ['It sits ventrally, sandwiched between the red nucleus above and the pale cerebral peduncle below.',
            'Look for the dark crescent. Its name means “black substance”, and the colour comes from neuromelanin.'],
    notebook: '<p>The <b>substantia nigra pars compacta (SNpc)</b> holds dopamine-producing neurons packed with dark neuromelanin, which is where the name comes from. Their axons form the <b>nigrostriatal pathway</b> to the striatum (caudate plus putamen), where dopamine tunes the basal ganglia loops that select and scale movement.</p><p>In Parkinson’s disease these neurons degenerate. Motor signs usually appear only after a large share of them (roughly half or more) has been lost.</p>' },

  { room: 'Atlas Room', title: 'Basal Ganglia Blueprint', kind: 'Structure labelling', goal: 'Name the basal ganglia nuclei', type: 'match', code: '6204',
    story: 'Every nucleus in the wall atlas has lost its label. Restore all seven so the circuit diagram can load.',
    prompt: 'Match each lettered structure on this coronal section to its name.',
    cfg: { svg: coronalSVG, badge: true, options: ['Caudate nucleus', 'Putamen', 'Globus pallidus externa (GPe)', 'Globus pallidus interna (GPi)', 'Thalamus', 'Subthalamic nucleus (STN)', 'Substantia nigra'],
      rows: [['A', 'Caudate nucleus'], ['B', 'Putamen'], ['C', 'Globus pallidus externa (GPe)'], ['D', 'Globus pallidus interna (GPi)'], ['E', 'Thalamus'], ['F', 'Subthalamic nucleus (STN)'], ['G', 'Substantia nigra']].map(r => ({ label: r[0], ans: r[1] })) },
    hints: ['The caudate hugs the wall of the lateral ventricle. The putamen is the most lateral grey mass. Together they form the striatum.',
            'The pallidum has two segments: GPe is lateral, GPi is medial. The STN is the small lens-shaped nucleus just above the substantia nigra.'],
    notebook: '<p>The <b>striatum</b> (caudate plus putamen) is the main input nucleus. <b>GPi</b> and <b>SNr</b> are the output nuclei: they are GABAergic and tonically inhibit the <b>thalamus</b>. <b>GPe</b> and the <b>subthalamic nucleus (STN)</b> form part of the indirect loop, and the STN is the only glutamatergic (excitatory) nucleus of the basal ganglia. The <b>SNpc</b> sends dopamine to the striatum.</p>' },

  { room: 'Pathology Lab', title: 'Pathology Report', kind: 'Multiple response', goal: 'Recognize PD neuropathology', type: 'multi', code: '1853',
    story: 'A tissue report from a similar case is on screen. Only the findings that belong to Parkinson’s disease will open the specimen cabinet.',
    prompt: 'Select all findings that are characteristic of Parkinson’s disease neuropathology, then check.',
    cfg: { options: [
      { t: 'Lewy bodies: intracellular inclusions rich in aggregated alpha-synuclein', ok: true },
      { t: 'Loss of neuromelanin-containing dopaminergic neurons in the substantia nigra pars compacta', ok: true },
      { t: 'Loss of dopaminergic nerve terminals in the striatum, most severe in the putamen', ok: true },
      { t: 'Extracellular beta-amyloid plaques and tau neurofibrillary tangles as the defining lesions', ok: false },
      { t: 'Selective loss of striatal medium spiny neurons caused by an expanded CAG repeat in huntingtin', ok: false },
      { t: 'Patchy loss of myelin around axons in white matter (demyelinating plaques)', ok: false } ] },
    hints: ['Think “Lewy” and “dark pigment”. Plaques and tangles belong to a different disease.',
            'Three options are correct: one protein aggregate, one cell population, and one place where their axons end.'],
    notebook: '<p>Parkinson’s disease is a synucleinopathy: <b>alpha-synuclein</b> misfolds and aggregates into <b>Lewy bodies</b> and Lewy neurites. Neurons of the SNpc die, so dopamine terminals in the striatum, especially the putamen, are depleted.</p><p>The other options describe other diseases: plaques and tangles (Alzheimer’s), CAG-repeat striatal neuron loss (Huntington’s), and demyelination (multiple sclerosis). Braak’s staging hypothesis proposes that Lewy pathology starts in the olfactory bulb and lower brainstem before reaching the substantia nigra, which may explain early smell loss and constipation.</p>' },

  { room: 'Cascade Corridor', title: 'The Cascade', kind: 'Drag-and-drop sequence', goal: 'Order the disease mechanism', type: 'sequence', code: '4390',
    story: 'Six wall panels link a misfolded protein to a slowed hand. Someone has scrambled them.',
    prompt: 'Put the events in order, first event at the top. Drag the panels, or use the arrow buttons.',
    cfg: { items: [
      'Alpha-synuclein misfolds and aggregates into Lewy bodies inside neurons',
      'Dopaminergic neurons of the substantia nigra pars compacta degenerate',
      'Dopamine release in the striatum falls',
      'Direct pathway is under-activated and indirect pathway is over-activated',
      'GPi/SNr output increases, so the thalamus is inhibited more strongly',
      'Thalamocortical drive to motor cortex falls, producing slowed movement (bradykinesia)' ] },
    hints: ['Start at the cellular level with the protein problem and finish with something a clinician can see.',
            'Dopamine loss changes both striatal pathways before GPi/SNr output changes. The thalamus is the last stop before the cortex.'],
    notebook: '<p>This chain links a cellular problem to a clinical sign. Aggregated alpha-synuclein accompanies degeneration of SNpc neurons. Less dopamine reaches the striatum, which tilts the balance between the direct and indirect pathways. The result is more inhibitory output from GPi/SNr onto the thalamus and less excitation of motor cortex, which appears as <b>hypokinesia</b> and bradykinesia.</p><p>It is a simplified model: other circuits and transmitters also contribute.</p>' },

  { room: 'Circuit Control', title: 'Two Pathways', kind: 'Drag-and-drop sorting', goal: 'Direct vs. indirect pathway', type: 'sort', code: '8126',
    story: 'The control panel has two switches: one lets movement through, the other holds it back. The labels peeled off.',
    prompt: 'Sort each statement into the pathway it describes. Drag a statement into a box, or tap it and then tap a box.',
    cfg: { buckets: [ { id: 'D', label: 'Direct pathway', sub: 'D1 receptors' }, { id: 'I', label: 'Indirect pathway', sub: 'D2 receptors' } ],
      items: [
        { t: 'Striatal neurons carry D1 receptors, so dopamine excites them', b: 'D' },
        { t: 'Striatum projects straight to GPi/SNr', b: 'D' },
        { t: 'Net effect: disinhibits the thalamus and facilitates movement', b: 'D' },
        { t: 'In Parkinson’s disease: under-activated because D1 excitation is lost', b: 'D' },
        { t: 'Striatal neurons carry D2 receptors, so dopamine inhibits them', b: 'I' },
        { t: 'Striatum → GPe → STN → GPi/SNr', b: 'I' },
        { t: 'Net effect: strengthens inhibition of the thalamus and suppresses movement', b: 'I' },
        { t: 'In Parkinson’s disease: over-activated because D2 inhibition is lost', b: 'I' } ] },
    hints: ['Dopamine excites D1-expressing striatal neurons and inhibits D2-expressing ones.',
            'The direct route goes striatum to GPi. The indirect route detours through GPe and then the STN.'],
    notebook: '<p>Normally dopamine from the SNpc <b>excites the direct pathway</b> (D1) and <b>inhibits the indirect pathway</b> (D2), so it promotes movement. When dopamine is lost, both changes push in the same direction: GPi/SNr output rises, the thalamus is inhibited more, and motor cortex is driven less. This is the classic account of why Parkinson’s disease is a <b>hypokinetic</b> disorder.</p>' },

  { room: 'Terminology Vault', title: 'The Vault Crossword', kind: 'Crossword', goal: 'Key PD vocabulary', type: 'crossword', code: '5047',
    story: 'The vault keypad is guarded by a crossword of terms you have met so far.',
    prompt: 'Complete the crossword. Click a cell or a clue, type letters, and use the arrow keys to move. Click a cell twice to switch direction.',
    cfg: {},
    hints: ['Start with the longest answers. Letters that cross give you free checks on the words around them.',
            'Several answers appeared in earlier notebooks: the pigment, the protein that aggregates, the striatum, the relay nucleus.'],
    notebook: '<p>These terms link the rooms so far: <b>neuromelanin</b> pigments SNpc neurons, <b>alpha-synuclein</b> aggregates in Lewy bodies, <b>dopamine</b> is the transmitter lost from the <b>striatum</b>, GPi inhibits the <b>thalamus</b>, and <b>bradykinesia</b> and resting <b>tremor</b> are cardinal motor signs. <b>Levodopa</b> and <b>carbidopa</b> are the drug pair you will meet in the last room.</p>' },

  { room: 'Triage Desk', title: 'Symptom Triage', kind: 'Drag-and-drop sorting', goal: 'Motor vs. non-motor symptoms', type: 'sort', code: '2961',
    story: 'Patient 07’s chart lists twelve problems. The nurse needs them separated before the neurologist arrives.',
    prompt: 'Sort every symptom into Motor or Non-motor. Drag, or tap a symptom and then tap a box.',
    cfg: { buckets: [ { id: 'M', label: 'Motor', sub: 'Movement and its control' }, { id: 'N', label: 'Non-motor', sub: 'Sensory, autonomic, sleep, mood, cognition' } ],
      items: [
        { t: 'Resting tremor', b: 'M' }, { t: 'Rigidity', b: 'M' }, { t: 'Bradykinesia', b: 'M' }, { t: 'Postural instability', b: 'M' },
        { t: 'Micrographia (shrinking handwriting)', b: 'M' }, { t: 'Hypomimia (reduced facial expression)', b: 'M' },
        { t: 'Loss of smell (hyposmia)', b: 'N' }, { t: 'Constipation', b: 'N' }, { t: 'REM sleep behaviour disorder', b: 'N' },
        { t: 'Orthostatic hypotension', b: 'N' }, { t: 'Depression and anxiety', b: 'N' }, { t: 'Cognitive impairment', b: 'N' } ] },
    hints: ['Motor features are things the examiner can see in movement. Non-motor features involve senses, gut, blood pressure, sleep, mood and thinking.',
            'Loss of smell, constipation and orthostatic hypotension are sensory or autonomic, so they are non-motor.'],
    notebook: '<p>Parkinson’s disease affects more than movement. Non-motor features such as <b>hyposmia, constipation and REM sleep behaviour disorder</b> can appear years before tremor or slowness. They reflect pathology in olfactory, brainstem and autonomic circuits that use serotonin, noradrenaline and acetylcholine as well as dopamine, so many respond less well to levodopa. Non-motor symptoms often affect quality of life as much as motor ones.</p>' },

  { room: 'Exam Room', title: 'The Neurological Exam', kind: 'Matching', goal: 'Cardinal motor signs', type: 'match', code: '7408',
    story: 'The examiner’s notes describe five findings. Match each to the sign it shows. One finding belongs to a different movement disorder.',
    prompt: 'Match each exam finding to the correct clinical sign.',
    cfg: { badge: false, options: ['Resting tremor', 'Rigidity', 'Bradykinesia', 'Postural instability', 'Chorea'],
      rows: [
        { label: 'A 4–6 Hz “pill-rolling” oscillation of the hand that appears at rest and fades during voluntary movement', ans: 'Resting tremor' },
        { label: 'The examiner meets increased resistance throughout passive movement of a limb, with ratchet-like “cogwheel” catches', ans: 'Rigidity' },
        { label: 'Finger tapping becomes slower and smaller after a few repetitions', ans: 'Bradykinesia' },
        { label: 'When pulled briskly backward at the shoulders, the patient takes several uncontrolled steps backward (retropulsion)', ans: 'Postural instability' },
        { label: 'Brief, irregular, dance-like movements that flit from one body part to another', ans: 'Chorea' } ] },
    hints: ['Tapping tests speed, a passive limb test checks tone, and a pull test checks balance reflexes.',
            'Chorea is a hyperkinetic movement, the opposite of the slowing seen in Parkinson’s disease. It is the odd one out.'],
    notebook: '<p>Diagnosis rests on <b>bradykinesia</b> plus at least one of <b>rest tremor</b> or <b>rigidity</b>. <b>Postural instability</b> usually appears later. <b>Chorea</b> is typical of Huntington’s disease, where striatal neurons are lost and the basal ganglia produce too much movement instead of too little.</p>' },

  { room: 'Clinic', title: 'Patient 07', kind: 'Clinical case (multiple choice)', goal: 'Apply mechanisms to a patient', type: 'quiz', code: '1375',
    story: 'Mr. A., 67, a retired carpenter, has come to the clinic. The exit corridor opens only if you reason through his case.',
    prompt: 'Read the case and answer all three questions.',
    cfg: { case: '<b>Mr. A., 67.</b> For 18 months his right hand has shaken while he sits watching television; the shaking stops when he picks up his coffee cup. His handwriting has become small, he is slow to rise from a chair, his right arm no longer swings when he walks, and his wife says his voice is quieter and his face “unreadable”. Over the past five years he has lost most of his sense of smell, become chronically constipated, and begun shouting and kicking in his sleep during dreams. No family history of tremor. He takes no medications.',
      qs: [
        { q: 'Which diagnosis best fits Mr. A.?', opts: [ { t: 'Parkinson’s disease', ok: true }, { t: 'Essential tremor', ok: false }, { t: 'Alzheimer’s disease', ok: false }, { t: 'Huntington’s disease', ok: false } ] },
        { q: 'Which feature of his tremor best separates his condition from essential tremor?', opts: [ { t: 'It appears at rest and fades with purposeful movement', ok: true }, { t: 'It affects both hands equally', ok: false }, { t: 'It improves after a small amount of alcohol', ok: false }, { t: 'It began in adolescence and runs in the family', ok: false } ] },
        { q: 'Which chain best explains his slowed movement and reduced arm swing?', opts: [
          { t: 'Less nigrostriatal dopamine → direct pathway under-active and indirect pathway over-active → more GPi/SNr inhibition of the thalamus → less drive to motor cortex', ok: true },
          { t: 'More nigrostriatal dopamine → direct pathway over-active → less GPi inhibition of the thalamus → excess drive to motor cortex', ok: false },
          { t: 'Loss of STN neurons → less GPi output → thalamus released from inhibition → violent flinging movements', ok: false },
          { t: 'Loss of motor neurons in motor cortex → muscle weakness → slowed movement', ok: false } ] } ] },
    hints: ['Rest tremor, slowness and years of smell, gut and sleep changes point to one disease. Improvement with alcohol is a clue for the other tremor.',
            'Run the cascade from the earlier room: lower dopamine, more thalamic inhibition, less cortical drive.'],
    notebook: '<ul><li><b>Diagnosis:</b> rest tremor, bradykinesia, micrographia, reduced arm swing, hypophonia and hypomimia, preceded by hyposmia, constipation and REM sleep behaviour disorder, fit Parkinson’s disease. Essential tremor is typically an action tremor that is often familial and eases with alcohol. Alzheimer’s disease is defined by memory loss, and Huntington’s disease by chorea.</li><li><b>Tremor:</b> a tremor that appears at rest and diminishes with movement points toward parkinsonism.</li><li><b>Mechanism:</b> the correct chain is the same one you ordered in the Cascade Corridor. The second option describes a hyperkinetic state and the third describes hemiballismus-like movement.</li></ul>' },

  { room: 'Pharmacy and OR', title: 'Treatment Plan', kind: 'Treatment case (multiple choice)', goal: 'Levodopa and deep brain stimulation', type: 'quiz', code: '9052',
    story: 'The exit is behind the pharmacy and the surgical suite. Choose the treatment logic for Mr. A. as his disease advances.',
    prompt: 'Answer all three questions to open the final lock.',
    cfg: { qs: [
      { q: 'Why is Mr. A. prescribed levodopa instead of dopamine itself?', opts: [
        { t: 'Dopamine crosses the blood–brain barrier poorly, whereas levodopa enters the brain and is converted to dopamine there', ok: true },
        { t: 'Levodopa binds D1 and D2 receptors more strongly than dopamine does', ok: false },
        { t: 'Dopamine is destroyed by stomach acid, but levodopa is not', ok: false },
        { t: 'Levodopa regrows the degenerated substantia nigra neurons', ok: false } ] },
      { q: 'Levodopa is given together with carbidopa. What does carbidopa do?', opts: [
        { t: 'It blocks DOPA decarboxylase outside the brain, so more levodopa reaches the brain and peripheral side effects such as nausea fall', ok: true },
        { t: 'It blocks D2 receptors in the striatum', ok: false },
        { t: 'It crosses the blood–brain barrier and acts as a second dopamine precursor', ok: false },
        { t: 'It stimulates the release of alpha-synuclein from Lewy bodies', ok: false } ] },
      { q: 'Eight years later he has “wearing-off” between doses and involuntary writhing movements (dyskinesias) despite optimised levodopa. He still responds clearly to levodopa and his cognition is intact. Which next step is best supported?', opts: [
        { t: 'Deep brain stimulation: implanted electrodes delivering high-frequency stimulation to the subthalamic nucleus or GPi', ok: true },
        { t: 'Stop all dopaminergic therapy', ok: false },
        { t: 'Surgically destroy the remaining substantia nigra', ok: false },
        { t: 'Start a cholinesterase inhibitor to replace the lost dopamine', ok: false } ] } ] },
    hints: ['Think about what cannot cross the blood–brain barrier, and where the precursor must be converted into dopamine.',
            'Deep brain stimulation suits people who still respond to levodopa but have motor complications. Its targets are two nuclei from the Atlas Room.'],
    notebook: '<ul><li><b>Levodopa</b> is the dopamine precursor that crosses the blood–brain barrier (via a large neutral amino acid transporter) and is decarboxylated to dopamine by surviving neurons.</li><li><b>Carbidopa</b> inhibits peripheral DOPA decarboxylase and does not cross the barrier, so it protects levodopa in the blood without blocking dopamine synthesis in the brain.</li><li><b>Deep brain stimulation</b> of the STN or GPi can reduce motor fluctuations and dyskinesias in carefully selected patients. It modulates abnormal circuit activity. It does not stop the neurodegeneration.</li></ul><p>Every treatment here manages symptoms. None of them halts the loss of dopamine neurons.</p>' }
];

const LEARN = [
  ['Identify the substantia nigra and the basal ganglia nuclei and explain their roles in movement control.', 'Rooms 1–2'],
  ['Explain how loss of dopamine-producing neurons disrupts communication in basal ganglia circuits.', 'Rooms 3–5'],
  ['Recognize the main motor and non-motor symptoms and connect them to changes in brain function.', 'Rooms 6–8'],
  ['Apply neurological mechanisms to a clinical scenario and explain how the disease affects everyday life.', 'Rooms 8–9'],
  ['Describe how medication and deep brain stimulation manage symptoms and improve quality of life.', 'Room 10'],
  ['Build critical thinking and problem-solving skills by applying neuroscience concepts.', 'All rooms']
];

const SOURCES = [
  ['National Institute of Neurological Disorders and Stroke. Parkinson’s disease.', 'https://www.ninds.nih.gov/health-information/disorders/parkinsons-disease'],
  ['Parkinson Canada. Motor symptoms.', 'https://www.parkinson.ca/what-is-parkinsons/motor-symptoms/'],
  ['Parkinson Canada. Non-motor symptoms.', 'https://www.parkinson.ca/what-is-parkinsons/non-motor-symptoms/'],
  ['Parkinson’s Foundation. Non-movement symptoms.', 'https://www.parkinson.org/understanding-parkinsons/non-movement-symptoms'],
  ['Purves, D., et al. Neuroscience (course textbook): chapters on modulation of movement by the basal ganglia and on neuromodulatory systems.', null]
];

