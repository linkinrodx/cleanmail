import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { toast } from "sonner";
import { MailboxSidebar } from "@/components/MailboxSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActionsContextProvider } from "@/contexts/ActionsContext";
import { ApplyActionContextProvider } from "@/contexts/ApplyActionContext";
import { DragContextProvider } from "@/contexts/DragContext";
import { accountKeys } from "@/lib/query-keys";
import {
	addOAuthCompleteListener,
	removeOAuthCompleteListener,
} from "@/lib/rpc";
import type { OAuthCompleteMessage } from "../../shared/rpc-types";

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	const queryClient = useQueryClient();

	useEffect(() => {
		const listener = (msg: OAuthCompleteMessage) => {
			queryClient.invalidateQueries({ queryKey: accountKeys._def });
			if ("account" in msg) {
				toast.success(`Account ${msg.account.email} connected`);
			} else {
				toast.error(msg.error ?? "Could not connect the account");
			}
		};
		addOAuthCompleteListener(listener);
		return () => removeOAuthCompleteListener(listener);
	}, [queryClient]);

	return (
		<TooltipProvider>
			<DragContextProvider>
				<ActionsContextProvider>
					<ApplyActionContextProvider>
						<SidebarProvider>
							<MailboxSidebar />
							<SidebarInset>
								<Outlet />
							</SidebarInset>
						</SidebarProvider>
						<Toaster />
					</ApplyActionContextProvider>
				</ActionsContextProvider>
			</DragContextProvider>
		</TooltipProvider>
	);
}
