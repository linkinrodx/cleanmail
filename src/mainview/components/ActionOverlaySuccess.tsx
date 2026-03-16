import { CheckCircle2Icon } from "lucide-react";

type ActionOverlaySuccessProps = {
	text: string;
};

export const ActionOverlaySuccess = ({ text }: ActionOverlaySuccessProps) => {
	return (
		<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
			<div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-8 shadow-lg">
				<CheckCircle2Icon className="size-7 text-green-500" />
				<p className="text-sm font-semibold">{text}</p>
			</div>
		</div>
	);
};
