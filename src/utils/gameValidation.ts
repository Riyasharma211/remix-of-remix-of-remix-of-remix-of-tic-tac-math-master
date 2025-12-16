import { z } from 'zod';

// Validation schemas for game inputs
export const PlayerNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(30, 'Name too long (max 30 chars)')
  .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Only letters, numbers, spaces, and -_ allowed');

export const RoomCodeSchema = z
  .string()
  .length(4, 'Room code must be 4 characters')
  .regex(/^[A-Z0-9]+$/, 'Invalid room code format');

export const QuestionSchema = z
  .string()
  .trim()
  .min(3, 'Question too short')
  .max(300, 'Question too long (max 300 chars)');

export const AnswerSchema = z
  .string()
  .trim()
  .min(1, 'Answer is required')
  .max(500, 'Answer too long (max 500 chars)');

// Validate and sanitize player name
export const validatePlayerName = (name: string): { success: boolean; value?: string; error?: string } => {
  try {
    const validated = PlayerNameSchema.parse(name);
    return { success: true, value: validated };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.errors[0]?.message || 'Invalid name' };
    }
    return { success: false, error: 'Invalid name' };
  }
};

// Validate room code
export const validateRoomCode = (code: string): { success: boolean; value?: string; error?: string } => {
  try {
    const validated = RoomCodeSchema.parse(code.toUpperCase());
    return { success: true, value: validated };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.errors[0]?.message || 'Invalid code' };
    }
    return { success: false, error: 'Invalid code' };
  }
};

// Validate question/dare
export const validateQuestion = (question: string): { success: boolean; value?: string; error?: string } => {
  try {
    const validated = QuestionSchema.parse(question);
    return { success: true, value: validated };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.errors[0]?.message || 'Invalid question' };
    }
    return { success: false, error: 'Invalid question' };
  }
};

// Validate answer
export const validateAnswer = (answer: string): { success: boolean; value?: string; error?: string } => {
  try {
    const validated = AnswerSchema.parse(answer);
    return { success: true, value: validated };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: e.errors[0]?.message || 'Invalid answer' };
    }
    return { success: false, error: 'Invalid answer' };
  }
};
