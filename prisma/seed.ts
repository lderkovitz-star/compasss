import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Cognitive Assessment Database...');

  // Clean existing data
  await prisma.biometricReading.deleteMany({});
  await prisma.finalScore.deleteMany({});
  await prisma.scoreSnapshot.deleteMany({});
  await prisma.response.deleteMany({});
  await prisma.assessmentSession.deleteMany({});
  await prisma.optionScore.deleteMany({});
  await prisma.scenarioOption.deleteMany({});
  await prisma.scenario.deleteMany({});
  await prisma.scenarioPackage.deleteMany({});
  await prisma.dimension.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create 11 Dimensions
  const dimensionsData = [
    { code: 'RISK_TOLERANCE', name: 'Risk Tolerance', category: 'Executive Strategy', description: 'Willingness to take calculated high-stakes risks under uncertainty.' },
    { code: 'DECISION_VELOCITY', name: 'Decision Velocity', category: 'Execution', description: 'Speed and urgency of decision-making under strict time limits.' },
    { code: 'EMOTIONAL_AGILITY', name: 'Emotional Agility', category: 'Self Regulation', description: 'Ability to stay calm, clear-headed, and adaptable during unexpected chaos.' },
    { code: 'STRATEGIC_RESILIENCE', name: 'Strategic Resilience', category: 'Executive Strategy', description: 'Perseverance and long-term vision despite immediate setbacks.' },
    { code: 'SYSTEMIC_THINKING', name: 'Systemic Thinking', category: 'Cognitive', description: 'Analyzing second and third-order consequences across interconnected systems.' },
    { code: 'CONFLICT_RESOLUTION', name: 'Conflict Resolution', category: 'Leadership', description: 'Balancing team friction, morale, and tough resource allocation.' },
    { code: 'ADAPTABILITY', name: 'Adaptability', category: 'Self Regulation', description: 'Pivoting strategies rapidly when incoming data contradicts initial assumptions.' },
    { code: 'CRISIS_COMMAND', name: 'Crisis Command', category: 'Leadership', description: 'Taking decisive authority and providing clear direction in life-or-death scenarios.' },
    { code: 'COGNITIVE_LOAD', name: 'Cognitive Load Handling', category: 'Cognitive', description: 'Maintaining analytical accuracy when presented with overwhelming, noisy data.' },
    { code: 'ETHICS_PRESSURE', name: 'Ethics Under Pressure', category: 'Governance', description: 'Adhering to core moral principles when expediency demands compromises.' },
    { code: 'ANALYTICAL_PRECISION', name: 'Analytical Precision', category: 'Cognitive', description: 'Rigorously evaluating empirical facts versus emotional impulses.' },
  ];

  const dimensionMap: Record<string, string> = {};
  for (const d of dimensionsData) {
    const created = await prisma.dimension.create({ data: d });
    dimensionMap[d.code] = created.id;
  }
  console.log(`Created ${dimensionsData.length} cognitive dimensions.`);

  // 2. Create Active Package: "Cabin in the Woods: High-Stalks Wilderness Protocol"
  const activePkg = await prisma.scenarioPackage.create({
    data: {
      name: 'Cabin in the Woods: Survival Protocol',
      code: 'CABIN_SURVIVAL_V1',
      description: 'High-stress wilderness survival simulation designed to assess split-second executive crisis leadership, risk tolerance, and biometric emotional stability under extreme environmental pressure.',
      version: '1.2.0',
      isActive: true,
    },
  });

  // Create Secondary Inactive Package for Package Switcher (Module B)
  const secondaryPkg = await prisma.scenarioPackage.create({
    data: {
      name: 'Corporate Crisis: Executive Turnaround',
      code: 'CORP_CRISIS_V1',
      description: 'Billion-dollar corporate restructuring and hostile takeover response simulation focused on strategic ethics, financial risk tolerance, and systemic team command.',
      version: '2.0.0',
      isActive: false,
    },
  });

  // 3. Create Scenarios for Active Package
  const scenariosList = [
    {
      seq: 1,
      text: 'A sudden blizzard knocks out the generator at 02:00 AM. Outside temperatures are dropping past -25°C. Solar back-up batteries are at 18%. Your team of 4 is panicked. Do you dispatch a team to repair the external transformer in zero-visibility conditions, or lock down and ration internal heat?',
      timeLimit: 45,
      options: [
        { code: 'A', text: 'Immediately lead a 2-person repair team outside with thermal gear to restore primary power.', scores: { RISK_TOLERANCE: 85, CRISIS_COMMAND: 90, DECISION_VELOCITY: 95 } },
        { code: 'B', text: 'Seal off non-essential rooms, consolidate everyone in the core bunker, and ration battery heat.', scores: { SYSTEMIC_THINKING: 88, STRATEGIC_RESILIENCE: 80, RISK_TOLERANCE: 35 } },
        { code: 'C', text: 'Wait 30 minutes to analyze weather satellite telemetry on your mobile array before moving.', scores: { ANALYTICAL_PRECISION: 92, DECISION_VELOCITY: 20, COGNITIVE_LOAD: 75 } },
        { code: 'D', text: 'Order the team to burn wooden furniture in the central hearth to conserve power completely.', scores: { EMOTIONAL_AGILITY: 60, CONFLICT_RESOLUTION: 50, RISK_TOLERANCE: 60 } },
      ],
    },
    {
      seq: 2,
      text: 'Satellite communications pick up an intermittent distress signal from a perimeter sensor station 2km east. However, night optical sensors detect unverified thermal movement along the trail. Fuel reserves are low.',
      timeLimit: 50,
      options: [
        { code: 'A', text: 'Mount an armed reconnaissance sweep immediately to investigate and secure the station.', scores: { CRISIS_COMMAND: 85, RISK_TOLERANCE: 90, DECISION_VELOCITY: 85 } },
        { code: 'B', text: 'Ignore the distress signal and reinforce perimeter defenses at the main cabin compound.', scores: { STRATEGIC_RESILIENCE: 75, ETHICS_PRESSURE: 30, SYSTEMIC_THINKING: 80 } },
        { code: 'C', text: 'Launch a drone tether to record high-resolution IR footage before making any movement decisions.', scores: { ANALYTICAL_PRECISION: 95, COGNITIVE_LOAD: 90, DECISION_VELOCITY: 40 } },
        { code: 'D', text: 'Broadcast an open radio message requesting identification on emergency channel 4.', scores: { CONFLICT_RESOLUTION: 70, EMOTIONAL_AGILITY: 65, RISK_TOLERANCE: 50 } },
      ],
    },
    {
      seq: 3,
      text: 'Water reserves have contaminated due to a cracked subterranean valve. You have 10 liters of bottled water left for 5 personnel. Purification tablets take 6 hours to act.',
      timeLimit: 40,
      options: [
        { code: 'A', text: 'Enforce strict equal rationing of 2L per person while initiating emergency filtration.', scores: { ETHICS_PRESSURE: 95, CONFLICT_RESOLUTION: 90, SYSTEMIC_THINKING: 85 } },
        { code: 'B', text: 'Allocate higher rations to personnel tasked with physical labor and perimeter security.', scores: { CRISIS_COMMAND: 80, RISK_TOLERANCE: 70, ETHICS_PRESSURE: 40 } },
        { code: 'C', text: 'Melt outside snow using high-draw electric kettles despite draining 40% remaining battery power.', scores: { DECISION_VELOCITY: 90, SYSTEMIC_THINKING: 30, EMOTIONAL_AGILITY: 50 } },
        { code: 'D', text: 'Send two operators to retrieve fresh water from a glacial stream despite avalanche risks.', scores: { RISK_TOLERANCE: 95, STRATEGIC_RESILIENCE: 65, DECISION_VELOCITY: 80 } },
      ],
    },
    {
      seq: 4,
      text: 'A high-velocity wind burst fractures the northern cabin roof beam. Structure failure is imminent within 15 minutes unless braced.',
      timeLimit: 30,
      options: [
        { code: 'A', text: 'Supervise immediate structural shore-up using heavy timber logs inside the cabin.', scores: { DECISION_VELOCITY: 95, CRISIS_COMMAND: 92, EMOTIONAL_AGILITY: 88 } },
        { code: 'B', text: 'Order immediate evacuation of the north wing into the underground storm cellar.', scores: { SYSTEMIC_THINKING: 85, RISK_TOLERANCE: 30, STRATEGIC_RESILIENCE: 80 } },
        { code: 'C', text: 'Perform stress calculation on remaining joists before committing team members to work under the beam.', scores: { ANALYTICAL_PRECISION: 90, DECISION_VELOCITY: 25, COGNITIVE_LOAD: 80 } },
        { code: 'D', text: 'Tether the exterior roof with steel winches anchored to vehicles outside.', scores: { ADAPTABILITY: 90, RISK_TOLERANCE: 75, CRISIS_COMMAND: 70 } },
      ],
    },
    {
      seq: 5,
      text: 'A team member exhibits signs of extreme acute stress disorder, arguing vehemently against operational orders and threatening to open the main entrance airlock.',
      timeLimit: 35,
      options: [
        { code: 'A', text: 'De-escalate using calm verbal negotiation while physically placing yourself between them and the door.', scores: { EMOTIONAL_AGILITY: 95, CONFLICT_RESOLUTION: 95, ETHICS_PRESSURE: 90 } },
        { code: 'B', text: 'Issue a strict executive command, and restrain the individual immediately for team safety.', scores: { CRISIS_COMMAND: 90, DECISION_VELOCITY: 85, ETHICS_PRESSURE: 60 } },
        { code: 'C', text: 'Assign the individual to an isolated low-stress task in the secure comms room.', scores: { ADAPTABILITY: 85, SYSTEMIC_THINKING: 80, CONFLICT_RESOLUTION: 75 } },
        { code: 'D', text: 'Relinquish command temporarily to a senior peer to de-bias team friction.', scores: { EMOTIONAL_AGILITY: 40, CRISIS_COMMAND: 20, STRATEGIC_RESILIENCE: 50 } },
      ],
    },
  ];

  for (const s of scenariosList) {
    const sc = await prisma.scenario.create({
      data: {
        packageId: activePkg.id,
        sequenceOrder: s.seq,
        narrativeText: s.text,
        timeLimitSec: s.timeLimit,
      },
    });

    for (const opt of s.options) {
      const optionCreated = await prisma.scenarioOption.create({
        data: {
          scenarioId: sc.id,
          optionCode: opt.code,
          optionText: opt.text,
        },
      });

      for (const [dimCode, scoreVal] of Object.entries(opt.scores)) {
        if (dimensionMap[dimCode]) {
          await prisma.optionScore.create({
            data: {
              optionId: optionCreated.id,
              dimensionId: dimensionMap[dimCode],
              weightScore: scoreVal as number,
            },
          });
        }
      }
    }
  }
  console.log(`Created ${scenariosList.length} scenarios for primary package.`);

  // 4. Create Sample Demo User & Assessment Session (Module C & A Demo Data)
  const demoUser = await prisma.user.create({
    data: {
      name: 'Alex Mercer',
      email: 'alex.mercer@apex-executive.com',
      targetRole: 'Chief Risk Officer & Crisis Commander',
      hobbiesSkills: 'System Dynamics, Chess Grandmaster, Alpine Wilderness Rescue',
      resumeFileUrl: '/uploads/resumes/alex_mercer_cv.pdf',
      resumeUploadedAt: new Date(),
    },
  });

  const demoSession = await prisma.assessmentSession.create({
    data: {
      userId: demoUser.id,
      packageId: activePkg.id,
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(Date.now() - 600000),
      currentScenarioIdx: 5,
    },
  });

  // Add Final Scores for Demo Session
  const sampleScores: Record<string, number> = {
    RISK_TOLERANCE: 88,
    DECISION_VELOCITY: 92,
    EMOTIONAL_AGILITY: 84,
    STRATEGIC_RESILIENCE: 79,
    SYSTEMIC_THINKING: 86,
    CONFLICT_RESOLUTION: 81,
    ADAPTABILITY: 90,
    CRISIS_COMMAND: 94,
    COGNITIVE_LOAD: 87,
    ETHICS_PRESSURE: 83,
    ANALYTICAL_PRECISION: 89,
  };

  for (const [code, val] of Object.entries(sampleScores)) {
    if (dimensionMap[code]) {
      await prisma.finalScore.create({
        data: {
          sessionId: demoSession.id,
          dimensionId: dimensionMap[code],
          finalScore: val,
          percentileRank: Math.min(99, Math.round(val * 0.98)),
        },
      });
    }
  }

  // Add Biometric Telemetry Readings (Module D Sample Data)
  const startTime = Date.now() - 3600000;
  const bpmPattern = [72, 74, 73, 76, 98, 112, 108, 85, 79, 82, 124, 118, 92, 78, 80];
  for (let i = 0; i < bpmPattern.length; i++) {
    await prisma.biometricReading.create({
      data: {
        sessionId: demoSession.id,
        bpm: bpmPattern[i],
        recordedAt: BigInt(startTime + i * 120000),
        deviceId: 'BLE-HRM-9482',
      },
    });
  }

  console.log(`Created sample candidate demo session (${demoSession.id}) for Alex Mercer.`);
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
