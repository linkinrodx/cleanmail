import { createContext, useContext } from "react";
import { useAddAction } from "@/hooks/mutations/useAddAction";
import { useActions } from "@/hooks/queries/useActions";
import { useCurrentAccountId } from "@/hooks/useCurrentAccountId";
import type { PersistedAction } from "../../shared/rpc-types";

export type MoveAction = {
	type: "move";
	/** IMAP UID of the email that was acted on */
	uid: number;
	/** Author email address extracted from the "from" field */
	authorEmail: string;
	accountId: string;
	fromMailboxPath: string;
	toMailboxPath: string;
};

export type DeleteAction = {
	type: "delete";
	uid: number;
	authorEmail: string;
	accountId: string;
	mailboxPath: string;
};

export type EmailAction = MoveAction | DeleteAction;

/** Convert a local EmailAction to the persisted format with a timestamp and unique id. */
function toPersistedAction(action: EmailAction): PersistedAction {
	if (action.type === "move") {
		return {
			id: crypto.randomUUID(),
			action: "MOVE",
			createdAt: new Date().toISOString(),
			data: {
				accountId: action.accountId,
				uid: action.uid,
				authorEmail: action.authorEmail,
				fromMailboxPath: action.fromMailboxPath,
				toMailboxPath: action.toMailboxPath,
			},
		};
	}
	return {
		id: crypto.randomUUID(),
		action: "DELETE",
		createdAt: new Date().toISOString(),
		data: {
			accountId: action.accountId,
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
			accountId: persisted.data.accountId,
			fromMailboxPath: persisted.data.fromMailboxPath,
			toMailboxPath: persisted.data.toMailboxPath,
		};
	}
	return {
		type: "delete",
		uid: persisted.data.uid,
		authorEmail: persisted.data.authorEmail,
		accountId: persisted.data.accountId,
		mailboxPath: persisted.data.mailboxPath,
	};
}

type ActionsContextValue = {
	actions: EmailAction[];
	/** Returns the id for a given action (used as jobId) */
	getId: (action: EmailAction) => string | undefined;
	addAction: (action: EmailAction) => void;
};

export const ActionsContext = createContext<ActionsContextValue>({
	actions: [],
	getId: () => undefined,
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
	const currentAccountId = useCurrentAccountId();
	const { actions: persistedActions = [] } = useActions(
		currentAccountId ?? undefined,
	);
	const { mutate: persistAddAction } = useAddAction();

	// Map persisted actions (sorted DESC by createdAt from the query) to
	// the legacy EmailAction shape consumed by existing route components,
	// scoped to the current account.
	const actions: EmailAction[] = currentAccountId
		? persistedActions
				.filter((p) => p.data.accountId === currentAccountId)
				.map(fromPersistedAction)
		: [];

	/** Returns the id for an action, used as the jobId. */
	function getId(action: EmailAction): string | undefined {
		const match = persistedActions.find((p) => {
			if (p.data.accountId !== action.accountId) {
				return false;
			}
			if (p.action === "MOVE" && action.type === "move") {
				return (
					p.data.accountId === action.accountId &&
					p.data.authorEmail === action.authorEmail &&
					p.data.fromMailboxPath === action.fromMailboxPath &&
					p.data.toMailboxPath === action.toMailboxPath
				);
			}
			if (p.action === "DELETE" && action.type === "delete") {
				return (
					p.data.accountId === action.accountId &&
					p.data.authorEmail === action.authorEmail &&
					p.data.mailboxPath === action.mailboxPath
				);
			}
			return false;
		});
		return match?.id;
	}

	function addAction(action: EmailAction) {
		persistAddAction(toPersistedAction(action));
	}

	return (
		<ActionsContext value={{ actions, getId, addAction }}>
			{children}
		</ActionsContext>
	);
}
