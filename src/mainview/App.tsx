import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { SuggestionJobWatcher } from "@/components/SuggestionJobWatcher";

import { queryClient } from "./lib/query-client";
import { routeTree } from "./routeTree.gen";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

export default function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<SuggestionJobWatcher />
			<div className="h-screen w-full overflow-hidden">
				<RouterProvider router={router} />
			</div>
			<ReactQueryDevtools />
		</QueryClientProvider>
	);
}
