import OpenAI from 'openai';
import type {
  ExtractionInput,
  ExtractionResponse,
  NewField,
  SchemaSuggestion,
} from '../types/extraction';
import type { UserRule } from '../types/userRules';

// ─────────────────────────────────────────────────────────────
// SECURITY WARNING
// EXPO_PUBLIC_ variables are embedded in the compiled client
// bundle and are visible to end users. This is acceptable for
// a Phase 1 prototype, but the OpenAI call MUST be moved to a
// Supabase Edge Function before shipping to production so that
// the API key stays server-side.
// ─────────────────────────────────────────────────────────────
const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

if (!openaiApiKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_OPENAI_API_KEY.\n' +
      'Copy .env.example to .env and add your OpenAI API key.'
  );
}

// dangerouslyAllowBrowser is required because the OpenAI SDK detects
// non-Node environments (including React Native) and rejects instantiation
// unless this flag is set explicitly.
const openai = new OpenAI({
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true,
});

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────
const EXTRACTION_SYSTEM_PROMPT = `You are a data extraction engine.

Input:
- [User Speech]: A raw voice transcript from the user.
- [Current User Schema]: A JSON array of rule objects. Each object has:
    "key"            – snake_case field name
    "type"           – one of: "number", "category", "text", "boolean"
    "allowed_values" – array of strings (only when type is "category"), otherwise null
    "required"       – whether this field must be present
    "description"    – optional human-readable description

Your task is to analyze the speech against the schema and output a single valid JSON object with exactly these five keys:

1. "extracted_data"
   An object of key-value pairs for every schema field mentioned in the speech.
   Values must conform to the field's declared type:
     number   → JSON number
     boolean  → true or false
     category → the closest matching allowed_value (normalize casing/spacing)
     text     → string
   Omit fields that were not mentioned.

2. "missing_fields"
   An array of schema field keys that were NOT mentioned in the speech.
   Always include required fields that are absent.

3. "new_fields"
   An array of objects for fields detected in speech that do NOT exist in the schema.
   Each object must contain:
     "key"       – inferred snake_case field name
     "value"     – type-coerced value
     "raw_value" – verbatim text from the transcript

4. "follow_up_prompt"
   A single, conversational question prompting the user for the most important
   missing required field(s). Return an empty string "" if nothing is missing.

5. "schema_suggestion"
   An array of objects for each item in new_fields, suggesting how to integrate
   the field into the schema. Each object must contain:
     "key"                     – matches the new_field key
     "suggested_type"          – one of: "number", "category", "text", "boolean"
     "suggested_allowed_values" – array of strings if category, otherwise null
     "description"             – brief description of what this field represents
   Return an empty array [] when new_fields is empty.

Respond ONLY with a valid JSON object. Do not include markdown code fences,
explanations, or any text outside the JSON object.`;

// ─────────────────────────────────────────────────────────────
// SCHEMA SERIALIZER
// Strips implementation-detail columns (id, user_id, timestamps)
// before sending to the LLM to avoid wasting tokens.
// ─────────────────────────────────────────────────────────────
function serializeSchema(rules: UserRule[]): string {
  const compact = rules.map(({ key, type, allowed_values, required, description }) => ({
    key,
    type,
    allowed_values,
    required,
    description,
  }));
  return JSON.stringify(compact, null, 2);
}

// ─────────────────────────────────────────────────────────────
// RUNTIME RESPONSE VALIDATOR
// JSON mode guarantees syntactically valid JSON but NOT structural
// correctness. This validator catches shape mismatches before the
// TypeScript cast so callers get a clear error instead of a
// silent undefined-property bug.
// ─────────────────────────────────────────────────────────────
function validateExtractionResponse(raw: unknown): raw is ExtractionResponse {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;

  if (typeof r['extracted_data'] !== 'object' || r['extracted_data'] === null) return false;
  if (!Array.isArray(r['missing_fields'])) return false;
  if (!Array.isArray(r['new_fields'])) return false;
  if (typeof r['follow_up_prompt'] !== 'string') return false;
  if (!Array.isArray(r['schema_suggestion'])) return false;

  for (const field of r['new_fields'] as unknown[]) {
    if (typeof field !== 'object' || field === null) return false;
    const f = field as Record<string, unknown>;
    if (typeof f['key'] !== 'string') return false;
    if (typeof f['raw_value'] !== 'string') return false;
  }

  const validTypes = new Set(['number', 'category', 'text', 'boolean']);
  for (const suggestion of r['schema_suggestion'] as unknown[]) {
    if (typeof suggestion !== 'object' || suggestion === null) return false;
    const s = suggestion as Record<string, unknown>;
    if (typeof s['key'] !== 'string') return false;
    if (!validTypes.has(s['suggested_type'] as string)) return false;
    if (typeof s['description'] !== 'string') return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// CUSTOM ERROR CLASS
// Allows callers to distinguish extraction failures from other
// errors using `instanceof ExtractionError`.
// ─────────────────────────────────────────────────────────────
export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN EXTRACTION FUNCTION
// ─────────────────────────────────────────────────────────────

/**
 * Calls GPT-4o with the user's voice transcript and their current schema rules.
 * Returns a validated ExtractionResponse containing extracted data, missing
 * fields, new field detections, a follow-up question, and schema suggestions.
 *
 * @throws {ExtractionError} when the API call fails, returns empty output,
 *   produces unparseable JSON, or the response shape doesn't match the contract.
 */
export async function extractFromTranscript(
  input: ExtractionInput
): Promise<ExtractionResponse> {
  const { transcript, userRules } = input;

  if (!transcript.trim()) {
    throw new ExtractionError('Transcript is empty — nothing to extract.');
  }

  const userPrompt = [
    '[User Speech]',
    transcript,
    '',
    '[Current User Schema]',
    serializeSchema(userRules),
  ].join('\n');

  let rawContent: string | null;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      // json_object mode guarantees syntactically valid JSON output.
      // The word "JSON" in the system prompt is required by the API when
      // using this response format.
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      // Low temperature for deterministic structured extraction.
      temperature: 0.1,
      max_tokens: 1024,
    });

    rawContent = completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    throw new ExtractionError('OpenAI API call failed during extraction.', err);
  }

  if (!rawContent) {
    throw new ExtractionError('OpenAI returned an empty response.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new ExtractionError(
      `Failed to parse OpenAI response as JSON. Raw: ${rawContent.slice(0, 200)}`,
      err
    );
  }

  if (!validateExtractionResponse(parsed)) {
    throw new ExtractionError(
      `OpenAI response did not match the ExtractionResponse shape. ` +
        `Received: ${JSON.stringify(parsed).slice(0, 300)}`
    );
  }

  return parsed;
}
