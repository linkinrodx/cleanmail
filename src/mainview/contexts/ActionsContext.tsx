import { createContext, useContext } from "react";
import { useAddAction } from "@/hooks/mutations/useAddAction";
import { useActions } from "@/hooks/queries/useActions";
import type { PersistedAction } from "../../shared/rpc-types";

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

export function ActionsContextProvider({
	children,
}: {
	children: React.ReactNode;
}) {
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

	return (
		<ActionsContext value={{ actions, getCreatedAt, addAction }}>
			{children}
		</ActionsContext>
	);
}
