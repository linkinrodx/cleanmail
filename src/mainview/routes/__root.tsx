import { createRootRoute, Outlet } from "@tanstack/react-router";
import { MailboxSidebar } from "@/components/MailboxSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActionsContextProvider } from "@/contexts/ActionsContext";
import { ApplyActionContextProvider } from "@/contexts/ApplyActionContext";
import { DragContextProvider } from "@/contexts/DragContext";

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
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
