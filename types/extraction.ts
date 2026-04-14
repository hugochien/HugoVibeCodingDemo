import type { FieldType, UserRule } from './userRules';
import type { LogPayload } from './log';

/**
 * A field detected in speech that does NOT exist in the user's current schema.
 */
export interface NewField {
  /** Snake_case key inferred from the speech content. */
  key: string;
  /** Typed value after coercion (number, boolean, string, or null). */
  value: string | number | boolean | null;
  /** Original verbatim text from the transcript before type coercion. */
  raw_value: string;
}

/**
 * Suggested schema entry for a NewField — returned alongside new_fields
 * so the UI can prompt the user to accept/reject schema expansion.
 */
export interface SchemaSuggestion {
  key: string;
  suggested_type: FieldType;
  /**
   * Populated only when suggested_type === 'category'.
   * Contains possible enum values inferred from the conversation context.
   */
  suggested_allowed_values: string[] | null;
  description: string;
}

/**
 * The structured JSON object returned by the LLM extraction call.
 * Parsed from the OpenAI response and runtime-validated before use.
 */
export interface ExtractionResponse {
  /**
   * Key-value pairs for every schema field found in the speech.
   * Values are type-coerced to match the field's declared FieldType.
   */
  extracted_data: LogPayload;
  /**
   * Schema field keys that were NOT mentioned in the speech.
   * Drives the follow-up question logic.
   */
  missing_fields: string[];
  /**
   * Fields detected in speech that have no matching entry in the current schema.
   * If non-empty, schema_suggestion will contain corresponding entries.
   */
  new_fields: NewField[];
  /**
   * A single natural-language question prompting the user for the most important
   * missing required fields. Empty string when nothing is missing.
   */
  follow_up_prompt: string;
  /**
   * Schema change suggestions corresponding to each item in new_fields.
   * Empty array when no new fields were detected.
   */
  schema_suggestion: SchemaSuggestion[];
}

/** Input contract for the extraction service function. */
export interface ExtractionInput {
  /** Raw voice transcript from Whisper (or manual text entry). */
  transcript: string;
  /** The user's current schema rules — used to build the LLM prompt. */
  userRules: UserRule[];
  /** Supabase user ID — used when persisting the resulting log. */
  userId: string;
}
