import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

// Permission keys — must match src/lib/authorization.ts Permissions object
const ALL_PERMISSION_KEYS = [
  // Organization (6)
  'org:view',
  'org:manage',
  'org:delete',
  'org:settings',
  'org:billing',
  'org:members:manage',
  // Agents (5)
  'agent:view',
  'agent:create',
  'agent:update',
  'agent:delete',
  'agent:run',
  // Missions (6)
  'mission:view',
  'mission:create',
  'mission:update',
  'mission:delete',
  'mission:execute',
  'mission:approve',
  // Workflows (5)
  'workflow:view',
  'workflow:create',
  'workflow:update',
  'workflow:delete',
  'workflow:run',
  // Domains (2)
  'domain:view',
  'domain:manage',
  // Integrations (2)
  'integration:view',
  'integration:manage',
  // Audit (1)
  'audit:view',
  // Approvals (2)
  'approval:view',
  'approval:decide',
  // Billing (2)
  'billing:view',
  'billing:manage',
] as const // 31 total

// Role definitions — must match src/lib/authorization.ts DefaultRoles
const ROLE_DEFINITIONS = [
  {
    name: 'Owner',
    slug: 'owner',
    description: 'Full access to all organization resources',
    // Owner gets ALL permissions
    permissionKeys: [...ALL_PERMISSION_KEYS],
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'Administrative access to manage most resources',
    permissionKeys: [
      'org:view', 'org:manage', 'org:settings', 'org:members:manage',
      'agent:view', 'agent:create', 'agent:update', 'agent:delete', 'agent:run',
      'mission:view', 'mission:create', 'mission:update', 'mission:execute',
      'workflow:view', 'workflow:create', 'workflow:update', 'workflow:run',
      'domain:view', 'domain:manage',
      'integration:view', 'integration:manage',
      'audit:view',
      'approval:view', 'approval:decide',
      'billing:view',
    ],
  },
  {
    name: 'Member',
    slug: 'member',
    description: 'Standard member with view and create access',
    permissionKeys: [
      'org:view',
      'agent:view', 'agent:create', 'agent:run',
      'mission:view', 'mission:create', 'mission:update', 'mission:execute',
      'workflow:view', 'workflow:run',
      'domain:view',
      'integration:view',
      'approval:view',
      'billing:view',
    ],
  },
  {
    name: 'Viewer',
    slug: 'viewer',
    description: 'Read-only access to organization resources',
    permissionKeys: [
      'org:view',
      'agent:view',
      'mission:view',
      'workflow:view',
      'domain:view',
      'integration:view',
      'audit:view',
      'approval:view',
      'billing:view',
    ],
  },
  {
    name: 'Billing Manager',
    slug: 'billing',
    description: 'Access to billing and subscription management',
    permissionKeys: [
      'org:view',
      'billing:view', 'billing:manage',
      'approval:view',
    ],
  },
]

