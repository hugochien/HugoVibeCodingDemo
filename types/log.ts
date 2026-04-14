/**
 * The structured JSON payload extracted from a voice transcript.
 * Keys are dynamic — they match UserRule.key values defined by the user.
 */
export type LogPayload = Record<string, string | number | boolean | null>;

export interface Log {
  id: string;
  user_id: string;
  /** JSONB in Postgres — the structured data extracted from the voice transcript. */
  payload: LogPayload;
  /** Raw Whisper transcription text before extraction. */
  raw_transcript: string;
  created_at: string; // ISO 8601
}

/** Shape used when inserting a new log (server generates id, created_at). */
export type CreateLogInput = Omit<Log, 'id' | 'created_at'>;
