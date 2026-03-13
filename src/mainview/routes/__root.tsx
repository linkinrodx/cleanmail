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

export type MoveAction = {
	type: "move";
	/** IMAP UID of the email that was acted on */
	uid: number;
	/** Author email address extracted from the "from" field */
	authorEmail: string;
	fromMailboxPath: string;
	toMailboxPath: string;
};

export type DeleteAction = {
	type: "delete";
	uid: number;
	authorEmail: string;
	mailboxPath: string;
};

export type EmailAction = MoveAction | DeleteAction;

type ActionsContextValue = {
	actions: EmailAction[];
	addAction: (action: EmailAction) => void;
};

export const ActionsContext = createContext<ActionsContextValue>({
	actions: [],
	addAction: () => {},
});

export function useActionsContext() {
	return useContext(ActionsContext);
}

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	const [activeMailboxPath, setActiveMailboxPath] = useState("INBOX");
	const [draggingUid, setDraggingUid] = useState<number | null>(null);
	const dropHandlerRef = useRef<(toMailboxPath: string) => void>(() => {});

	const [actions, setActions] = useState<EmailAction[]>([]);

	function addAction(action: EmailAction) {
		setActions((prev) => {
			// Deduplicate: same type + same uid + same paths = same action
			const isDuplicate = prev.some((a) => {
				if (a.type !== action.type) return false;
				if (a.type === "move" && action.type === "move") {
					return (
						a.uid === action.uid &&
						a.fromMailboxPath === action.fromMailboxPath &&
						a.toMailboxPath === action.toMailboxPath
					);
				}
				if (a.type === "delete" && action.type === "delete") {
					return a.uid === action.uid && a.mailboxPath === action.mailboxPath;
				}
				return false;
			});
			if (isDuplicate) return prev;
			return [...prev, action];
		});
	}

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
					<ActionsContext value={{ actions, addAction }}>
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
					</ActionsContext>
				</DragContext>
			</MailboxContext>
		</TooltipProvider>
	);
}