async function main() {
  console.log('Seeding Mianx.ai V3...')
  const id = (s: string) => s  // alias for clarity

  // ── Profile & Organization ─────────────────────────────
  const profile = await db.profile.create({ data: { id: 'demo_user_001', email: 'demo@mianx.ai', displayName: 'Alex Chen' } })
  console.log('✓ Profile')

  const org = await db.organization.create({ data: { name: 'Demo Organization', slug: 'demo-org' } })
  console.log('✓ Organization')

  const membership = await db.organizationMembership.create({ data: { organizationId: org.id, userId: profile.id, status: 'active' } })
  console.log('✓ Membership')

  // ── Permissions (all 31) ───────────────────────────────
  const permMap = new Map<string, string>()
  for (const key of ALL_PERMISSION_KEYS) {
    const perm = await db.permission.create({ data: { key, description: key } })
    permMap.set(key, perm.id)
  }
  console.log(`✓ Permissions: ${permMap.size}`)

  // ── Roles (all 5) ──────────────────────────────────────
  const roleMap = new Map<string, string>()
  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await db.role.create({
      data: {
        name: roleDef.name,
        slug: roleDef.slug,
        description: roleDef.description,
        isSystem: true,
        organizationId: org.id,
      },
    })
    roleMap.set(roleDef.slug, role.id)
    for (const pKey of roleDef.permissionKeys) {
      const permId = permMap.get(pKey)!
      await db.rolePermission.create({ data: { roleId: role.id, permissionId: permId } })
    }
  }
  console.log(`✓ Roles: ${roleMap.size}`)

  // ── Assign Owner role to demo user ─────────────────────
  await db.membershipRole.create({ data: { membershipId: membership.id, roleId: roleMap.get('owner')! } })
  console.log('✓ Owner role assigned')

  // ── Agents ─────────────────────────────────────────────
  const agents = [
    { name: 'Atlas', slug: 'atlas', type: 'analyst', caps: ['data_analysis','reporting','visualization'], desc: 'Strategic analysis agent' },
    { name: 'Nova', slug: 'nova', type: 'automation', caps: ['workflow_execution','task_automation'], desc: 'Workflow automation agent' },
    { name: 'Sentinel', slug: 'sentinel', type: 'specialist', caps: ['security_scan','compliance_check'], desc: 'Security agent' },
    { name: 'Forge', slug: 'forge', type: 'specialist', caps: ['code_generation','code_review'], desc: 'Development agent' },
  ]
  const createdAgents = []
  for (const a of agents) {
    createdAgents.push(await db.agent.create({
      data: { organizationId: org.id, name: a.name, slug: a.slug, type: a.type, description: a.desc, status: 'active', capabilities: JSON.stringify(a.caps), configuration: JSON.stringify({ model: 'gpt-4o' }), successMetrics: JSON.stringify({ completed: 0 }) },
    }))
  }
  console.log(`✓ Agents: ${createdAgents.length}`)

  // ── Missions & Tasks ───────────────────────────────────
  const missions = [
    { title: 'Analyze Q3 Revenue', goal: 'Analyze Q3 revenue and identify growth opportunities', status: 'completed' as const, budget: 50, actual: 12.5, criteria: ['Revenue report','Growth identified','Recommendations'] },
    { title: 'Launch Marketing Campaign', goal: 'Create and execute marketing campaign', status: 'executing' as const, budget: 200, actual: 87.3, criteria: ['Assets created','Channels set','Campaign live','Tracking active'] },
    { title: 'Security Audit', goal: 'Perform security audit of production systems', status: 'planning' as const, budget: 150, actual: 0, criteria: ['Vulnerability scan','Report generated','Issues fixed'] },
  ]

  const missionIds: string[] = []
  const completedTaskIds: string[] = []

  for (const m of missions) {
    const mission = await db.mission.create({
      data: {
        organizationId: org.id, userId: profile.id, title: m.title, goal: m.goal, status: m.status,
        budget: m.budget, actualCost: m.actual, estimatedCost: m.budget * 0.6,
        successCriteria: JSON.stringify(m.criteria),
        plan: JSON.stringify({ phases: m.criteria.map((c, i) => ({ phase: i+1, objective: c, status: i < m.criteria.length - (m.status==='executing'?2:m.status==='planning'?3:0) ? 'completed' : m.status==='executing' && i === m.criteria.length-2 ? 'running' : 'planned' })) }),
        correlationId: `corr_${Math.random().toString(36).slice(2,10)}`,
      },
    })
    missionIds.push(mission.id)
    const doneCount = m.status === 'completed' ? m.criteria.length : m.status === 'executing' ? m.criteria.length - 2 : 0
    const runningCount = m.status === 'executing' ? 1 : 0
    for (let i = 0; i < m.criteria.length; i++) {
      const ts = i < doneCount ? 'completed' as const : i < doneCount + runningCount ? 'running' as const : 'planned' as const
      const task = await db.missionTask.create({
        data: {
          missionId: mission.id, title: m.criteria[i], status: ts,
          agentId: createdAgents[i % createdAgents.length].id,
          dependencies: JSON.stringify([]),
          output: ts === 'completed' ? JSON.stringify({ result: `Done: ${m.criteria[i]}` }) : JSON.stringify({}),
          startedAt: ts !== 'planned' ? new Date(Date.now() - (m.criteria.length - i) * 3600000) : null,
          completedAt: ts === 'completed' ? new Date(Date.now() - (m.criteria.length - i - 1) * 3600000) : null,
        },
      })
      if (ts === 'completed') completedTaskIds.push(task.id)
    }
  }
  console.log('✓ Missions + Tasks')

  // ── Workflow ───────────────────────────────────────────
  await db.workflow.create({
    data: { organizationId: org.id, name: 'Daily Report', slug: 'daily-report', status: 'active', triggerType: 'schedule', definition: JSON.stringify({ steps: [{ id: 's1', name: 'Gather data' }, { id: 's2', name: 'Generate report' }, { id: 's3', name: 'Notify' }] }) },
  })
  console.log('✓ Workflow')

  // ── Integration ────────────────────────────────────────
  await db.integration.create({ data: { organizationId: org.id, provider: 'slack', name: 'Slack', status: 'connected', configuration: JSON.stringify({ channel: '#general' }) } })
  console.log('✓ Integration')

  // ── Autonomy Policy ────────────────────────────────────
  await db.autonomyPolicy.create({ data: { organizationId: org.id, level: 'balanced', config: JSON.stringify({ lowRisk: 'auto', highRisk: 'approval' }) } })
  console.log('✓ Autonomy Policy')

  // ── Usage Meters ───────────────────────────────────────
  for (const key of ['ai.tokens','ai.runs','api.requests','missions.created','workflows.runs']) {
    await db.usageMeter.create({ data: { key, name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), unit: key.includes('tokens') ? 'tokens' : 'count' } })
  }
  console.log('✓ Usage Meters')

  // ── Billing ────────────────────────────────────────────
  const plan = await db.plan.create({ data: { name: 'Growth', billingModel: 'subscription' } })
  const pv = await db.planVersion.create({ data: { planId: plan.id, version: '1.0', includedFeatures: JSON.stringify({ missions: true, agents: 10 }), limits: JSON.stringify({ agents: 10 }), usageAllowances: JSON.stringify({ aiTokens: 1000000 }), aiAllowance: JSON.stringify({ monthlyTokens: 1000000 }) } })
  await db.subscription.create({ data: { organizationId: org.id, planVersionId: pv.id, status: 'active', currentPeriodStart: new Date(Date.now() - 30*86400000), currentPeriodEnd: new Date(Date.now() + 30*86400000) } })
  console.log('✓ Billing')

  // ── Events ─────────────────────────────────────────────
  const eventTypes = ['mission.created','task.completed','agent.executed','approval.approved']
  for (let i = 0; i < 8; i++) {
    await db.event.create({ data: { eventType: eventTypes[i % eventTypes.length], eventVersion: '1.0', organizationId: org.id, actorType: i%2===0 ? 'ai_agent' : 'human', actorId: i%2===0 ? createdAgents[0].id : profile.id, correlationId: `corr_${i}`, payload: JSON.stringify({ msg: `Event ${i+1}` }), occurredAt: new Date(Date.now() - i * 3600000) } })
  }
  console.log('✓ Events')

  // ── Team + 2 Team Members ──────────────────────────────
  const team = await db.team.create({
    data: { organizationId: org.id, name: 'Core Team', description: 'Primary mission execution team' },
  })
  // Second profile for team diversity
  const profile2 = await db.profile.create({ data: { id: 'demo_user_002', email: 'jordan@mianx.ai', displayName: 'Jordan Park' } })
  const membership2 = await db.organizationMembership.create({ data: { organizationId: org.id, userId: profile2.id, status: 'active' } })
  await db.teamMember.create({ data: { teamId: team.id, membershipId: membership.id } })
  await db.teamMember.create({ data: { teamId: team.id, membershipId: membership2.id } })
  console.log('✓ Team + Members')

  // ── 1 Audit Log Entry ──────────────────────────────────
  await db.auditLog.create({
    data: {
      organizationId: org.id,
      actorType: 'human',
      actorId: profile.id,
      action: 'mission.create',
      resourceType: 'Mission',
      resourceId: missionIds[0],
      metadata: JSON.stringify({ title: 'Analyze Q3 Revenue' }),
      correlationId: `corr_audit_1`,
    },
  })
  console.log('✓ Audit Log')

  // ── 3 Verifications for completed mission tasks ────────
  const verificationTypes = ['test', 'schema_validation', 'build'] as const
  for (let i = 0; i < 3; i++) {
    await db.verification.create({
      data: {
        missionId: missionIds[0],
        missionTaskId: completedTaskIds[i],
        type: verificationTypes[i],
        config: JSON.stringify({ checks: ['basic'] }),
        result: JSON.stringify({ passed: true, details: `Verification ${i+1} passed` }),
        evidence: JSON.stringify([{ type: 'automated', source: `check_${i}` }]),
        passed: true,
        verifiedAt: new Date(Date.now() - (3 - i) * 1800000),
      },
    })
  }
  console.log('✓ Verifications')

  // ── 2 Outcomes for the completed mission ───────────────
  await db.outcome.create({
    data: {
      organizationId: org.id,
      missionId: missionIds[0],
      objective: 'Revenue growth identified',
      baseline: JSON.stringify({ q3Revenue: '$1.2M' }),
      target: JSON.stringify({ growth: '15%' }),
      currentResult: JSON.stringify({ growth: '18.3%' }),
      progress: 1.0,
      confidence: 0.92,
      status: 'achieved',
      evidence: JSON.stringify([{ source: 'report', summary: 'Q3 revenue grew 18.3% YoY' }]),
      verifiedAt: new Date(Date.now() - 7200000),
    },
  })
  await db.outcome.create({
    data: {
      organizationId: org.id,
      missionId: missionIds[0],
      objective: 'Actionable recommendations delivered',
      baseline: JSON.stringify({ recommendations: 0 }),
      target: JSON.stringify({ recommendations: 5 }),
      currentResult: JSON.stringify({ recommendations: 7 }),
      progress: 1.0,
      confidence: 0.87,
      status: 'achieved',
      evidence: JSON.stringify([{ source: 'analysis', summary: '7 strategic recommendations generated' }]),
      verifiedAt: new Date(Date.now() - 5400000),
    },
  })
  console.log('✓ Outcomes')

  // ── 1 Pending Approval ─────────────────────────────────
  await db.workflowApproval.create({
    data: {
      organizationId: org.id,
      missionId: missionIds[1], // executing mission
      requestedAction: JSON.stringify({ action: 'deploy_campaign', target: 'production' }),
      riskLevel: 'high',
      requestedBy: createdAgents[1].id, // Nova
      expiresAt: new Date(Date.now() + 86400000), // 24h from now
    },
  })
  console.log('✓ Pending Approval')

  // ── 1 AI Cost Record ───────────────────────────────────
  await db.aiCostRecord.create({
    data: {
      organizationId: org.id,
      model: 'gpt-4o',
      provider: 'openai',
      inputTokens: 4500,
      outputTokens: 1200,
      totalTokens: 5700,
      estimatedCost: 0.09,
      actualCost: 0.087,
      occurredAt: new Date(Date.now() - 7200000),
    },
  })
  console.log('✓ AI Cost Record')

  // ── 1 Notification ─────────────────────────────────────
  await db.notification.create({
    data: {
      organizationId: org.id,
      recipientUserId: profile.id,
      type: 'mission.completed',
      title: 'Mission Completed',
      body: 'Analyze Q3 Revenue has been completed successfully.',
      data: JSON.stringify({ missionId: missionIds[0] }),
    },
  })
  console.log('✓ Notification')

  console.log(`\n✅ Mianx.ai V3 seeded successfully! (${ALL_PERMISSION_KEYS.length} permissions, ${ROLE_DEFINITIONS.length} roles)`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
