import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().trim().min(1, 'setup.validation.required').max(80),
  email: z.string().trim().email('account.invalidEmail'),
  password: z.string().min(8, 'account.passwordTooShort').max(72),
});
export type RegisterValues = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().email('account.invalidEmail'),
  password: z.string().min(1, 'setup.validation.required'),
});
export type LoginValues = z.infer<typeof LoginSchema>;
