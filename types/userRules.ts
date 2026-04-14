export type FieldType = 'number' | 'category' | 'text' | 'boolean';

export interface UserRule {
  id: string;
  user_id: string;
  /** Snake_case identifier for this field, e.g. 'pushups', 'mood', 'expense_amount'. */
  key: string;
  type: FieldType;
  /**
   * Only applicable when type === 'category'.
   * Lists the allowed enum values for this field (e.g. ['happy', 'neutral', 'sad']).
   * Null — not an empty array — when type is not 'category'.
   */
  allowed_values: string[] | null;
  /** Whether the extraction engine should flag this field when it is missing from speech. */
  required: boolean;
  description: string | null;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/** Shape used when inserting a new rule (server generates id, created_at, updated_at). */
export type CreateUserRuleInput = Omit<UserRule, 'id' | 'created_at' | 'updated_at'>;

/** Shape used when partially updating an existing rule. */
export type UpdateUserRuleInput = Partial<
  Omit<UserRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>
>;
