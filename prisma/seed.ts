import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  console.log('Seeding Mianx.ai V3...')
  const id = (s: string) => s  // alias for clarity

  const profile = await db.profile.create({ data: { id: 'demo_user_001', email: 'demo@mianx.ai', displayName: 'Alex Chen' } })
  console.log('✓ Profile')

  const org = await db.organization.create({ data: { name: 'Demo Organization', slug: 'demo-org' } })
  console.log('✓ Organization')

  const membership = await db.organizationMembership.create({ data: { organizationId: org.id, userId: profile.id, status: 'active' } })
  console.log('✓ Membership')

  const permKeys = ['org:view','org:manage','agent:view','agent:create','agent:run','mission:view','mission:create','mission:execute','workflow:view','workflow:create','workflow:run','billing:view','integration:view','approval:view','approval:decide','audit:view']
  const perms = []
  for (const key of permKeys) { perms.push(await db.permission.create({ data: { key, description: key } })) }
  console.log(`✓ Permissions: ${perms.length}`)

  const role = await db.role.create({ data: { name: 'Owner', slug: 'owner', isSystem: true, organizationId: org.id } })
  for (const p of perms) { await db.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } }) }
  await db.membershipRole.create({ data: { membershipId: membership.id, roleId: role.id } })
  console.log('✓ Role + Permissions')

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

  const missions = [
    { title: 'Analyze Q3 Revenue', goal: 'Analyze Q3 revenue and identify growth opportunities', status: 'completed' as const, budget: 50, actual: 12.5, criteria: ['Revenue report','Growth identified','Recommendations'] },
    { title: 'Launch Marketing Campaign', goal: 'Create and execute marketing campaign', status: 'executing' as const, budget: 200, actual: 87.3, criteria: ['Assets created','Channels set','Campaign live','Tracking active'] },
    { title: 'Security Audit', goal: 'Perform security audit of production systems', status: 'planning' as const, budget: 150, actual: 0, criteria: ['Vulnerability scan','Report generated','Issues fixed'] },
  ]

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
    const doneCount = m.status === 'completed' ? m.criteria.length : m.status === 'executing' ? m.criteria.length - 2 : 0
    const runningCount = m.status === 'executing' ? 1 : 0
    for (let i = 0; i < m.criteria.length; i++) {
      const ts = i < doneCount ? 'completed' as const : i < doneCount + runningCount ? 'running' as const : 'planned' as const
      await db.missionTask.create({
        data: {
          missionId: mission.id, title: m.criteria[i], status: ts,
          agentId: createdAgents[i % createdAgents.length].id,
          dependencies: JSON.stringify([]),
          output: ts === 'completed' ? JSON.stringify({ result: `Done: ${m.criteria[i]}` }) : JSON.stringify({}),
          startedAt: ts !== 'planned' ? new Date(Date.now() - (m.criteria.length - i) * 3600000) : null,
          completedAt: ts === 'completed' ? new Date(Date.now() - (m.criteria.length - i - 1) * 3600000) : null,
        },
      })
    }
  }
  console.log('✓ Missions + Tasks')

  await db.workflow.create({
    data: { organizationId: org.id, name: 'Daily Report', slug: 'daily-report', status: 'active', triggerType: 'schedule', definition: JSON.stringify({ steps: [{ id: 's1', name: 'Gather data' }, { id: 's2', name: 'Generate report' }, { id: 's3', name: 'Notify' }] }) },
  })
  console.log('✓ Workflow')

  await db.integration.create({ data: { organizationId: org.id, provider: 'slack', name: 'Slack', status: 'connected', configuration: JSON.stringify({ channel: '#general' }) } })
  console.log('✓ Integration')

  await db.autonomyPolicy.create({ data: { organizationId: org.id, level: 'balanced', config: JSON.stringify({ lowRisk: 'auto', highRisk: 'approval' }) } })
  console.log('✓ Autonomy Policy')

  for (const key of ['ai.tokens','ai.runs','api.requests','missions.created','workflows.runs']) {
    await db.usageMeter.create({ data: { key, name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), unit: key.includes('tokens') ? 'tokens' : 'count' } })
  }
  console.log('✓ Usage Meters')

  const plan = await db.plan.create({ data: { name: 'Growth', billingModel: 'subscription' } })
  const pv = await db.planVersion.create({ data: { planId: plan.id, version: '1.0', includedFeatures: JSON.stringify({ missions: true, agents: 10 }), limits: JSON.stringify({ agents: 10 }), usageAllowances: JSON.stringify({ aiTokens: 1000000 }), aiAllowance: JSON.stringify({ monthlyTokens: 1000000 }) } })
  await db.subscription.create({ data: { organizationId: org.id, planVersionId: pv.id, status: 'active', currentPeriodStart: new Date(Date.now() - 30*86400000), currentPeriodEnd: new Date(Date.now() + 30*86400000) } })
  console.log('✓ Billing')

  const eventTypes = ['mission.created','task.completed','agent.executed','approval.approved']
  for (let i = 0; i < 8; i++) {
    await db.event.create({ data: { eventType: eventTypes[i % eventTypes.length], eventVersion: '1.0', organizationId: org.id, actorType: i%2===0 ? 'ai_agent' : 'human', actorId: i%2===0 ? createdAgents[0].id : profile.id, correlationId: `corr_${i}`, payload: JSON.stringify({ msg: `Event ${i+1}` }), occurredAt: new Date(Date.now() - i * 3600000) } })
  }
  console.log('✓ Events')

  console.log('\n✅ Mianx.ai V3 seeded successfully!')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
