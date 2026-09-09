import { useRouterState } from "@tanstack/react-router";

export function useCurrentAccountId(): string | null {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const match = pathname.match(/\/account\/([^/]+)/);
	return match ? decodeURIComponent(match[1]) : null;
}
