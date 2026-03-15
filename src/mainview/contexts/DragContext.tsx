import { createContext, useContext, useRef, useState } from "react";

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

export function DragContextProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [draggingUid, setDraggingUid] = useState<number | null>(null);
	const dropHandlerRef = useRef<(toMailboxPath: string) => void>(() => {});

	const value: DragContextValue = {
		draggingUid,
		setDraggingUid,
		onDropToMailbox: (toMailboxPath) => dropHandlerRef.current(toMailboxPath),
		registerDropHandler: (handler) => {
			dropHandlerRef.current = handler;
		},
	};

	return <DragContext value={value}>{children}</DragContext>;
}
