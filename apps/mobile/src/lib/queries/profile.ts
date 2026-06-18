import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

export const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Please enter your name").max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ProfileForm = z.infer<typeof profileSchema>;

/** Update the signed-in user's profile — direct RLS-scoped write, in sync with web. */
export function useUpdateProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: ProfileForm) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_profiles")
        .update({
          full_name: values.full_name,
          phone: values.phone || null,
          bio: values.bio || null,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", userId] }),
  });
}
