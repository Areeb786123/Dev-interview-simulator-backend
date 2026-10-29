export type TechCategory =
  | 'client'
  | 'compute'
  | 'load_balancing'
  | 'relational'
  | 'document'
  | 'cache'
  | 'queue'
  | 'blob'
  | 'cdn'
  | 'realtime'

export type TechnologyMeta = {
  id: string
  name: string
  category: TechCategory
  primaryPurpose: string
  strengths: string[]
  weaknesses: string[]
  typicalUseCases: string[]
  scalingNotes: string
  consistencyNotes?: string
  operationalNotes: string
  alternatives: string[]
  /** Short coach line for interview prompts */
  interviewHint: string
}

/** Configurable tech metadata — not every option fits every level. */
export const TECHNOLOGY_CATALOG: TechnologyMeta[] = [
  {
    id: 'postgres',
    name: 'PostgreSQL',
    category: 'relational',
    primaryPurpose: 'Durable relational storage with SQL, joins, and transactions.',
    strengths: ['ACID', 'joins', 'constraints', 'mature indexing', 'read replicas'],
    weaknesses: ['Harder naive horizontal write scale', 'schema migrations'],
    typicalUseCases: ['users', 'posts', 'orders', 'account relationships'],
    scalingNotes:
      'Vertical scale first; replicas for reads; partitioning/sharding adds ops cost.',
    consistencyNotes: 'Strong consistency for transactional writes.',
    operationalNotes: 'Connection pooling, backups, migration discipline.',
    alternatives: ['MySQL', 'MongoDB', 'DynamoDB'],
    interviewHint:
      'Ask why relational constraints/joins beat a document model for this access pattern.',
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    category: 'document',
    primaryPurpose: 'Document-oriented storage with flexible schemas.',
    strengths: ['Flexible documents', 'embedding', 'horizontal sharding story'],
    weaknesses: ['Join-like work is harder', 'duplication trade-offs'],
    typicalUseCases: ['varying document shapes', 'content blobs with metadata'],
    scalingNotes: 'Replica sets + sharding; design for access patterns.',
    consistencyNotes: 'Tunable; not a free substitute for relational integrity.',
    operationalNotes: 'Index carefully; watch document growth and hot partitions.',
    alternatives: ['PostgreSQL', 'DynamoDB', 'Cassandra'],
    interviewHint:
      'Ask which access pattern makes documents better than tables — not “lots of users”.',
  },
  {
    id: 'redis',
    name: 'Redis',
    category: 'cache',
    primaryPurpose:
      'In-memory data structures for cache, counters, sessions, rate limits.',
    strengths: ['Ultra-low latency', 'cheap hot-path offload'],
    weaknesses: [
      'Not default durable SoT',
      'invalidation complexity',
      'memory limits',
    ],
    typicalUseCases: ['cache-aside', 'TTL sessions', 'rate limiting', 'ephemeral counters'],
    scalingNotes: 'Memory-bound; clustering/eviction policies matter.',
    consistencyNotes: 'Stale cache vs source of truth must be designed.',
    operationalNotes: 'TTL, eviction, failover; never sole durable progress store.',
    alternatives: ['Memcached', 'application memory', 'DB indexes'],
    interviewHint:
      'Ask which expensive query Redis replaces, cache-miss behavior, and staleness.',
  },
  {
    id: 'server',
    name: 'Application Server',
    category: 'compute',
    primaryPurpose: 'Run API and business logic.',
    strengths: ['Central place for rules', 'easy to reason about'],
    weaknesses: ['Single instance saturates', 'stateful design hurts scale-out'],
    typicalUseCases: ['HTTP APIs', 'auth', 'orchestration'],
    scalingNotes:
      'Vertical (bigger box) vs horizontal (more instances + LB). Profile first.',
    operationalNotes: 'Keep servers mostly stateless for horizontal scale.',
    alternatives: ['Serverless functions', 'more workers'],
    interviewHint:
      'Ask vertical vs horizontal vs optimize-code when CPU is high — justify choice.',
  },
  {
    id: 'load-balancer',
    name: 'Load Balancer',
    category: 'load_balancing',
    primaryPurpose: 'Distribute traffic across app instances.',
    strengths: ['Enables horizontal scale', 'health checks'],
    weaknesses: ['Extra hop', 'needs healthy backends'],
    typicalUseCases: ['multi-instance APIs'],
    scalingNotes: 'Pair with stateless app tier.',
    operationalNotes: 'TLS termination, health probes, sticky sessions if unavoidable.',
    alternatives: ['DNS round-robin', 'service mesh'],
    interviewHint: 'Ask how instances stay healthy and whether sticky sessions are needed.',
  },
]

export function catalogPromptSnippet(): string {
  return TECHNOLOGY_CATALOG.map(
    (t) =>
      `- ${t.name} (${t.category}): ${t.primaryPurpose} Hint: ${t.interviewHint}`,
  ).join('\n')
}
