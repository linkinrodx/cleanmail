import { createRootRoute, Outlet } from "@tanstack/react-router";
import { createContext, useContext, useRef, useState } from "react";
import { MailboxSidebar } from "@/components/MailboxSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
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

type DragContextValue = {
	draggingUid: number | null;
	setDraggingUid: (uid: number | null) => void;
	onDropToMailbox: (toMailboxPath: string) => void;
	registerDropHandler: (handler: (toMailboxPath: string) => void) => void;
};

export const DragContext = createContext<DragContextValue>({
	draggingUid: null,
	setDraggingUid: () => {},
	onDropToMailbox: () => {},
	registerDropHandler: () => {},
});

export function useDragContext() {
	return useContext(DragContext);
}

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	const [activeMailboxPath, setActiveMailboxPath] = useState("INBOX");
	const [draggingUid, setDraggingUid] = useState<number | null>(null);
	const dropHandlerRef = useRef<(toMailboxPath: string) => void>(() => {});

	const dragContextValue: DragContextValue = {
		draggingUid,
		setDraggingUid,
		onDropToMailbox: (toMailboxPath) => dropHandlerRef.current(toMailboxPath),
		registerDropHandler: (handler) => {
			dropHandlerRef.current = handler;
		},
	};

	return (
		<TooltipProvider>
			<MailboxContext value={{ activeMailboxPath, setActiveMailboxPath }}>
				<DragContext value={dragContextValue}>
					<SidebarProvider>
						<MailboxSidebar
							activeMailboxPath={activeMailboxPath}
							onSelectMailbox={setActiveMailboxPath}
						/>
						<SidebarInset>
							<Outlet />
						</SidebarInset>
					</SidebarProvider>
					<Toaster />
				</DragContext>
			</MailboxContext>
		</TooltipProvider>
	);
}
