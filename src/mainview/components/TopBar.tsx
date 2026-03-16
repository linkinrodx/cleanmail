import { SidebarTrigger } from "./ui/sidebar";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon } from "lucide-react";
import { ImapSetupTrigger } from "@/components/ImapSetupTrigger";
import type { Dispatch, SetStateAction } from "react";

type TopBarProps = {
	title: string;
	isLoading: boolean;
	refetch: () => void;
	setSetupOpen?: Dispatch<SetStateAction<boolean>>;
};

export const TopBar = ({
	title,
	isLoading,
	refetch,
	setSetupOpen,
}: TopBarProps) => {
	return (
		<header className="flex items-center justify-between border-b px-2 py-2">
			<div className="flex items-center gap-2">
				<SidebarTrigger />
				<h1 className="text-sm font-semibold tracking-tight">{title}</h1>
			</div>
			<div className="flex items-center gap-1">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => refetch()}
					disabled={isLoading}
					title="Refresh"
				>
					<RefreshCwIcon
						data-icon="inline"
						className={isLoading ? "animate-spin" : undefined}
					/>
					<span className="sr-only">Refresh</span>
				</Button>
				{setSetupOpen ? <ImapSetupTrigger onOpenChange={setSetupOpen} /> : null}
			</div>
		</header>
	);
};
