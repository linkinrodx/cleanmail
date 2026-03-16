import { Loader2Icon } from "lucide-react";

type ActionOverlayPendingProps = {
	text: string;
};
export const ActionOverlayPending = ({ text }: ActionOverlayPendingProps) => {
	return (
		<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
			<div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-8 shadow-lg">
				<Loader2Icon className="size-7 animate-spin text-primary" />
				<div className="text-center">
					<p className="text-sm font-semibold">{text}</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						This is running in the background
					</p>
				</div>
			</div>
		</div>
	);
};
