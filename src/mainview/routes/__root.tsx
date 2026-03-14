import { createRootRoute, Outlet } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { MailboxSidebar } from "@/components/MailboxSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useActions, useAddAction } from "@/lib/queries/actions";
import { addActionStatusListener, removeActionStatusListener } from "@/lib/rpc";
import type { ActionJobStatus, PersistedAction } from "../../shared/rpc-types";

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
	/** Returns the createdAt timestamp for a given action (used as jobId) */
	getCreatedAt: (action: EmailAction) => string | undefined;
	addAction: (action: EmailAction) => void;
};

export const ActionsContext = createContext<ActionsContextValue>({
	actions: [],
	getCreatedAt: () => undefined,
	addAction: () => {},
});

export function useActionsContext() {
	return useContext(ActionsContext);
}

// ---------------------------------------------------------------------------
// ApplyActionContext — tracks per-job status of "Apply to all" operations
// ---------------------------------------------------------------------------

export type ApplyJobState = {
	status: ActionJobStatus;
	error?: string;
};

type ApplyActionContextValue = {
	jobs: Record<string, ApplyJobState>;
	setJobStatus: (jobId: string, state: ApplyJobState) => void;
};

export const ApplyActionContext = createContext<ApplyActionContextValue>({
	jobs: {},
	setJobStatus: () => {},
});

export function useApplyActionContext() {
	return useContext(ApplyActionContext);
}

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	const [draggingUid, setDraggingUid] = useState<number | null>(null);
	const dropHandlerRef = useRef<(toMailboxPath: string) => void>(() => {});

	const { data: persistedActions = [] } = useActions();
	const { mutate: persistAddAction } = useAddAction();

	// Map persisted actions (sorted DESC by createdAt from the query) to
	// the legacy EmailAction shape consumed by existing route components.
	const actions: EmailAction[] = persistedActions.map(fromPersistedAction);

	/** Returns the createdAt for an action, used as the jobId. */
	function getCreatedAt(action: EmailAction): string | undefined {
		const match = persistedActions.find((p) => {
			if (p.action === "MOVE" && action.type === "move") {
				return (
					p.data.authorEmail === action.authorEmail &&
					p.data.fromMailboxPath === action.fromMailboxPath &&
					p.data.toMailboxPath === action.toMailboxPath
				);
			}
			if (p.action === "DELETE" && action.type === "delete") {
				return (
					p.data.authorEmail === action.authorEmail &&
					p.data.mailboxPath === action.mailboxPath
				);
			}
			return false;
		});
		return match?.createdAt;
	}

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

	// ---- Apply-action job status ----
	const [applyJobs, setApplyJobs] = useState<Record<string, ApplyJobState>>({});

	const applyContextValue: ApplyActionContextValue = {
		jobs: applyJobs,
		setJobStatus: (jobId, state) => {
			setApplyJobs((prev) => ({ ...prev, [jobId]: state }));
		},
	};

	// Subscribe to status updates pushed from the bun process
	useEffect(() => {
		function onUpdate({
			jobId,
			status,
			error,
		}: {
			jobId: string;
			status: ActionJobStatus;
			error?: string;
		}) {
			setApplyJobs((prev) => ({ ...prev, [jobId]: { status, error } }));
		}

		addActionStatusListener(onUpdate);
		return () => removeActionStatusListener(onUpdate);
	}, []);

	return (
		<TooltipProvider>
			<DragContext value={dragContextValue}>
				<ActionsContext value={{ actions, getCreatedAt, addAction }}>
					<ApplyActionContext value={applyContextValue}>
						<SidebarProvider>
							<MailboxSidebar />
							<SidebarInset>
								<Outlet />
							</SidebarInset>
						</SidebarProvider>
						<Toaster />
					</ApplyActionContext>
				</ActionsContext>
			</DragContext>
		</TooltipProvider>
	);
}
