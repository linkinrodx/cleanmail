import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	addWindowStateListener,
	closeWindow,
	getWindowState,
	minimizeWindow,
	removeWindowStateListener,
	toggleMaximizeWindow,
} from "@/lib/rpc";

export function TitleBar() {
	const [isMaximized, setIsMaximized] = useState(false);

	useEffect(() => {
		let cancelled = false;

		getWindowState().then((state) => {
			if (!cancelled) {
				setIsMaximized(state.isMaximized);
			}
		});

		const listener = (state: { isMaximized: boolean }) => {
			setIsMaximized(state.isMaximized);
		};

		addWindowStateListener(listener);

		return () => {
			cancelled = true;
			removeWindowStateListener(listener);
		};
	}, []);

	const handleMinimize = () => {
		minimizeWindow().catch(() => {});
	};

	const handleToggleMaximize = () => {
		toggleMaximizeWindow()
			.then((result) => {
				setIsMaximized(result.isMaximized);
			})
			.catch(() => {});
	};

	const handleClose = () => {
		closeWindow().catch(() => {});
	};

	return (
		<div className="titlebar-drag flex h-9 select-none items-center justify-between border-b border-border bg-background px-2">
			<span className="text-sm font-medium">CleanMail</span>

			<div className="titlebar-no-drag flex items-center gap-0.5">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={handleMinimize}
					aria-label="Minimize"
				>
					<Minus className="size-3.5" />
				</Button>

				<Button
					variant="ghost"
					size="icon-sm"
					onClick={handleToggleMaximize}
					aria-label={isMaximized ? "Restore" : "Maximize"}
				>
					{isMaximized ? (
						<Copy className="size-3.5" />
					) : (
						<Square className="size-3.5" />
					)}
				</Button>

				<Button
					variant="ghost"
					size="icon-sm"
					onClick={handleClose}
					aria-label="Close"
				>
					<X className="size-3.5" />
				</Button>
			</div>
		</div>
	);
}
