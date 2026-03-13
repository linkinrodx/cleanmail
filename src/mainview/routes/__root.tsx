import { createRootRoute, Outlet } from "@tanstack/react-router";
import { createContext, useContext, useState } from "react";
import { MailboxSidebar } from "@/components/MailboxSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

type MailboxContextValue = {
	activeMailboxPath: string;
	setActiveMailboxPath: (path: string) => void;
};

export const MailboxContext = createContext<MailboxContextValue>({
	activeMailboxPath: "INBOX",
	setActiveMailboxPath: () => {},
});

export function useMailboxContext() {
	return useContext(MailboxContext);
}

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	const [activeMailboxPath, setActiveMailboxPath] = useState("INBOX");

	return (
		<TooltipProvider>
			<MailboxContext value={{ activeMailboxPath, setActiveMailboxPath }}>
				<SidebarProvider>
					<MailboxSidebar
						activeMailboxPath={activeMailboxPath}
						onSelectMailbox={setActiveMailboxPath}
					/>
					<SidebarInset>
						<Outlet />
					</SidebarInset>
				</SidebarProvider>
			</MailboxContext>
		</TooltipProvider>
	);
}
