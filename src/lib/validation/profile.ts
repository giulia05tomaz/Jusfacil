import { z } from "zod";

const digits = (value: string) => value.replace(/\D/g, "");

export function isValidCpf(value: string): boolean {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const check = (length: number) => {
    const sum = cpf.slice(0, length).split("").reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return (remainder === 10 ? 0 : remainder) === Number(cpf[length]);
  };
  return check(9) && check(10);
}

export const PhoneSchema = z.string().refine((value) => {
  const phone = digits(value);
  return phone.length === 10 || phone.length === 11;
}, "Telefone inválido");

export const UsernameSchema = z.string().trim().regex(/^@?[a-zA-Z0-9._-]{3,30}$/, "Nome de usuário inválido");
export const CpfSchema = z.string().refine(isValidCpf, "CPF inválido");
export const OabStateSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "UF inválida");
export const OabNumberSchema = z.string().trim().regex(/^[0-9]{1,8}[A-Z]?$/i, "Número de OAB inválido");
