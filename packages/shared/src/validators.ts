import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z.string().email('Podaj poprawny adres e-mail'),
    password: z
      .string()
      .min(8, 'Hasło musi mieć co najmniej 8 znaków')
      .regex(/[A-Z]/, 'Hasło musi zawierać wielką literę')
      .regex(/[a-z]/, 'Hasło musi zawierać małą literę')
      .regex(/[0-9]/, 'Hasło musi zawierać cyfrę'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'Musisz zaakceptować regulamin' })
    }),
    confirmOwnership: z.literal(true, {
      errorMap: () => ({ message: 'Musisz potwierdzić, że to Twój głos' })
    }),
    noImpersonation: z.literal(true, {
      errorMap: () => ({ message: 'Musisz zobowiązać się do niepodszywania się' })
    })
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1, 'Podaj hasło')
  })
  .strict();

export const voiceModelCreateSchema = z
  .object({
    name: z.string().min(3, 'Nazwa modelu jest za krótka'),
    architecture: z.string().default('vits'),
    watermarkEnabled: z.boolean().default(true)
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VoiceModelCreateInput = z.infer<typeof voiceModelCreateSchema>;
