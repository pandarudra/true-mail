import type { Resend } from "resend";
import type {
  CreateDomainOptions,
  CreateDomainRequestOptions,
  UpdateDomainsOptions,
  ClaimDomainOptions,
  ClaimDomainRequestOptions,
} from "resend";

export const getDomains = async (resend: Resend) => {
  try {
    const { data, error } = await resend.domains.list();
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getDomain = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.domains.get(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const createDomain = async (
  resend: Resend,
  payload: CreateDomainOptions,
  options?: CreateDomainRequestOptions
) => {
  try {
    const { data, error } = await resend.domains.create(payload, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateDomain = async (resend: Resend, payload: UpdateDomainsOptions) => {
  try {
    const { data, error } = await resend.domains.update(payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteDomain = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.domains.remove(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const verifyDomain = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.domains.verify(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const createDomainClaim = async (
  resend: Resend,
  payload: ClaimDomainOptions,
  options?: ClaimDomainRequestOptions
) => {
  try {
    const { data, error } = await resend.domains.claims.create(payload, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getDomainClaim = async (resend: Resend, domainId: string) => {
  try {
    const { data, error } = await resend.domains.claims.get(domainId);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const verifyDomainClaim = async (resend: Resend, domainId: string) => {
  try {
    const { data, error } = await resend.domains.claims.verify(domainId);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
