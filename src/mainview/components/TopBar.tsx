import { SidebarTrigger } from "./ui/sidebar";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoIcon, RefreshCwIcon } from "lucide-react";
import { ImapSetupTrigger } from "@/components/ImapSetupTrigger";
import type { Dispatch, SetStateAction } from "react";

type TopBarProps = {
	title: string;
	isLoading: boolean;
	refetch: () => void;
	setSetupOpen?: Dispatch<SetStateAction<boolean>>;
	/** Optional help text shown as an info tooltip next to the title. */
	description?: string;
};

export const TopBar = ({
	title,
	isLoading,
	refetch,
	setSetupOpen,
	description,
}: TopBarProps) => {
	return (
		<header className="flex items-center justify-between border-b px-2 py-2">
			<div className="flex min-w-0 items-center gap-2">
				<SidebarTrigger />
				<h1 className="truncate text-sm font-semibold tracking-tight">
					{title}
				</h1>
				{description ? (
					<Tooltip>
						<TooltipTrigger className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring">
							<InfoIcon className="size-3.5" />
							<span className="sr-only">About {title}</span>
						</TooltipTrigger>
						<TooltipContent className="max-w-xs">{description}</TooltipContent>
					</Tooltip>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-1">
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
