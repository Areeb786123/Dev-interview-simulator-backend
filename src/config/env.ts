import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'

loadDotenv()

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_MODEL: z.string().min(1).default('openai/gpt-oss-20b'),
  GROQ_MAX_COMPLETION_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .max(8000)
    .default(1600),
  DATABASE_URL: z.string().optional().default(''),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  MAX_EVALUATE_ATTEMPTS: z.coerce.number().int().positive().default(8),
  MAX_ANSWER_ATTEMPTS: z.coerce.number().int().positive().default(6),
  GROQ_TIMEOUT_MS: z.coerce.number().int().positive().default(25_000),
  GROQ_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
})

export type AppEnv = z.infer<typeof EnvSchema> & {
  groqConfigured: boolean
  databaseConfigured: boolean
}

export function loadEnv(
  raw: NodeJS.ProcessEnv = process.env,
): AppEnv {
  const parsed = EnvSchema.safeParse(raw)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration: ${detail}`)
  }

  const data = parsed.data
  const groqConfigured =
    typeof data.GROQ_API_KEY === 'string' &&
    data.GROQ_API_KEY.length > 0 &&
    data.GROQ_API_KEY !== 'your_new_groq_api_key'

  const databaseConfigured =
    typeof data.DATABASE_URL === 'string' && data.DATABASE_URL.length > 0

  // Common Vercel typo: "penai/..." instead of "openai/..."
  const GROQ_MODEL =
    data.GROQ_MODEL === 'penai/gpt-oss-20b'
      ? 'openai/gpt-oss-20b'
      : data.GROQ_MODEL

  return {
    ...data,
    GROQ_MODEL,
    groqConfigured,
    databaseConfigured,
  }
}
