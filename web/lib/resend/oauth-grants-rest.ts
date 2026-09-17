import type { Resend } from "resend";
import type { ListOAuthGrantsOptions } from "resend";

export const getOAuthGrants = async (resend: Resend, options?: ListOAuthGrantsOptions) => {
  try {
    const { data, error } = await resend.oauthGrants.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const revokeOAuthGrant = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.oauthGrants.revoke(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
