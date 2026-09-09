import { useMutation } from "@tanstack/react-query";
import { beginOAuth } from "@/lib/rpc";

export function useBeginOAuth() {
	return useMutation({
		mutationFn: beginOAuth,
	});
}
