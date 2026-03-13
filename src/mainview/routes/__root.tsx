import { createRootRoute, Outlet } from "@tanstack/react-router";
import { createContext, useContext, useRef, useState } from "react";
import { MailboxSidebar } from "@/components/MailboxSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useActions, useAddAction } from "@/lib/queries/actions";
import type { PersistedAction } from "../../shared/rpc-types";

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

/** Convert a local EmailAction to the persisted format with a timestamp. */
function toPersistedAction(action: EmailAction): PersistedAction {
	if (action.type === "move") {
		return {
			action: "MOVE",
			createdAt: new Date().toISOString(),
			data: {
				uid: action.uid,
				authorEmail: action.authorEmail,
				fromMailboxPath: action.fromMailboxPath,
				toMailboxPath: action.toMailboxPath,
			},
		};
	}
	return {
		action: "DELETE",
		createdAt: new Date().toISOString(),
		data: {
			uid: action.uid,
			authorEmail: action.authorEmail,
			mailboxPath: action.mailboxPath,
		},
	};
}

/** Convert a persisted action back to the local EmailAction shape. */
export function fromPersistedAction(persisted: PersistedAction): EmailAction {
	if (persisted.action === "MOVE") {
		return {
			type: "move",
			uid: persisted.data.uid,
			authorEmail: persisted.data.authorEmail,
			fromMailboxPath: persisted.data.fromMailboxPath,
			toMailboxPath: persisted.data.toMailboxPath,
		};
	}
	return {
		type: "delete",
		uid: persisted.data.uid,
		authorEmail: persisted.data.authorEmail,
		mailboxPath: persisted.data.mailboxPath,
	};
}

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

	const { data: persistedActions = [] } = useActions();
	const { mutate: persistAddAction } = useAddAction();

	// Map persisted actions (sorted DESC by createdAt from the query) to
	// the legacy EmailAction shape consumed by existing route components.
	const actions: EmailAction[] = persistedActions.map(fromPersistedAction);

	function addAction(action: EmailAction) {
		persistAddAction(toPersistedAction(action));
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
